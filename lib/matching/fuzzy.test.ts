import { describe, it, expect } from 'vitest';
import { calculateTrackSimilarity, calculateTrackScoreDetails, findBestMatch, normalizeTitle, normalizeArtistName, calculateBestArtistSimilarity, calculateAlbumSimilarity, normalizeString, hasVersionMismatch } from '@/lib/matching/fuzzy';
import { titleSearchQueries } from '@/lib/matching/title-search';
import { titleVariants, isMedley } from '@/lib/matching/title-variants';
import { verifiedTitleAliases } from '@/lib/matching/title-aliases';
import { SpotifyTrack } from '@/types/spotify';
import { NavidromeSong } from '@/types/navidrome';

const emptyArtistTrack: SpotifyTrack = {
  id: null,
  name: 'Rivers in the Deset',
  uri: undefined,
  is_local: true,
  artists: [],
  album: { id: null, name: 'Some Album' },
  duration_ms: 210000,
  external_ids: {},
};

const normalTrack: SpotifyTrack = {
  id: 'sp1',
  name: 'Rivers in the Desert',
  uri: 'spotify:track:sp1',
  artists: [{ id: 'a1', name: 'Lyn' }],
  album: { id: 'al1', name: 'Persona 5 OST' },
  duration_ms: 210000,
  external_ids: { isrc: 'JP123' },
};

const candidate: NavidromeSong = {
  id: 'nd1',
  title: 'Rivers in the Desert',
  artist: 'Lyn',
  album: 'Persona 5 OST',
  duration: 210,
  isrc: ['JP123'],
};

const closeCandidate: NavidromeSong = {
  id: 'nd2',
  title: 'Rivers in the Desert (Instrumental)',
  artist: 'Lyn',
  album: 'Persona 5 OST',
  duration: 212,
};

describe('calculateTrackSimilarity', () => {
  it('scores perfectly for identical track', () => {
    const score = calculateTrackSimilarity(normalTrack, candidate);
    expect(score).toBeGreaterThan(0.9);
  });

  it('scores acceptably for artistless local track with matching title/duration', () => {
    const localCandidate: NavidromeSong = {
      id: 'nd3',
      title: 'Rivers in the Deset',
      artist: 'Some Artist',
      album: 'Some Album',
      duration: 210,
    };
    const score = calculateTrackSimilarity(emptyArtistTrack, localCandidate);
    expect(score).toBeGreaterThan(0.8);
  });

  it('scores lower for mismatched duration', () => {
    const badCandidate: NavidromeSong = {
      id: 'nd4',
      title: 'Rivers in the Deset',
      artist: 'Some Artist',
      album: 'Some Album',
      duration: 400,
    };
    const score = calculateTrackSimilarity(emptyArtistTrack, badCandidate);
    expect(score).toBeLessThan(0.9);
  });

  it('does not penalize missing album', () => {
    const trackWithoutAlbum: SpotifyTrack = {
      ...emptyArtistTrack,
      album: { id: null, name: '' },
    };
    const c: NavidromeSong = {
      id: 'nd5',
      title: 'Rivers in the Deset',
      artist: '',
      album: '',
      duration: 210,
    };
    const score = calculateTrackSimilarity(trackWithoutAlbum, c);
    expect(score).toBeGreaterThan(0);
  });
});

describe('findBestMatch', () => {
  it('returns best match above threshold', () => {
    const result = findBestMatch(normalTrack, [candidate, closeCandidate], 0.7);
    expect(result.bestMatch).toBeDefined();
    expect(result.bestMatch!.song.id).toBe('nd1');
  });

  it('returns empty for no matches above threshold', () => {
    const badCandidates: NavidromeSong[] = [{
      id: 'x',
      title: 'Completely Different',
      artist: 'Some Artist',
      album: 'Some Album',
      duration: 300,
    }];
    const result = findBestMatch(normalTrack, badCandidates, 0.9);
    expect(result.bestMatch).toBeUndefined();
    expect(result.matches).toHaveLength(0);
  });

  it('detects ambiguity between close candidates with different artists', () => {
    const c1: NavidromeSong = { id: 'a', title: 'Almost Same', artist: 'Artist One', album: 'Album', duration: 200 };
    const c2: NavidromeSong = { id: 'b', title: 'Almost Same', artist: 'Artist Two', album: 'Album', duration: 200 };
    const t: SpotifyTrack = {
      id: 't1',
      name: 'Almost Same',
      artists: [{ id: 'ar', name: 'Artist' }],
      album: { id: 'al', name: 'Album' },
      duration_ms: 200000,
      external_ids: {},
    };
    const result = findBestMatch(t, [c1, c2], 0.5);
    expect(result.bestMatch).toBeDefined();
  });

  it('does not flag duplicates as ambiguous', () => {
    const c1: NavidromeSong = { id: 'a', title: 'Same Title', artist: 'Same Artist', album: 'Album', duration: 200 };
    const c2: NavidromeSong = { id: 'b', title: 'Same Title', artist: 'Same Artist', album: 'Album', duration: 200 };
    const t: SpotifyTrack = {
      id: 't1',
      name: 'Same Title',
      artists: [{ id: 'ar', name: 'Same Artist' }],
      album: { id: 'al', name: 'Album' },
      duration_ms: 200000,
      external_ids: {},
    };
    const result = findBestMatch(t, [c1, c2], 0.5);
    expect(result.hasAmbiguous).toBe(false);
  });
});

describe('normalizeTitle', () => {
  it('removes featured artist annotations', () => {
    expect(normalizeTitle('Song (feat. Artist)')).toBe('song');
  });
});

describe('Unicode and Chinese canonical matching', () => {
  it('preserves Chinese, Japanese, Korean, and other Unicode letters', () => {
    expect(normalizeTitle('基督是我滿足')).toBe('基督是我满足');
    expect(normalizeTitle('基督是我满足')).toBe('基督是我满足');
    expect(normalizeTitle('我在這裡')).toBe('我在这里');
    expect(normalizeArtistName('約書亞樂團')).toBe('约书亚乐团');
    expect(normalizeArtistName('赞美之泉')).toBe('赞美之泉');
    expect(normalizeString('東京 서울 Église')).toBe('东京 서울 eglise');
    expect(calculateAlbumSimilarity('點燃', '点燃')).toBe(1);
  });

  it('resolves only declared artist aliases', () => {
    expect(calculateBestArtistSimilarity(['Joshua Band'], '约书亚乐团')).toBe(1);
    expect(calculateBestArtistSimilarity(['Joshua Band'], '約書亞樂團')).toBe(1);
    expect(calculateBestArtistSimilarity(['Stream of Praise'], '赞美之泉')).toBe(1);
    expect(calculateBestArtistSimilarity(['Stream of Praise'], '讚美之泉')).toBe(1);
    expect(calculateBestArtistSimilarity(['Stream of Praise'], '赞美之泉音乐事工')).toBe(1);
    expect(calculateBestArtistSimilarity(['Joshua Band'], '起初音乐')).toBeLessThan(0.6);
  });

  it('searches original and canonical title before stripped variants', () => {
    expect(titleSearchQueries('基督是我滿足')).toEqual(['基督是我滿足', '基督是我满足']);
    expect(titleSearchQueries('點燃 (Live)')).toEqual(['點燃 (Live)', '点燃 (Live)', '點燃', '点燃']);
  });

  it('ranks the true Joshua Band recording far above the other same-title artist', () => {
    const spotify: SpotifyTrack = { ...normalTrack, name: '基督是我滿足',
      artists: [{ id: null, name: 'Joshua Band' }], album: { id: null, name: '點燃' }, duration_ms: 315000 };
    const correct: NavidromeSong = { id: 'correct', title: '基督是我满足', artist: '约书亚乐团', album: '点燃', duration: 318 };
    const wrong: NavidromeSong = { id: 'wrong', title: '基督是我满足', artist: '起初音乐', album: '信徒喜欢的诗歌', duration: 241 };
    const good = calculateTrackScoreDetails(spotify, correct);
    const bad = calculateTrackScoreDetails(spotify, wrong);
    expect(good).toMatchObject({ titleSimilarity: 1, artistSimilarity: 1, albumSimilarity: 1 });
    expect(good.durationSimilarity).toBeGreaterThan(0.9);
    expect(good.finalScore).toBeGreaterThan(0.8);
    expect(bad.titleSimilarity).toBe(1);
    expect(bad.artistSimilarity).toBeLessThan(0.6);
    expect(bad.durationSimilarity).toBeLessThan(0.2);
    expect(bad.finalScore).toBeLessThan(0.8);
    expect(findBestMatch(spotify, [wrong, correct], 0.8).bestMatch?.song.id).toBe('correct');
    const wrongDuration = { ...correct, id: 'wrong-duration', duration: 241 };
    expect(calculateTrackSimilarity(spotify, wrongDuration)).toBeLessThan(0.8);
  });

  it('does not treat a Chinese accompaniment as the vocal recording', () => {
    expect(hasVersionMismatch('行神蹟的神', '行神迹的神（伴奏）')).toBe(true);
    expect(hasVersionMismatch('行神蹟的神', '行神迹的神')).toBe(false);
  });
});

describe('normalizeArtistName', () => {
  it('normalizes collaboration indicators', () => {
    const name = normalizeArtistName('Artist Ft. Guest');
    expect(name).not.toContain('ft.');
  });
});

describe('calculateBestArtistSimilarity', () => {
  it('returns 1.0 when any individual artist matches exactly', () => {
    const score = calculateBestArtistSimilarity(['Kendrick Lamar', 'SZA'], 'Kendrick Lamar');
    expect(score).toBe(1.0);
  });

  it('scores higher than joined-string comparison for multi-artist tracks', () => {
    const bestScore = calculateBestArtistSimilarity(['Kendrick Lamar', 'SZA'], 'Kendrick Lamar');
    const joinedScore = calculateBestArtistSimilarity(['Kendrick Lamar SZA'], 'Kendrick Lamar');
    expect(bestScore).toBeGreaterThan(joinedScore);
  });

  it('returns 0 when no artists overlap', () => {
    const score = calculateBestArtistSimilarity(['Drake', 'Future'], 'Kendrick Lamar');
    expect(score).toBeLessThan(0.5);
  });
});

describe('second-stage conservative title and artist matching', () => {
  const track = (name: string, artist: string, album: string, duration_ms: number): SpotifyTrack => ({
    ...normalTrack, name, artists: [{ id: null, name: artist }], album: { id: null, name: album }, duration_ms,
    external_ids: {},
  });
  const song = (title: string, artist: string, album: string, duration: number): NavidromeSong => ({
    id: 'local', title, artist, album, duration,
  });

  it('keeps Chinese titles and worship-pronoun variants searchable', () => {
    expect(titleSearchQueries('祢的器皿')).toContain('你的器皿');
    expect(calculateTrackSimilarity(track('祢的器皿', 'Stream of Praise', '新的事将要成就', 267000),
      song('你的器皿', '赞美之泉音乐事工', '新的事将要成就', 268.02))).toBeGreaterThan(0.8);
  });

  it('uses only a verified English/Chinese title alias', () => {
    expect(verifiedTitleAliases('God of Miracles')).toContain('行神迹的神');
    expect(calculateTrackSimilarity(track('God of Miracles', 'Stream of Praise', 'I Want to See', 234000),
      song('行神迹的神', '赞美之泉音乐事工', '我要看见', 234.71))).toBeGreaterThan(0.8);
    expect(calculateTrackSimilarity(track('Unrelated Song', 'Stream of Praise', 'I Want to See', 234000),
      song('行神迹的神', '赞美之泉音乐事工', '我要看见', 234.71))).toBeLessThan(0.8);
  });

  it('generates mixed, parenthetical, and medley components without dropping the full title', () => {
    expect(titleVariants('Jesus Lives In Me 耶穌在我裡面')).toEqual(expect.arrayContaining([
      'Jesus Lives In Me 耶穌在我裡面', 'Jesus Lives In Me', '耶穌在我裡面', '耶稣在我里面',
    ]));
    expect(titleVariants('呼求之歌(Cry Out)')).toEqual(expect.arrayContaining(['呼求之歌', 'Cry Out']));
    expect(titleVariants('Hosanna / What A Beautiful Name')).toEqual(expect.arrayContaining([
      'Hosanna / What A Beautiful Name', 'Hosanna', 'What A Beautiful Name',
    ]));
  });

  it('requires full medley semantics despite component retrieval', () => {
    expect(isMedley('能不能+一生爱你（创意教室）')).toBe(true);
    expect(calculateTrackSimilarity(track('能不能', 'Stream of Praise', 'Live', 137000),
      song('能不能+一生爱你（创意教室）', '赞美之泉音乐事工', '创意教室', 148.69))).toBeLessThan(0.8);
    expect(calculateTrackSimilarity(track('組曲: 你配得全所有 / 我尊崇你', 'Joshua Band', '双膝跪下触摸天堂', 491000),
      song('你配得全所有/我尊崇你', '约书亚乐团', '双膝跪下触摸天堂', 491.83))).toBeGreaterThan(0.8);
    expect(calculateTrackSimilarity(track('Hosanna / What A Beautiful Name', 'Same Artist', 'Album', 300000),
      song('Hosanna / Different Song', 'Same Artist', 'Album', 300))).toBeLessThan(0.8);
  });

  it('finds semantic overlap in collaboration strings while rejecting unrelated artists', () => {
    expect(calculateBestArtistSimilarity(['Sehlin 林婉容 & Lamb Music 小羊詩歌'], '小羊诗歌')).toBe(1);
    expect(calculateBestArtistSimilarity(['Hillsong 華語, Joshua Band'], '约书亚乐团')).toBe(1);
    expect(calculateTrackSimilarity(track('同名歌', 'Another Artist', '同名专辑', 200000),
      song('同名歌', '约书亚乐团', '同名专辑', 200))).toBeLessThan(0.8);
  });

  it('uses catalog suffixes and refuses one-letter album coincidences or instrumental albums', () => {
    expect(calculateAlbumSimilarity('寶貴十架 (敬拜讚美專輯11)', '宝贵十架')).toBe(1);
    expect(calculateAlbumSimilarity('Twinkle, Twinkle', 'I Believe')).toBe(0);
    const spotify = track('揀選', 'Stream of Praise', '寶貴十架 (敬拜讚美專輯11)', 204000);
    const vocal = song('拣选', '赞美之泉音乐事工', '宝贵十架', 204.04);
    const instrumental = song('拣选', '赞美之泉音乐事工', '（演奏专辑）你恩典不离开', 206.16);
    expect(findBestMatch(spotify, [vocal, instrumental]).bestMatch?.song).toEqual(vocal);
    expect(findBestMatch(spotify, [vocal, instrumental]).hasAmbiguous).toBe(false);
  });

  it('keeps live and alternate recordings separate, and refuses same-artist duration-only guesses', () => {
    expect(calculateTrackSimilarity(track('祢永遠如此深愛著我', 'Stream of Praise', '天堂敬拜 Live', 358000),
      song('你永远如此深爱我', '赞美之泉音乐事工', 'I Believe', 342.57))).toBeLessThan(0.8);
    expect(calculateTrackSimilarity(track('Unknown English Title', 'Stream of Praise', 'Morning to Night', 287000),
      song('围绕我', '赞美之泉音乐事工', '从早晨到夜晚', 287.84))).toBeLessThan(0.8);
  });
});

describe('per-artist matching in calculateTrackSimilarity', () => {
  it('matches multi-artist Spotify track against single-artist Navidrome song', () => {
    const multiArtistTrack: SpotifyTrack = {
      id: 'sp2',
      name: 'All The Stars',
      uri: 'spotify:track:sp2',
      artists: [{ id: 'a1', name: 'Kendrick Lamar' }, { id: 'a2', name: 'SZA' }],
      album: { id: 'al1', name: 'Black Panther' },
      duration_ms: 200000,
      external_ids: {},
    };
    const navidromeSong: NavidromeSong = {
      id: 'nd1',
      title: 'All The Stars',
      artist: 'Kendrick Lamar',
      album: 'Black Panther',
      duration: 200,
    };
    const score = calculateTrackSimilarity(multiArtistTrack, navidromeSong);
    expect(score).toBeGreaterThan(0.9);
  });
});

describe('album similarity cap removed', () => {
  it('returns raw token ratio without 0.8 multiplier', () => {
    const score = calculateAlbumSimilarity('Same Album', 'Same Album');
    expect(score).toBe(1.0);
  });

  it('returns proportional ratio for partial matches', () => {
    const score = calculateAlbumSimilarity('Greatest Hits Vol 1', 'Greatest Hits');
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1.0);
  });
});

describe('article prefix stripping in normalizeString', () => {
  it('strips leading "the"', () => {
    expect(normalizeString('The Weeknd')).toBe('weeknd');
  });

  it('strips leading "a"', () => {
    expect(normalizeString('A Tribe Called Quest')).toBe('tribe called quest');
  });

  it('strips leading "an"', () => {
    expect(normalizeString('An Animal')).toBe('animal');
  });

  it('does not strip articles in the middle of a string', () => {
    expect(normalizeString('Getting the Thing')).toBe('getting the thing');
  });

  it('does not strip articles at the end of a string', () => {
    expect(normalizeString('Meet The')).toBe('meet the');
  });
});

describe('artist gate', () => {
  it('rejects wrong-artist match with same title', () => {
    const spotifyTrack: SpotifyTrack = {
      id: 'sp1',
      name: 'Stay Another Night',
      uri: 'spotify:track:sp1',
      artists: [{ id: 'a1', name: 'Chris Ayer' }],
      album: { id: 'al1', name: 'Some Album' },
      duration_ms: 200000,
      external_ids: {},
    };
    const wrongCandidate: NavidromeSong = {
      id: 'nd1',
      title: 'Stay Another Night',
      artist: 'Cheat Codes',
      album: 'Some Album',
      duration: 200,
    };
    const score = calculateTrackSimilarity(spotifyTrack, wrongCandidate);
    expect(score).toBeLessThan(0.8);
  });

  it('still matches correct artist with same title', () => {
    const spotifyTrack: SpotifyTrack = {
      id: 'sp1',
      name: 'Stay Another Night',
      uri: 'spotify:track:sp1',
      artists: [{ id: 'a1', name: 'Chris Ayer' }],
      album: { id: 'al1', name: 'Some Album' },
      duration_ms: 200000,
      external_ids: {},
    };
    const correctCandidate: NavidromeSong = {
      id: 'nd1',
      title: 'Stay Another Night',
      artist: 'Chris Ayer',
      album: 'Some Album',
      duration: 200,
    };
    const score = calculateTrackSimilarity(spotifyTrack, correctCandidate);
    expect(score).toBeGreaterThan(0.8);
  });
});

describe('version mismatch penalty', () => {
  it('rejects remix matching original', () => {
    const spotifyTrack: SpotifyTrack = {
      id: 'sp2',
      name: 'Love Me Like That',
      uri: 'spotify:track:sp2',
      artists: [{ id: 'a1', name: 'State of Sound' }],
      album: { id: 'al1', name: 'Some Album' },
      duration_ms: 200000,
      external_ids: {},
    };
    const remixCandidate: NavidromeSong = {
      id: 'nd2',
      title: 'Love Me Like That (Landis Remix)',
      artist: 'State of Sound',
      album: 'Some Album',
      duration: 200,
    };
    const score = calculateTrackSimilarity(spotifyTrack, remixCandidate);
    expect(score).toBeLessThan(0.8);
  });

  it('rejects acoustic matching original', () => {
    const spotifyTrack: SpotifyTrack = {
      id: 'sp3',
      name: 'Some Song',
      uri: 'spotify:track:sp3',
      artists: [{ id: 'a1', name: 'Some Artist' }],
      album: { id: 'al1', name: 'Some Album' },
      duration_ms: 200000,
      external_ids: {},
    };
    const acousticCandidate: NavidromeSong = {
      id: 'nd3',
      title: 'Some Song (Acoustic)',
      artist: 'Some Artist',
      album: 'Some Album',
      duration: 200,
    };
    const score = calculateTrackSimilarity(spotifyTrack, acousticCandidate);
    expect(score).toBeLessThan(0.8);
  });

  it('rejects live matching original', () => {
    const spotifyTrack: SpotifyTrack = {
      id: 'sp4',
      name: 'Some Song',
      uri: 'spotify:track:sp4',
      artists: [{ id: 'a1', name: 'Some Artist' }],
      album: { id: 'al1', name: 'Some Album' },
      duration_ms: 200000,
      external_ids: {},
    };
    const liveCandidate: NavidromeSong = {
      id: 'nd4',
      title: 'Some Song (Live)',
      artist: 'Some Artist',
      album: 'Some Album',
      duration: 200,
    };
    const score = calculateTrackSimilarity(spotifyTrack, liveCandidate);
    expect(score).toBeLessThan(0.8);
  });

  it('still matches when both have the same version marker', () => {
    const spotifyTrack: SpotifyTrack = {
      id: 'sp5',
      name: 'Some Song (Remix)',
      uri: 'spotify:track:sp5',
      artists: [{ id: 'a1', name: 'Some Artist' }],
      album: { id: 'al1', name: 'Some Album' },
      duration_ms: 200000,
      external_ids: {},
    };
    const remixCandidate: NavidromeSong = {
      id: 'nd5',
      title: 'Some Song (Remix)',
      artist: 'Some Artist',
      album: 'Some Album',
      duration: 200,
    };
    const score = calculateTrackSimilarity(spotifyTrack, remixCandidate);
    expect(score).toBeGreaterThan(0.8);
  });
});

describe('hasVersionMismatch', () => {
  it('detects mismatch when one has remix and other does not', () => {
    expect(hasVersionMismatch('Song', 'Song (Remix)')).toBe(true);
    expect(hasVersionMismatch('Song (Remix)', 'Song')).toBe(true);
  });

  it('detects no mismatch when both lack version markers', () => {
    expect(hasVersionMismatch('Song', 'Song')).toBe(false);
  });

  it('detects no mismatch when both have same version marker', () => {
    expect(hasVersionMismatch('Song (Remix)', 'Song (Remix)')).toBe(false);
  });

  it('detects mismatch when versions differ (remix vs live)', () => {
    expect(hasVersionMismatch('Song (Remix)', 'Song (Live)')).toBe(true);
  });

  it('does not false-positive on titles without version markers in parentheses', () => {
    expect(hasVersionMismatch('Live Your Life', 'Live Your Life')).toBe(false);
  });
});
