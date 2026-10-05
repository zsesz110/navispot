import { canonicalizeChinese } from './chinese-normalize';
import { canonicalArtistIdentity } from './artist-aliases';
import { artistIdentities } from './artist-components';
import { areVerifiedTitleAliases } from './title-aliases';
import { comparisonTitle, isMedley, medleyComponents, titleVariants } from './title-variants';

export { stripTitleSuffix } from './title-search';

export interface FuzzyMatchOptions {
  threshold?: number;
  songCount?: number;
}

export interface FuzzyMatchResult {
  song: import('@/types/navidrome').NavidromeSong;
  score: number;
  details?: {
    durationDiff: number;
    albumSimilarity: number;
  };
}

export interface FuzzyMatchCandidateResult {
  matches: FuzzyMatchResult[];
  hasAmbiguous: boolean;
  bestMatch?: FuzzyMatchResult;
}

export interface TrackScoreDetails {
  titleSimilarity: number;
  artistSimilarity: number;
  albumSimilarity: number;
  durationSimilarity: number;
  durationDiffMs: number;
  versionPenalty: number;
  finalScore: number;
  rejectionReason?: string;
}

export function normalizeString(str: string): string {
  return canonicalizeChinese(str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an)\s+/, '')).normalize('NFC');
}

export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);

  if (normalized1 === normalized2) return 1.0;

  const maxLength = Math.max(normalized1.length, normalized2.length);
  if (maxLength === 0) return 1.0;

  const distance = levenshteinDistance(normalized1, normalized2);
  return 1.0 - distance / maxLength;
}

export function calculateArtistSimilarity(
  spotifyArtist: string,
  navidromeArtist: string
): number {
  const normalizedSpotify = normalizeArtistName(spotifyArtist);
  const normalizedNavidrome = normalizeArtistName(navidromeArtist);

  if (!normalizedSpotify || !normalizedNavidrome) return 0;
  if (canonicalArtistIdentity(normalizedSpotify) === canonicalArtistIdentity(normalizedNavidrome)) return 1.0;

  const maxLength = Math.max(normalizedSpotify.length, normalizedNavidrome.length);
  if (maxLength === 0) return 1.0;

  const distance = levenshteinDistance(normalizedSpotify, normalizedNavidrome);
  return 1.0 - distance / maxLength;
}

export function calculateBestArtistSimilarity(
  spotifyArtists: string[],
  navidromeArtist: string
): number {
  const localIdentities = artistIdentities([navidromeArtist]);
  if (artistIdentities(spotifyArtists).some((identity) => localIdentities.includes(identity))) return 1;
  let best = 0;
  for (const artist of spotifyArtists.flatMap((name) => name.split(/\s*,\s*|\s+&\s+|\s+(?:feat\.?|with)\s+/iu))) {
    const score = calculateArtistSimilarity(artist, navidromeArtist);
    if (score > best) best = score;
    if (best === 1.0) break;
  }
  return best;
}

export function calculateDurationSimilarity(
  spotifyDurationMs: number,
  navidromeDurationSeconds: number
): number {
  const navidromeDurationMs = navidromeDurationSeconds * 1000;
  const diff = Math.abs(spotifyDurationMs - navidromeDurationMs);

  if (!Number.isFinite(diff) || spotifyDurationMs <= 0 || navidromeDurationSeconds <= 0) return 0;
  if (diff <= 5_000) return 1 - diff / 50_000;
  if (diff <= 15_000) return 0.9 - (diff - 5_000) / 50_000;
  return Math.max(0, 0.7 - (diff - 15_000) / 85_714.2857);
}

const SOUNDTRACK_WORDS = [
  'original', 'sound', 'track', 'ost', ' soundtrack', 'score',
  'complete', 'vol', 'volume', ' disc ', 'disk'
];

export function normalizeAlbumName(album: string): string {
  let normalized = album.toLowerCase()
    .replace(/[（(]\s*(?:儿童)?敬拜赞美专辑\s*\d+\s*[）)]/gu, ' ')
    .replace(/[（(]\s*(?:兒童)?敬拜讚美專輯\s*\d+\s*[）)]/gu, ' ');
  for (const word of SOUNDTRACK_WORDS) {
    normalized = normalized.replace(new RegExp(word, 'gi'), ' ');
  }
  normalized = normalizeString(normalized);
  return normalized.replace(/\s+/g, ' ').trim();
}

const FEATURED_ARTIST_PATTERN = /[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+[^\)\]]*[\)\]]/gi;

export function normalizeTitle(title: string): string {
  let normalized = title.toLowerCase().replace(/^(?:組曲|组曲)\s*[:：]\s*/u, '');
  // Remove parenthetical/bracket groups containing featured artists
  // e.g. "(feat. Kehlani & Lil Yachty)", "[ft. Someone]"
  normalized = normalized.replace(FEATURED_ARTIST_PATTERN, ' ');
  normalized = normalizeString(comparisonTitle(normalized));
  return normalized.replace(/\s+/g, ' ').trim();
}

const COLLABORATION_INDICATORS_AMBIGUOUS = /\s+[xX]\s+|\s+&\s+|\s+and\s+/g;

export function normalizeArtistName(artist: string): string {
  let normalized = artist.toLowerCase();
  // Strip clear collaboration indicators and everything after them
  // e.g. "Kendrick Lamar feat. SZA" → "kendrick lamar"
  normalized = normalized.replace(/\s+(?:feat\.?|ft\.?|featuring|with|vs\.?|versus|presents?\.?|presenting|prod\.?|produced by)\s.*$/gi, '');
  // Remove ambiguous collaboration indicators (keep surrounding text)
  normalized = normalized.replace(COLLABORATION_INDICATORS_AMBIGUOUS, ' ');
  // Remove "DJ " prefix
  normalized = normalized.replace(/^dj\s+/gi, '');
  normalized = normalizeString(normalized);
  return normalized.replace(/\s+/g, ' ').trim();
}

export function calculateAlbumSimilarity(
  spotifyAlbum: string,
  navidromeAlbum: string
): number {
  const normalizedSpotify = normalizeAlbumName(spotifyAlbum);
  const normalizedNavidrome = normalizeAlbumName(navidromeAlbum);

  if (normalizedSpotify === normalizedNavidrome) return 1.0;

  const spotifyParts = normalizedSpotify.split(' ').filter(p => p.length > 0);
  const navidromeParts = normalizedNavidrome.split(' ').filter(p => p.length > 0);

  if (spotifyParts.length === 0 || navidromeParts.length === 0) return 0;

  const matchingParts = spotifyParts.filter(part =>
    navidromeParts.some(nPart => part === nPart ||
      (Math.min(part.length, nPart.length) >= 3 && (nPart.includes(part) || part.includes(nPart))))
  );

  const similarity = matchingParts.length / Math.max(spotifyParts.length, navidromeParts.length);
  return similarity;
}

export function calculateTitleSimilarity(
  spotifyTitle: string,
  navidromeTitle: string
): number {
  if (isMedley(spotifyTitle) !== isMedley(navidromeTitle)) return 0;
  if (isMedley(spotifyTitle)) {
    const left = medleyComponents(spotifyTitle);
    const right = medleyComponents(navidromeTitle);
    return left.length === right.length && left.every((part, index) => part === right[index]) ? 1 : 0;
  }
  if (areVerifiedTitleAliases(spotifyTitle, navidromeTitle)) return 1;
  const leftVariants = titleVariants(spotifyTitle).map(normalizeTitle);
  const rightVariants = titleVariants(navidromeTitle).map(normalizeTitle);
  if (leftVariants.some((left) => left && rightVariants.includes(left))) return 1;
  const normalizedSpotify = normalizeTitle(spotifyTitle);
  const normalizedNavidrome = normalizeTitle(navidromeTitle);

  if (normalizedSpotify === normalizedNavidrome) {
    return 1.0;
  }

  const maxLength = Math.max(normalizedSpotify.length, normalizedNavidrome.length);
  if (maxLength === 0) return 0;

  const distance = levenshteinDistance(normalizedSpotify, normalizedNavidrome);
  return 1.0 - distance / maxLength;
}

const VERSION_KEYWORDS = /\b(?:remix|rmxx|acoustic|instrumental|radio\s*edit|extended|dub|vip|rework|bootleg|karaoke|demo|unplugged|stripped|live|mix|edit|cover)\b/gi;
const CHINESE_VERSION_KEYWORDS = /伴奏|純音樂|纯音乐|現場|现场|演唱會|演唱会/gu;

function addVersionMarkers(fragment: string, markers: Set<string>): void {
  for (const match of fragment.match(VERSION_KEYWORDS) ?? []) markers.add(match.toLowerCase());
  for (const match of fragment.match(CHINESE_VERSION_KEYWORDS) ?? []) {
    markers.add(/伴奏|音乐|音樂/u.test(match) ? 'instrumental' : 'live');
  }
}

export function extractVersionMarkers(title: string): Set<string> {
  const markers = new Set<string>();
  const groups = title.match(/[\(\[][^\)\]]*[\)\]]/g) || [];
  for (const group of groups) {
    addVersionMarkers(group, markers);
  }
  for (const group of title.match(/[（【][^）】]*[）】]/gu) ?? []) addVersionMarkers(group, markers);
  const dashParts = title.split(/[-–—]/);
  if (dashParts.length > 1) {
    for (let i = 1; i < dashParts.length; i++) {
      addVersionMarkers(dashParts[i], markers);
    }
  }
  return markers;
}

export function hasVersionMismatch(spotifyTitle: string, navidromeTitle: string): boolean {
  const spotifyMarkers = extractVersionMarkers(spotifyTitle);
  const navidromeMarkers = extractVersionMarkers(navidromeTitle);

  if (spotifyMarkers.size === 0 && navidromeMarkers.size === 0) return false;
  if (spotifyMarkers.size === 0 || navidromeMarkers.size === 0) return true;

  for (const m of spotifyMarkers) {
    if (navidromeMarkers.has(m)) return false;
  }
  return true;
}

export function calculateTrackSimilarity(
  spotifyTrack: import('@/types/spotify').SpotifyTrack,
  navidromeSong: import('@/types/navidrome').NavidromeSong
): number {
  return calculateTrackScoreDetails(spotifyTrack, navidromeSong).finalScore;
}

export function calculateTrackScoreDetails(
  spotifyTrack: import('@/types/spotify').SpotifyTrack,
  navidromeSong: import('@/types/navidrome').NavidromeSong
): TrackScoreDetails {
  const hasSpotifyArtist = spotifyTrack.artists && spotifyTrack.artists.length > 0;
  const hasSpotifyAlbum = spotifyTrack.album && spotifyTrack.album.name && spotifyTrack.album.name.length > 0;

  const artistSimilarity = hasSpotifyArtist
    ? calculateBestArtistSimilarity(
        spotifyTrack.artists.map((a) => a.name),
        navidromeSong.artist
      )
    : -1;

  const titleSimilarity = calculateTitleSimilarity(
    spotifyTrack.name,
    navidromeSong.title
  );

  const durationSimilarity = calculateDurationSimilarity(
    spotifyTrack.duration_ms,
    navidromeSong.duration
  );

  const albumSimilarity = hasSpotifyAlbum
    ? calculateAlbumSimilarity(spotifyTrack.album.name, navidromeSong.album)
    : -1;

  let availableWeight = 0;
  let weightedSum = 0;

  if (artistSimilarity >= 0) {
    weightedSum += artistSimilarity * 0.25;
    availableWeight += 0.25;
  }
  weightedSum += titleSimilarity * 0.35;
  availableWeight += 0.35;
  weightedSum += durationSimilarity * 0.25;
  availableWeight += 0.25;

  if (albumSimilarity >= 0) {
    weightedSum += albumSimilarity * 0.15;
    availableWeight += 0.15;
  }

  let baseSimilarity = availableWeight > 0 ? weightedSum / availableWeight : titleSimilarity;

  if (titleSimilarity === 1.0 && (artistSimilarity < 0 || artistSimilarity >= 0.6)) {
    let overrideWeight = 0.4 + 0.3; // title + duration are always available
    let overrideSum = titleSimilarity * 0.4 + durationSimilarity * 0.3;
    if (artistSimilarity >= 0) {
      overrideWeight += 0.2;
      overrideSum += artistSimilarity * 0.2;
    }
    if (albumSimilarity >= 0) {
      overrideWeight += 0.1;
      overrideSum += albumSimilarity * 0.1;
    }
    baseSimilarity = overrideSum / overrideWeight;
  }

  if (durationSimilarity >= 0.9 && (artistSimilarity < 0 || artistSimilarity >= 0.6)) {
    baseSimilarity = Math.max(baseSimilarity, Math.min(baseSimilarity + 0.1, 0.95));
  }

  if (albumSimilarity >= 0.8 && titleSimilarity >= 0.6 && (artistSimilarity < 0 || artistSimilarity >= 0.6)) {
    baseSimilarity = Math.max(baseSimilarity, Math.min(baseSimilarity + 0.05, 0.95));
  }

  let rejectionReason: string | undefined;
  // Artist gate: reject candidates with significantly different artists
  if (artistSimilarity >= 0 && artistSimilarity < 0.6) {
    baseSimilarity = Math.min(baseSimilarity, 0.5);
    rejectionReason = 'artist mismatch';
  }

  if (isMedley(spotifyTrack.name) !== isMedley(navidromeSong.title)) {
    baseSimilarity = Math.min(baseSimilarity, 0.5);
    rejectionReason = 'medley mismatch';
  }
  if (isMedley(spotifyTrack.name) && isMedley(navidromeSong.title) && titleSimilarity === 0) {
    baseSimilarity = Math.min(baseSimilarity, 0.5);
    rejectionReason = 'medley component mismatch';
  }
  if (/(?:演奏专辑|演奏專輯|伴奏|伴唱曲)/u.test(navidromeSong.album) &&
      !/(?:演奏专辑|演奏專輯|伴奏|伴唱曲)/u.test(spotifyTrack.album?.name ?? '')) {
    baseSimilarity = Math.min(baseSimilarity, 0.5);
    rejectionReason = 'instrumental album mismatch';
  }
  if (/\blive\b|現場|现场/iu.test(spotifyTrack.album?.name ?? '') &&
      !/\blive\b|現場|现场/iu.test(navidromeSong.album)) {
    baseSimilarity = Math.min(baseSimilarity, 0.5);
    rejectionReason = 'live album mismatch';
  }

  // Version mismatch penalty: reject different versions (remix vs original, live vs original, etc.)
  let versionPenalty = 0;
  if (hasVersionMismatch(spotifyTrack.name, navidromeSong.title)) {
    versionPenalty = Math.max(0, baseSimilarity - 0.5);
    baseSimilarity = Math.min(baseSimilarity, 0.5);
    rejectionReason = 'version mismatch';
  }

  return {
    titleSimilarity, artistSimilarity, albumSimilarity, durationSimilarity,
    durationDiffMs: Math.abs(spotifyTrack.duration_ms - navidromeSong.duration * 1000),
    versionPenalty, finalScore: baseSimilarity, rejectionReason,
  };
}

export function findBestMatch(
  spotifyTrack: import('@/types/spotify').SpotifyTrack,
  candidates: import('@/types/navidrome').NavidromeSong[],
  threshold: number = 0.8
): FuzzyMatchCandidateResult {
  if (candidates.length === 0) {
    return { matches: [], hasAmbiguous: false };
  }

  const scoredMatches: FuzzyMatchResult[] = candidates
    .map((song) => {
      const albumSim = spotifyTrack.album?.name
        ? calculateAlbumSimilarity(spotifyTrack.album.name, song.album)
        : -1;
      const score = calculateTrackSimilarity(spotifyTrack, song);

      return {
        song,
        score,
        details: {
          durationDiff: Math.abs(spotifyTrack.duration_ms - song.duration * 1000),
          albumSimilarity: albumSim,
        }
      };
    })
    .filter((match) => match.score >= threshold)
    .sort((a, b) => b.score - a.score);

  if (scoredMatches.length === 0) {
    return { matches: [], hasAmbiguous: false };
  }

  const bestScore = scoredMatches[0].score;
  const thresholdMatches = scoredMatches.filter(
    (m) => m.score >= bestScore - 0.05
  );

  // When all top candidates are the same song (duplicates), it's not truly ambiguous
  const firstMatch = thresholdMatches[0];
  const allSameSong = thresholdMatches.length > 1 && thresholdMatches.every(
    (m) => normalizeTitle(m.song.title) === normalizeTitle(firstMatch.song.title) &&
      canonicalArtistIdentity(normalizeArtistName(m.song.artist)) ===
        canonicalArtistIdentity(normalizeArtistName(firstMatch.song.artist)) &&
      normalizeAlbumName(m.song.album) === normalizeAlbumName(firstMatch.song.album) &&
      Math.abs(m.song.duration - firstMatch.song.duration) <= 5
  );

  const hasAmbiguous = thresholdMatches.length > 1 && !allSameSong;

  return {
    matches: scoredMatches,
    hasAmbiguous,
    bestMatch: scoredMatches[0],
  };
}
