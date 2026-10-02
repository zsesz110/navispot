import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractPlaylistId, getPublicPlaylist, parsePublicPlaylistHtml } from './public-client';

const id = '1Y81del2NT6OMjKvhzq9uW';
const fixture = readFileSync(join(process.cwd(), 'lib/spotify/__fixtures__/public-embed.html'), 'utf8');
const originalWorkerUrl = process.env.SPOTIFY_BROWSER_WORKER_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalWorkerUrl === undefined) delete process.env.SPOTIFY_BROWSER_WORKER_URL;
  else process.env.SPOTIFY_BROWSER_WORKER_URL = originalWorkerUrl;
});

function cappedFixture(): string {
  return fixture.replace(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/, (_match, json: string) => {
    const data = JSON.parse(json);
    const entity = data.props.pageProps.state.data.entity;
    entity.trackList = Array.from({ length: 100 }, () => entity.trackList[0]);
    return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`;
  });
}

describe('public Spotify embed parser', () => {
  it('maps public Unicode metadata into ImportedPlaylist', () => {
    const playlist = parsePublicPlaylistHtml(fixture, id);
    expect(playlist).toMatchObject({ id, name: '中文敬拜詩歌', owner: 'Henry Zheng', trackCount: 3 });
    expect(playlist.tracks[0]).toMatchObject({
      id: '0yPy2W5TDenzATj1CTuYPN', name: '基督是我滿足', duration_ms: 315866,
      external_urls: { spotify: 'https://open.spotify.com/track/0yPy2W5TDenzATj1CTuYPN' },
    });
    expect(playlist.tracks[1].artists.map((artist) => artist.name)).toEqual(['Hillsong 華語', 'Joshua Band']);
    expect(playlist.tracks[2]).toMatchObject({ id: null, album: { id: null, name: '' }, duration_ms: 0, external_ids: {} });
    expect(playlist.tracks[2].external_urls).toBeUndefined();
    expect(playlist.entries.map((entry) => entry.position)).toEqual([0, 1, 2]);
  });

  it('rejects malformed data and mismatched playlists', () => {
    expect(() => parsePublicPlaylistHtml('<html></html>', id)).toThrow(/structured playlist data is missing/);
    expect(() => parsePublicPlaylistHtml(fixture, 'AAAAAAAAAAAAAAAAAAAAAA')).toThrow(/playlist identity/);
    expect(() => parsePublicPlaylistHtml(fixture.replace('基督是我滿足', ''), id)).toThrow(/track 1/);
  });

  it('rejects a list at the public embed cap rather than silently truncating it', () => {
    expect(() => parsePublicPlaylistHtml(cappedFixture(), id)).toThrow(/at most 100 tracks/);
  });

  it('accepts playlist links and bare IDs', () => {
    expect(extractPlaylistId(`https://open.spotify.com/playlist/${id}?si=abc`)).toBe(id);
    expect(extractPlaylistId(id)).toBe(id);
    expect(extractPlaylistId('https://open.spotify.com/track/0yPy2W5TDenzATj1CTuYPN')).toBeNull();
  });
});

describe('hybrid public playlist import', () => {
  it('returns complete static embeds without contacting the browser worker', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => fixture });
    vi.stubGlobal('fetch', fetchMock);
    process.env.SPOTIFY_BROWSER_WORKER_URL = 'http://worker:8787';
    const playlist = await getPublicPlaylist(id);
    expect(playlist.trackCount).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the worker only for capped embeds and normalizes its tracks', async () => {
    const workerTrack = { id: '4r79hyD6jsgrzAPiwQbotR', name: '我在這裡', artists: ['Stream of Praise'],
      album: '我在這裡', duration_ms: 421000 };
    const worker = { id, name: '中文敬拜詩歌', owner: 'Henry Zheng', trackCount: 100,
      tracks: Array.from({ length: 100 }, () => workerTrack) };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => cappedFixture() })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => worker });
    vi.stubGlobal('fetch', fetchMock);
    process.env.SPOTIFY_BROWSER_WORKER_URL = 'http://worker:8787';
    const playlist = await getPublicPlaylist(id);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(playlist.tracks[0]).toMatchObject({ name: '我在這裡', duration_ms: 421000,
      album: { id: null, name: '我在這裡' }, external_ids: {} });
    expect(playlist.entries).toHaveLength(100);
  });

  it('rejects incomplete worker responses', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => cappedFixture() })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id, name: '列表', trackCount: 126, tracks: [] }) }));
    process.env.SPOTIFY_BROWSER_WORKER_URL = 'http://worker:8787';
    await expect(getPublicPlaylist(id)).rejects.toThrow(/incomplete or invalid/);
  });
});
