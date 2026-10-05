import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchTrack } from './orchestrator';
import type { NavidromeApiClient } from '@/lib/navidrome/client';
import type { SpotifyTrack } from '@/types/spotify';
import type { NavidromeNativeSong } from '@/types/navidrome';

const spotify: SpotifyTrack = {
  id: null, name: '基督是我滿足', artists: [{ id: null, name: 'Joshua Band' }],
  album: { id: null, name: '點燃' }, duration_ms: 315000, external_ids: {},
};
const candidates: NavidromeNativeSong[] = [
  { id: 'correct', title: '基督是我满足', artist: '约书亚乐团', artistId: 'a',
    album: '点燃', albumId: 'al', duration: 317.86 },
  { id: 'wrong', title: '基督是我满足', artist: '起初音乐', artistId: 'b',
    album: '信徒喜欢的诗歌', albumId: 'bl', duration: 241.49 },
];

const previousDebug = process.env.NAVISPOT_MATCH_DEBUG;
afterEach(() => {
  if (previousDebug === undefined) delete process.env.NAVISPOT_MATCH_DEBUG;
  else process.env.NAVISPOT_MATCH_DEBUG = previousDebug;
  vi.restoreAllMocks();
});

describe('orchestrated Chinese matching diagnostics', () => {
  const client = { searchByTitle: vi.fn().mockResolvedValue(candidates) } as unknown as NavidromeApiClient;

  it('selects the correct recording from multiple same-title candidates', async () => {
    const result = await matchTrack(client, spotify);
    expect(result.status).toBe('matched');
    expect(result.matchStrategy).toBe('fuzzy');
    expect(result.navidromeSong?.id).toBe('correct');
    expect(result.matchScore).toBeGreaterThan(0.9);
  });

  it('prints candidate score details only when debug mode is enabled', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    delete process.env.NAVISPOT_MATCH_DEBUG;
    await matchTrack(client, spotify);
    expect(debug).not.toHaveBeenCalled();
    process.env.NAVISPOT_MATCH_DEBUG = 'true';
    await matchTrack(client, spotify);
    expect(debug).toHaveBeenCalledTimes(1);
    const detail = debug.mock.calls[0][1];
    expect(detail.search).toMatchObject({ originalQuery: '基督是我滿足',
      normalizedQuery: '基督是我满足', candidateCount: 2 });
    expect(detail.candidates[0].scores).toMatchObject({ titleSimilarity: 1, artistSimilarity: 1 });
    expect(detail.candidates[1].rejectionReason).toBe('artist mismatch');
  });
});

describe('artist-scoped translation fallback', () => {
  const translated: SpotifyTrack = { ...spotify, name: 'You Surround Me',
    artists: [{ id: null, name: 'Stream of Praise' }],
    album: { id: null, name: 'Morning to Night' }, duration_ms: 287000 };
  const local: NavidromeNativeSong = { id: 'translated', title: '围绕我', artist: '赞美之泉音乐事工',
    artistId: 'sop', album: '从早晨到夜晚', albumId: 'morning', duration: 287.84 };

  it('loads a known artist once when title search is empty and uses verified title evidence', async () => {
    const client = { searchByTitle: vi.fn().mockResolvedValue([]),
      getCachedSongsByExactArtist: vi.fn().mockResolvedValue([local,
        { ...local, id: 'different', title: '另一首歌', duration: 287.5 }]) } as unknown as NavidromeApiClient;
    const result = await matchTrack(client, translated);
    expect(result.status).toBe('matched');
    expect(result.navidromeSong?.id).toBe('translated');
    expect(client.getCachedSongsByExactArtist).toHaveBeenCalledOnce();
  });

  it('does not guess among same-artist same-duration songs without a verified alias', async () => {
    const client = { searchByTitle: vi.fn().mockResolvedValue([]),
      getCachedSongsByExactArtist: vi.fn().mockResolvedValue([local,
        { ...local, id: 'different', title: '另一首歌', duration: 287.5 }]) } as unknown as NavidromeApiClient;
    const result = await matchTrack(client, { ...translated, name: 'Unknown English Title' });
    expect(result.status).toBe('unmatched');
    expect(result.navidromeSong).toBeUndefined();
  });
});
