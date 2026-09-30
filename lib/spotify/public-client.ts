import type { SpotifyTrack } from '@/types/spotify';
import type { ImportedPlaylist } from '@/types/public-playlist';
import { normalizeEntries } from './track-identity';

const REQUEST_TIMEOUT_MS = 15_000;
const EMBED_TRACK_LIMIT = 100;
const USER_AGENT = 'NaviSpot/1.0 (public playlist metadata import; no Spotify login)';

interface EmbedTrack {
  uri?: unknown;
  title?: unknown;
  subtitle?: unknown;
  duration?: unknown;
  entityType?: unknown;
}

interface EmbedEntity {
  type?: unknown;
  id?: unknown;
  name?: unknown;
  title?: unknown;
  subtitle?: unknown;
  trackList?: unknown;
  coverArt?: { sources?: { url?: unknown }[] };
}

export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/playlist\/([A-Za-z0-9]{22})/);
  if (match) return match[1];
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed;
  return null;
}

class PublicPageError extends Error {
  status = 502;
}

function formatError(detail: string): PublicPageError {
  return new PublicPageError(`Spotify public playlist page format changed or is incomplete: ${detail}`);
}

export function parsePublicPlaylistHtml(html: string, playlistId: string): ImportedPlaylist {
  const script = html.match(/<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/i);
  if (!script) throw formatError('structured playlist data is missing');

  let entity: EmbedEntity;
  try {
    const state = JSON.parse(script[1]);
    entity = state.props.pageProps.state.data.entity as EmbedEntity;
  } catch {
    throw formatError('structured playlist data could not be read');
  }

  if (entity?.type !== 'playlist' || entity.id !== playlistId ||
      typeof entity.name !== 'string' || !entity.name.trim() ||
      !Array.isArray(entity.trackList)) {
    throw formatError('playlist identity, title, or track list is invalid');
  }

  // The public embed currently returns at most 100 tracks and has no public
  // pagination. Never claim a capped list is complete.
  if (entity.trackList.length >= EMBED_TRACK_LIMIT) {
    throw new PublicPageError(
      `Spotify's public embed exposes at most ${EMBED_TRACK_LIMIT} tracks. This playlist may contain more; NaviSpot cannot safely import it in full from the public page.`,
    );
  }

  const tracks: SpotifyTrack[] = entity.trackList.map((item: EmbedTrack, index: number) => {
    if (!item || typeof item.title !== 'string' || !item.title.trim() ||
        typeof item.subtitle !== 'string' || !item.subtitle.trim() ||
        (item.entityType !== undefined && item.entityType !== 'track')) {
      throw formatError(`track ${index + 1} has missing or unsupported metadata`);
    }
    const id = typeof item.uri === 'string'
      ? /^spotify:track:([A-Za-z0-9]{22})$/.exec(item.uri)?.[1] ?? null
      : null;
    const artists = item.subtitle.split(/,\s*/u).map((name) => name.trim()).filter(Boolean)
      .map((name) => ({ id: null, name }));
    if (!artists.length) throw formatError(`track ${index + 1} has no artist`);
    return {
      id,
      name: item.title,
      artists,
      album: { id: null, name: '' },
      duration_ms: typeof item.duration === 'number' && Number.isFinite(item.duration) && item.duration >= 0
        ? item.duration : 0,
      external_ids: {},
      ...(id ? { external_urls: { spotify: `https://open.spotify.com/track/${id}` } } : {}),
    };
  });

  if (tracks.length === 0) throw formatError('no tracks were found');
  const imageUrl = entity.coverArt?.sources?.find((source) =>
    typeof source.url === 'string' && source.url.startsWith('https://'))?.url as string | undefined;

  return {
    id: playlistId,
    name: entity.name,
    owner: typeof entity.subtitle === 'string' ? entity.subtitle : '',
    trackCount: tracks.length,
    imageUrl,
    tracks,
    entries: normalizeEntries(tracks),
    nullTrackCount: 0,
    importedAt: new Date().toISOString(),
  };
}

export async function getPublicPlaylist(playlistId: string): Promise<ImportedPlaylist> {
  const response = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (response.status === 404) {
    const error = new Error('Spotify playlist is private or unavailable') as Error & { status: number };
    error.status = 404;
    throw error;
  }
  if (!response.ok) throw new PublicPageError(`Spotify public page request failed (${response.status})`);
  return parsePublicPlaylistHtml(await response.text(), playlistId);
}
