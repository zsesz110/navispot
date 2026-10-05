import { SpotifyTrack } from '@/types/spotify';
import { NavidromeSong, NavidromeNativeSong } from '@/types/navidrome';
import { TrackMatch, MatchStrategy, MatchStatus } from '@/types/matching';
import { NavidromeApiClient } from '@/lib/navidrome/client';
import { matchByStrict } from './strict-matcher';
import { findBestMatch, normalizeTitle, normalizeArtistName, calculateTrackScoreDetails } from './fuzzy';
import { canonicalArtistIdentity } from './artist-aliases';
import { canonicalizeChinese } from './chinese-normalize';
import { titleSearchQueries } from './title-search';
import { verifiedTitleAliases } from './title-aliases';
import { isMedley } from './title-variants';
import { trackKey as getTrackKey } from '@/lib/spotify/track-identity';

export interface MatchingOrchestratorOptions {
  enableISRC: boolean;
  enableFuzzy: boolean;
  enableStrict: boolean;
  fuzzyThreshold: number;
  maxSearchResults: number;
}

export const defaultMatchingOptions: MatchingOrchestratorOptions = {
  enableISRC: true,
  enableFuzzy: true,
  enableStrict: true,
  fuzzyThreshold: 0.8,
  maxSearchResults: 500,
};

export interface MatchingStrategyResult {
  strategy: MatchStrategy;
  matched: boolean;
  ambiguous: boolean;
  navidromeSong?: NavidromeSong;
  candidates?: NavidromeSong[];
  score: number;
}

export interface OrchestratedMatchResult {
  spotifyTrack: SpotifyTrack;
  strategyResults: MatchingStrategyResult[];
  finalMatch: MatchingStrategyResult;
  overallStatus: MatchStatus;
}

export function convertNativeSongToNavidromeSong(nativeSong: NavidromeNativeSong): NavidromeSong {
  return {
    id: nativeSong.id,
    title: nativeSong.title,
    artist: nativeSong.artist,
    album: nativeSong.album,
    duration: nativeSong.duration,
    isrc: nativeSong.tags?.isrc || nativeSong.isrc,
  };
}

function matchDebugEnabled(): boolean {
  if (process.env.NAVISPOT_MATCH_DEBUG === 'true') return true;
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem('NAVISPOT_MATCH_DEBUG') === 'true';
  } catch {
    return false;
  }
}

export async function matchTrack(
  client: NavidromeApiClient,
  spotifyTrack: SpotifyTrack,
  options: Partial<MatchingOrchestratorOptions> = {},
  signal?: AbortSignal
): Promise<TrackMatch> {
  if (!spotifyTrack || !spotifyTrack.name) {
    const tk = spotifyTrack ? getTrackKey(spotifyTrack) : 'unknown';
    console.warn("Invalid Spotify track encountered:", {
      track: spotifyTrack,
      hasName: spotifyTrack?.name ? true : false,
      id: spotifyTrack?.id,
      artists: spotifyTrack?.artists,
    });
    return {
      spotifyTrack: spotifyTrack || ({} as SpotifyTrack),
      navidromeSong: undefined,
      matchStrategy: "none",
      matchScore: 0,
      status: "unmatched",
      trackKey: tk,
    };
  }

  const trackTk = getTrackKey(spotifyTrack);

  const opts: MatchingOrchestratorOptions = { ...defaultMatchingOptions, ...options };
  const strategyResults: MatchingStrategyResult[] = [];

  const trackTitle = spotifyTrack.name;

  let candidates: NavidromeSong[] = [];
  let nativeCandidates: NavidromeNativeSong[] = [];

  nativeCandidates = await client.searchByTitle(trackTitle, opts.maxSearchResults, signal);

  // Only known semantic artist identities can scope a cross-language fallback.
  // Duration narrows retrieval; verified title evidence is still required to match.
  if (nativeCandidates.length === 0 && !isMedley(trackTitle)) {
    const artistNames = spotifyTrack.artists.map((artist) => artist.name);
    const catalogName = artistNames.some((name) => canonicalArtistIdentity(name) === 'stream-of-praise')
      ? '赞美之泉音乐事工'
      : artistNames.some((name) => canonicalArtistIdentity(name) === 'joshua-band')
        ? '约书亚乐团' : null;
    if (catalogName) {
      const aliases = verifiedTitleAliases(trackTitle);
      const artistSongs = await client.getCachedSongsByExactArtist(catalogName, signal);
      nativeCandidates = artistSongs.filter((song) =>
        Math.abs(song.duration - spotifyTrack.duration_ms / 1000) <= 8 &&
        aliases.some((alias) => normalizeTitle(alias) === normalizeTitle(song.title)));
    }
  }

  candidates = nativeCandidates.map(convertNativeSongToNavidromeSong);

  const finish = (match: TrackMatch): TrackMatch => {
    if (matchDebugEnabled()) {
      console.debug('[matching]', {
        spotify: { title: spotifyTrack.name, artists: spotifyTrack.artists.map((a) => a.name),
          album: spotifyTrack.album?.name, durationMs: spotifyTrack.duration_ms },
        search: { originalQuery: trackTitle, normalizedQuery: canonicalizeChinese(trackTitle),
          queries: titleSearchQueries(trackTitle), candidateCount: candidates.length },
        candidates: candidates.map((song) => {
          const scores = calculateTrackScoreDetails(spotifyTrack, song);
          return { title: song.title, artist: song.artist, album: song.album, duration: song.duration,
            scores, rejectionReason: scores.rejectionReason ??
              (scores.finalScore < opts.fuzzyThreshold ? 'below threshold' : undefined) };
        }),
        result: { status: match.status, strategy: match.matchStrategy, score: match.matchScore,
          songId: match.navidromeSong?.id },
      });
    }
    return match;
  };

  const spotifyDurationSec = spotifyTrack.duration_ms / 1000;

  if (opts.enableISRC && spotifyTrack.external_ids?.isrc) {
    const isrc = spotifyTrack.external_ids.isrc;
    const isrcMatch = candidates.find((song) => song.isrc?.includes(isrc));

    if (isrcMatch) {
      return finish({
        spotifyTrack,
        navidromeSong: isrcMatch,
        matchStrategy: 'isrc',
        matchScore: 1,
        status: 'matched',
        trackKey: trackTk,
      });
    }

    const normalizedSpotifyTitle = normalizeTitle(spotifyTrack.name);
    const normalizedSpotifyArtists = spotifyTrack.artists.map((a) =>
      normalizeArtistName(a.name)
    );

    const variantMatches = candidates.filter((song) => {
      if (normalizeTitle(song.title) !== normalizedSpotifyTitle) return false;

      const songArtist = canonicalArtistIdentity(normalizeArtistName(song.artist));
      const artistOverlaps = normalizedSpotifyArtists.some(
        (a) => {
          const identity = canonicalArtistIdentity(a);
          return identity === songArtist || songArtist.includes(identity) || identity.includes(songArtist);
        }
      );
      if (!artistOverlaps) return false;

      return Math.abs(song.duration - spotifyDurationSec) < 2;
    });

    if (variantMatches.length >= 1) {
      const allSameSong = variantMatches.every(
        (m) => m.title === variantMatches[0].title && m.artist === variantMatches[0].artist
      );

      if (variantMatches.length === 1 || allSameSong) {
        return finish({
          spotifyTrack,
          navidromeSong: variantMatches[0],
          matchStrategy: 'isrc',
          matchScore: 1,
          status: 'matched',
          trackKey: trackTk,
        });
      }
    }
  }

  if (opts.enableFuzzy) {
    const fuzzyResult = findBestMatch(spotifyTrack, candidates, opts.fuzzyThreshold);
    const matchResult: MatchingStrategyResult = {
      strategy: 'fuzzy',
      matched: fuzzyResult.bestMatch !== undefined,
      ambiguous: fuzzyResult.hasAmbiguous,
      navidromeSong: fuzzyResult.bestMatch?.song,
      candidates: fuzzyResult.matches.map((m) => m.song),
      score: fuzzyResult.bestMatch?.score ?? 0,
    };
    strategyResults.push(matchResult);

    if (fuzzyResult.bestMatch && !fuzzyResult.hasAmbiguous) {
      return finish({
        spotifyTrack,
        navidromeSong: fuzzyResult.bestMatch.song,
        matchStrategy: 'fuzzy',
        matchScore: fuzzyResult.bestMatch.score,
        status: 'matched',
        candidates: fuzzyResult.matches.map((m) => m.song),
        trackKey: trackTk,
      });
    }
  }

  if (opts.enableStrict) {
    const strictResult = await matchByStrict(client, spotifyTrack, nativeCandidates, signal);
    strategyResults.push({
      strategy: 'strict',
      matched: strictResult.status === 'matched',
      ambiguous: strictResult.status === 'ambiguous',
      navidromeSong: strictResult.navidromeSong,
      score: strictResult.matchScore,
    });

    if (strictResult.status === 'matched') {
      return finish({
        spotifyTrack,
        navidromeSong: strictResult.navidromeSong,
        matchStrategy: 'strict',
        matchScore: 1,
        status: 'matched',
        trackKey: trackTk,
      });
    }
  }

  const hasAmbiguous = strategyResults.some((r) => r.ambiguous);
  const bestResult = strategyResults.reduce(
    (best, current) => (current.score > best.score ? current : best),
    { score: -1 } as MatchingStrategyResult
  );

  return finish({
    spotifyTrack,
    navidromeSong: bestResult.navidromeSong,
    matchStrategy: bestResult.strategy,
    matchScore: bestResult.score > 0 ? bestResult.score : 0,
    status: hasAmbiguous ? 'ambiguous' : 'unmatched',
    candidates: bestResult.candidates,
    trackKey: trackTk,
  });
}

export async function matchTracks(
  client: NavidromeApiClient,
  spotifyTracks: SpotifyTrack[],
  options: Partial<MatchingOrchestratorOptions> = {},
  signal?: AbortSignal
): Promise<TrackMatch[]> {
  const results: TrackMatch[] = [];

  for (const track of spotifyTracks) {
    if (signal?.aborted) {
      throw new DOMException('Export was cancelled', 'AbortError');
    }

    try {
      const match = await matchTrack(client, track, options, signal);
      results.push(match);
    } catch (error) {
      console.error("Error matching track:", {
        track,
        error: error instanceof Error ? error.message : String(error),
      });
      results.push({
        spotifyTrack: track,
        navidromeSong: undefined,
        matchStrategy: "none",
        matchScore: 0,
        status: "unmatched",
        trackKey: getTrackKey(track),
      });
    }
  }

  return results;
}

export function getMatchStatistics(matches: TrackMatch[]): {
  total: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  byStrategy: Record<MatchStrategy, number>;
} {
  const stats = {
    total: matches.length,
    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    byStrategy: {
      isrc: 0,
      fuzzy: 0,
      strict: 0,
      none: 0,
    } as Record<MatchStrategy, number>,
  };

  for (const match of matches) {
    if (match.status === 'matched') {
      stats.matched++;
      stats.byStrategy[match.matchStrategy]++;
    } else if (match.status === 'ambiguous') {
      stats.ambiguous++;
    } else {
      stats.unmatched++;
    }
  }

  return stats;
}

export function getAmbiguousMatches(matches: TrackMatch[]): TrackMatch[] {
  return matches.filter((m) => m.status === 'ambiguous');
}

export function getUnmatchedTracks(matches: TrackMatch[]): SpotifyTrack[] {
  return matches
    .filter((m) => m.status === 'unmatched' || m.status === 'ambiguous')
    .map((m) => m.spotifyTrack);
}

export function getMatchedTracks(matches: TrackMatch[]): Array<{
  spotifyTrack: SpotifyTrack;
  navidromeSong: NavidromeSong;
  strategy: MatchStrategy;
}> {
  return matches
    .filter((m) => m.status === 'matched' && m.navidromeSong)
    .map((m) => ({
      spotifyTrack: m.spotifyTrack,
      navidromeSong: m.navidromeSong!,
      strategy: m.matchStrategy,
    }));
}
