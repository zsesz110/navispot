import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavidromeApiClient, normalizeSearchQuery } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('bounded multilingual Navidrome candidate retrieval', () => {
  it('retains Unicode in a normalized query', () => {
    expect(normalizeSearchQuery('基督是我滿足 / 點燃')).toBe('基督是我满足 点燃');
  });

  it('searches original then simplified title and deduplicates song IDs', async () => {
    const queries: string[] = [];
    const song = { id: 'correct', title: '基督是我满足', artist: '约书亚乐团', album: '点燃', duration: 318 };
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const query = new URL(url).searchParams.get('title') ?? '';
      queries.push(query);
      return { ok: true, status: 200, headers: new Headers(),
        json: async () => query === '基督是我满足' ? [song, song] : [] };
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new NavidromeApiClient('https://example.test', 'user', 'unused', 'token', 'client-id');
    const result = await client.searchByTitle('基督是我滿足', 10);
    expect(queries).toEqual(['基督是我滿足', '基督是我满足']);
    expect(result).toEqual([song]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
