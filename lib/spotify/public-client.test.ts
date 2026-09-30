import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractPlaylistId, parsePublicPlaylistHtml } from './public-client';

const id = '1Y81del2NT6OMjKvhzq9uW';
const fixture = readFileSync(join(process.cwd(), 'lib/spotify/__fixtures__/public-embed.html'), 'utf8');

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
    const capped = fixture.replace(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/, (_match, json: string) => {
      const data = JSON.parse(json);
      const entity = data.props.pageProps.state.data.entity;
      entity.trackList = Array.from({ length: 100 }, () => entity.trackList[0]);
      return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`;
    });
    expect(() => parsePublicPlaylistHtml(capped, id)).toThrow(/at most 100 tracks/);
  });

  it('accepts playlist links and bare IDs', () => {
    expect(extractPlaylistId(`https://open.spotify.com/playlist/${id}?si=abc`)).toBe(id);
    expect(extractPlaylistId(id)).toBe(id);
    expect(extractPlaylistId('https://open.spotify.com/track/0yPy2W5TDenzATj1CTuYPN')).toBeNull();
  });
});
