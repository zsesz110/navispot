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

export class PublicPageError extends Error {
  status = 502;
}

export class IncompleteEmbedError extends PublicPageError {}

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
    throw new IncompleteEmbedError(
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
  try {
    return parsePublicPlaylistHtml(await response.text(), playlistId);
  } catch (error) {
    if (error instanceof IncompleteEmbedError) return getBrowserPlaylist(playlistId);
    throw error;
  }
}

interface BrowserWorkerTrack {
  id: string | null;
  name: string;
  artists: string[];
  album: string;
  duration_ms: number;
  url?: string;
}

interface BrowserWorkerPlaylist {
  id: string;
  name: string;
  owner: string;
  trackCount: number;
  imageUrl?: string;
  tracks: BrowserWorkerTrack[];
}

async function getBrowserPlaylist(playlistId: string): Promise<ImportedPlaylist> {
  const workerUrl = process.env.SPOTIFY_BROWSER_WORKER_URL;
  if (!workerUrl) {
    throw new PublicPageError('Spotify public embed is incomplete and the browser worker is not configured');
  }
  const configuredTimeout = Number(process.env.SPOTIFY_BROWSER_WORKER_TIMEOUT_MS);
  const timeout = Number.isFinite(configuredTimeout) && configuredTimeout >= 10_000 && configuredTimeout <= 180_000
    ? configuredTimeout : 75_000;
  let response: Response;
  try {
    response = await fetch(new URL('/playlist', workerUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `https://open.spotify.com/playlist/${playlistId}` }),
      signal: AbortSignal.timeout(timeout + 10_000),
      cache: 'no-store',
    });
  } catch (error) {
    throw new PublicPageError(`Spotify browser worker is unavailable: ${error instanceof Error ? error.message : 'request failed'}`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new PublicPageError(body?.error || `Spotify browser worker failed (${response.status})`);
  }
  const data = await response.json().catch(() => { throw new PublicPageError('Spotify browser worker returned invalid JSON'); }) as BrowserWorkerPlaylist;
  if (data?.id !== playlistId || typeof data.name !== 'string' || !data.name.trim() ||
      typeof data.owner !== 'string' || !Number.isSafeInteger(data.trackCount) ||
      data.trackCount < EMBED_TRACK_LIMIT || !Array.isArray(data.tracks) || data.tracks.length !== data.trackCount ||
      data.tracks.some((track) => !track || typeof track.name !== 'string' || !track.name.trim() ||
        typeof track.album !== 'string' || !Array.isArray(track.artists) ||
        !track.artists.length || track.artists.some((name) => typeof name !== 'string' || !name.trim()) ||
        !Number.isSafeInteger(track.duration_ms) || track.duration_ms < 0 ||
        (track.id !== null && !/^[A-Za-z0-9]{22}$/.test(track.id)))) {
    throw new PublicPageError('Spotify browser worker returned incomplete or invalid playlist metadata');
  }
  const tracks: SpotifyTrack[] = data.tracks.map((track) => ({
    id: track.id,
    name: track.name,
    artists: track.artists.map((name) => ({ id: null, name })),
    album: { id: null, name: track.album || '' },
    duration_ms: track.duration_ms,
    external_ids: {},
    ...(track.id ? { external_urls: { spotify: `https://open.spotify.com/track/${track.id}` } } : {}),
  }));
  return {
    id: playlistId,
    name: data.name,
    owner: data.owner || '',
    trackCount: tracks.length,
    imageUrl: data.imageUrl,
    tracks,
    entries: normalizeEntries(tracks),
    nullTrackCount: 0,
    importedAt: new Date().toISOString(),
  };
}
