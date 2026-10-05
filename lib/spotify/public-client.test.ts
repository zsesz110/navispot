import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractPlaylistId, getPublicPlaylist, parsePublicPlaylistHtml } from './public-client';

const id = '1Y81del2NT6OMjKvhzq9uW';
const fixture = readFileSync(join(process.cwd(), 'lib/spotify/__fixtures__/public-embed.html'), 'utf8');
const originalWorkerUrl = process.env.SPOTIFY_BROWSER_WORKER_URL;
const workerTrack = { id: '4r79hyD6jsgrzAPiwQbotR', name: '我在這裡', artists: ['Stream of Praise'],
  album: '我在這裡', duration_ms: 421000 };
const workerPlaylist = { id, name: '中文敬拜詩歌', owner: 'Henry Zheng', trackCount: 126,
  tracks: Array.from({ length: 126 }, () => workerTrack) };

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

function mismatchedFixture(): string {
  return fixture.replace(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/, (_match, json: string) => {
    const data = JSON.parse(json);
    data.props.pageProps.state.data.entity.trackCount = 126;
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
    expect(() => parsePublicPlaylistHtml(mismatchedFixture(), id)).toThrow(/track count does not match/);
  });

  it('accepts playlist links and bare IDs', () => {
    expect(extractPlaylistId(`https://open.spotify.com/playlist/${id}?si=abc`)).toBe(id);
    expect(extractPlaylistId(id)).toBe(id);
    expect(extractPlaylistId('https://open.spotify.com/track/0yPy2W5TDenzATj1CTuYPN')).toBeNull();
    expect(extractPlaylistId(`https://evil.example/playlist/${id}`)).toBeNull();
    expect(extractPlaylistId(`https://open.spotify.com.evil.example/playlist/${id}`)).toBeNull();
    expect(extractPlaylistId(`http://open.spotify.com/playlist/${id}`)).toBeNull();
    expect(extractPlaylistId(`https://open.spotify.com/playlist/${id}/extra`)).toBeNull();
    expect(extractPlaylistId('not-a-playlist')).toBeNull();
    expect(extractPlaylistId(null)).toBeNull();
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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => cappedFixture() })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => workerPlaylist });
    vi.stubGlobal('fetch', fetchMock);
    process.env.SPOTIFY_BROWSER_WORKER_URL = 'http://worker:8787';
    const playlist = await getPublicPlaylist(id);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(playlist.trackCount).toBe(126);
    expect(playlist.tracks[0]).toMatchObject({ name: '我在這裡', duration_ms: 421000,
      album: { id: null, name: '我在這裡' }, external_ids: {} });
    expect(playlist.entries).toHaveLength(126);
  });

  it('uses the worker when static track count disagrees with the list', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => mismatchedFixture() })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => workerPlaylist });
    vi.stubGlobal('fetch', fetchMock);
    process.env.SPOTIFY_BROWSER_WORKER_URL = 'http://worker:8787';
    expect((await getPublicPlaylist(id)).tracks).toHaveLength(126);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['fetch failure', new TypeError('fetch failed')],
    ['timeout', new DOMException('The operation was aborted due to timeout', 'TimeoutError')],
  ])('falls back after a static %s', async (_case, failure) => {
    const fetchMock = vi.fn().mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => workerPlaylist });
    vi.stubGlobal('fetch', fetchMock);
    process.env.SPOTIFY_BROWSER_WORKER_URL = 'http://worker:8787';
    const playlist = await getPublicPlaylist(id);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(playlist.trackCount).toBe(126);
    expect(playlist.entries).toHaveLength(126);
  });

  it('accepts a short complete worker playlist when the static request fails', async () => {
    const shortWorkerPlaylist = { ...workerPlaylist, trackCount: 3, tracks: workerPlaylist.tracks.slice(0, 3) };
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => shortWorkerPlaylist });
    vi.stubGlobal('fetch', fetchMock);
    process.env.SPOTIFY_BROWSER_WORKER_URL = 'http://worker:8787';
    const playlist = await getPublicPlaylist(id);
    expect(playlist.trackCount).toBe(3);
    expect(playlist.entries).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['missing __NEXT_DATA__', '<html></html>'],
    ['invalid __NEXT_DATA__ JSON', '<script id="__NEXT_DATA__">{bad}</script>'],
  ])('falls back after %s', async (_case, html) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => html })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => workerPlaylist });
    vi.stubGlobal('fetch', fetchMock);
    process.env.SPOTIFY_BROWSER_WORKER_URL = 'http://worker:8787';
    expect((await getPublicPlaylist(id)).tracks).toHaveLength(126);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([403, 429, 503])('falls back after static HTTP %i', async (status) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => workerPlaylist });
    vi.stubGlobal('fetch', fetchMock);
    process.env.SPOTIFY_BROWSER_WORKER_URL = 'http://worker:8787';
    expect((await getPublicPlaylist(id)).entries).toHaveLength(126);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('combines static and browser errors when both sources fail', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'worker unavailable' }) });
    vi.stubGlobal('fetch', fetchMock);
    process.env.SPOTIFY_BROWSER_WORKER_URL = 'http://worker:8787';
    await expect(getPublicPlaylist(id)).rejects.toThrow(
      'Public Spotify playlist import failed. Static source: fetch failed. Browser fallback: worker unavailable.',
    );
  });

  it('rejects an invalid ID without contacting either source', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.SPOTIFY_BROWSER_WORKER_URL = 'http://worker:8787';
    await expect(getPublicPlaylist('invalid')).rejects.toThrow('Invalid Spotify playlist ID');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects incomplete worker responses', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => cappedFixture() })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id, name: '列表', trackCount: 126, tracks: [] }) }));
    process.env.SPOTIFY_BROWSER_WORKER_URL = 'http://worker:8787';
    await expect(getPublicPlaylist(id)).rejects.toThrow(/incomplete or invalid/);
  });
});
