import { describe, it, expect } from 'vitest';
import { filterStrictMatches, matchByStrict, normalizeString } from '@/lib/matching/strict-matcher';
import { NavidromeNativeSong } from '@/types/navidrome';
import { NavidromeApiClient } from '@/lib/navidrome/client';
import type { SpotifyTrack } from '@/types/spotify';

const song1: NavidromeNativeSong = {
  id: 's1',
  title: 'Test Song',
  artist: 'Test Artist',
  artistId: 'a1',
  album: 'Album',
  albumId: 'al1',
  duration: 200,
};

const song2: NavidromeNativeSong = {
  id: 's2',
  title: 'Test Song',
  artist: 'Other Artist',
  artistId: 'a2',
  album: 'Album',
  albumId: 'al1',
  duration: 200,
};

const song3: NavidromeNativeSong = {
  id: 's3',
  title: 'Test Song',
  artist: 'Yet Another',
  artistId: 'a3',
  album: 'Album',
  albumId: 'al1',
  duration: 202,
};

describe('filterStrictMatches', () => {
  it('preserves Chinese characters in strict normalization', () => {
    expect(normalizeString('基督是我滿足')).toBe('基督是我满足');
  });
  it('matches exact artist and title', () => {
    const result = filterStrictMatches([song1, song2], 'test artist', 'test song');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });

  it('matches any artist when normalizedArtist is null (artistless tracks)', () => {
    const result = filterStrictMatches([song1, song2, song3], null, 'test song');
    expect(result).toHaveLength(3);
  });

  it('returns empty for no title match', () => {
    const result = filterStrictMatches([song1], 'test artist', 'wrong title');
    expect(result).toHaveLength(0);
  });
});

describe('Chinese artist aliases and duration in strict matching', () => {
  const spotify: SpotifyTrack = {
    id: null, name: '基督是我滿足', artists: [{ id: null, name: 'Joshua Band' }],
    album: { id: null, name: '點燃' }, duration_ms: 315000, external_ids: {},
  };
  const correct: NavidromeNativeSong = { ...song1, id: 'correct', title: '基督是我满足',
    artist: '约书亚乐团', album: '点燃', duration: 318 };
  const wrong: NavidromeNativeSong = { ...song2, id: 'wrong', title: '基督是我满足',
    artist: '起初音乐', album: '信徒喜欢的诗歌', duration: 241 };

  it('accepts the declared alias and rejects another same-title artist', () => {
    expect(filterStrictMatches([correct, wrong], 'joshua band', '基督是我满足')).toEqual([correct]);
  });

  it('rejects a wrong-duration recording even with the correct alias', async () => {
    const offDuration = { ...correct, duration: 241 };
    const client = {} as NavidromeApiClient;
    const result = await matchByStrict(client, spotify, [offDuration, wrong]);
    expect(result.status).toBe('unmatched');
  });

  it('accepts the 3-second duration difference', async () => {
    const client = {} as NavidromeApiClient;
    const result = await matchByStrict(client, spotify, [wrong, correct]);
    expect(result.status).toBe('matched');
    expect(result.navidromeSong?.id).toBe('correct');
  });
});

describe('collaboration indicator handling', () => {
  it('matches artist with feat. suffix to plain artist', () => {
    const featSong: NavidromeNativeSong = {
      id: 's4',
      title: 'Test Song',
      artist: 'Test Artist feat. Guest',
      artistId: 'a4',
      album: 'Album',
      albumId: 'al1',
      duration: 200,
    };
    const result = filterStrictMatches([featSong], 'test artist', 'test song');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s4');
  });

  it('matches Spotify artist with feat. to plain Navidrome artist', () => {
    const plainSong: NavidromeNativeSong = {
      id: 's5',
      title: 'Test Song',
      artist: 'Test Artist',
      artistId: 'a5',
      album: 'Album',
      albumId: 'al1',
      duration: 200,
    };
    // matchByStrict normalizes 'Test Artist feat. Guest' → 'test artist' before calling filterStrictMatches
    const result = filterStrictMatches([plainSong], 'test artist', 'test song');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s5');
  });
});

describe('featured artist in title', () => {
  it('matches title with feat. annotation to plain title', () => {
    const featTitleSong: NavidromeNativeSong = {
      id: 's6',
      title: 'Hit Song (feat. Someone)',
      artist: 'Test Artist',
      artistId: 'a6',
      album: 'Album',
      albumId: 'al1',
      duration: 200,
    };
    const result = filterStrictMatches([featTitleSong], 'test artist', 'hit song');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s6');
  });
});

describe('version mismatch detection', () => {
  it('rejects version mismatch when normalized titles match', () => {
    const liveSong: NavidromeNativeSong = {
      id: 's7',
      title: 'Test Song (Live)',
      artist: 'Test Artist',
      artistId: 'a7',
      album: 'Album',
      albumId: 'al1',
      duration: 200,
    };
    // Both "Test Song Live" and "Test Song (Live)" normalize to "test song live"
    // but only the Navidrome version has a version marker in parentheses
    const result = filterStrictMatches([liveSong], 'test artist', 'test song live', 'Test Song Live');
    expect(result).toHaveLength(0);
  });

  it('matches when both have same version marker', () => {
    const remixSong: NavidromeNativeSong = {
      id: 's8',
      title: 'Test Song (Remix)',
      artist: 'Test Artist',
      artistId: 'a8',
      album: 'Album',
      albumId: 'al1',
      duration: 200,
    };
    const result = filterStrictMatches([remixSong], 'test artist', 'test song remix', 'Test Song (Remix)');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s8');
  });
});
