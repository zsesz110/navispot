import { SpotifyTrack } from '@/types/spotify';
import { TrackMatch } from '@/types/matching';
import { NavidromeApiClient } from '@/lib/navidrome/client';
import { NavidromeNativeSong } from '@/types/navidrome';
import { convertNativeSongToNavidromeSong } from './orchestrator';
import { trackKey as getTrackKey } from '@/lib/spotify/track-identity';
import { normalizeString as normalizeStringFuzzy, normalizeTitle as normalizeTitleFuzzy, normalizeArtistName as normalizeArtistNameFuzzy, normalizeAlbumName, hasVersionMismatch } from './fuzzy';
import { canonicalArtistIdentity } from './artist-aliases';

const STRICT_DURATION_TOLERANCE_SECONDS = 15;

export function normalizeString(str: string): string {
  return normalizeStringFuzzy(str);
}

export function filterStrictMatches(
  songs: NavidromeNativeSong[],
  normalizedArtist: string | null,
  normalizedTitle: string,
  rawSpotifyTitle?: string
): NavidromeNativeSong[] {
  return songs.filter((song) => {
    const songTitle = normalizeTitleFuzzy(song.title);
    if (songTitle !== normalizedTitle) return false;
    if (normalizedArtist !== null) {
      const songArtist = normalizeArtistNameFuzzy(song.artist);
      if (canonicalArtistIdentity(songArtist) !== canonicalArtistIdentity(normalizedArtist)) return false;
    }
    if (rawSpotifyTitle && hasVersionMismatch(rawSpotifyTitle, song.title)) return false;
    return true;
  });
}

export async function matchByStrict(
  client: NavidromeApiClient,
  spotifyTrack: SpotifyTrack,
  candidates?: NavidromeNativeSong[],
  signal?: AbortSignal
): Promise<TrackMatch> {
  const tk = getTrackKey(spotifyTrack);
  const hasArtist = spotifyTrack.artists && spotifyTrack.artists.length > 0 && spotifyTrack.artists.some(a => a.name.trim().length > 0);
  const normalizedArtists = hasArtist
    ? spotifyTrack.artists.map((a) => normalizeArtistNameFuzzy(a.name)).filter(Boolean)
    : [];
  const normalizedTitle = normalizeTitleFuzzy(spotifyTrack.name);

  if (!normalizedTitle) {
    return {
      spotifyTrack,
      matchStrategy: 'strict',
      matchScore: 0,
      status: 'unmatched',
      trackKey: tk,
    };
  }

  try {
    const songs = candidates || await client.searchByTitle(spotifyTrack.name, 100, signal);
    const matches = songs.filter((song) => {
      const matchingArtist = normalizedArtists.length === 0 || normalizedArtists.some((artist) =>
        canonicalArtistIdentity(artist) === canonicalArtistIdentity(normalizeArtistNameFuzzy(song.artist)));
      const matchingDuration = spotifyTrack.duration_ms <= 0 || song.duration <= 0 ||
        Math.abs(song.duration - spotifyTrack.duration_ms / 1000) <= STRICT_DURATION_TOLERANCE_SECONDS;
      return matchingArtist && matchingDuration &&
        filterStrictMatches([song], null, normalizedTitle, spotifyTrack.name).length === 1;
    });

    if (matches.length === 0) {
      return {
        spotifyTrack,
        matchStrategy: 'strict',
        matchScore: 0,
        status: 'unmatched',
        trackKey: tk,
      };
    }

    if (matches.length > 1 && normalizedArtists.length === 0) {
      const spotifyDurationSec = spotifyTrack.duration_ms / 1000;
      const durationMatches = matches.filter(
        (s) => Math.abs(s.duration - spotifyDurationSec) < 2
      );
      if (durationMatches.length === 1) {
        return {
          spotifyTrack,
          navidromeSong: convertNativeSongToNavidromeSong(durationMatches[0]),
          matchStrategy: 'strict',
          matchScore: 1,
          status: 'matched',
          trackKey: tk,
        };
      }
      return {
        spotifyTrack,
        matchStrategy: 'strict',
        matchScore: 0,
        status: 'ambiguous',
        candidates: matches.map(convertNativeSongToNavidromeSong),
        trackKey: tk,
      };
    }

    const firstMatch = matches[0];
    const allSame = matches.every(
      (m) => normalizeTitleFuzzy(m.title) === normalizeTitleFuzzy(firstMatch.title) &&
        canonicalArtistIdentity(normalizeArtistNameFuzzy(m.artist)) ===
          canonicalArtistIdentity(normalizeArtistNameFuzzy(firstMatch.artist)) &&
        normalizeAlbumName(m.album) === normalizeAlbumName(firstMatch.album) &&
        Math.abs(m.duration - firstMatch.duration) <= 5
    );

    if (!allSame) {
      return {
        spotifyTrack,
        matchStrategy: 'strict',
        matchScore: 0,
        status: 'ambiguous',
        candidates: matches.map(convertNativeSongToNavidromeSong),
        trackKey: tk,
      };
    }

    return {
      spotifyTrack,
      navidromeSong: convertNativeSongToNavidromeSong(firstMatch),
      matchStrategy: 'strict',
      matchScore: 1,
      status: 'matched',
      trackKey: tk,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    return {
      spotifyTrack,
      matchStrategy: 'strict',
      matchScore: 0,
      status: 'unmatched',
      trackKey: tk,
    };
  }
}
