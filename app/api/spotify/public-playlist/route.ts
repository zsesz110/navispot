import { NextRequest, NextResponse } from 'next/server';
import {
  extractPlaylistId,
  getPublicPlaylist,
} from '@/lib/spotify/public-client';
import type { PublicPlaylistError } from '@/types/public-playlist';

function err(body: PublicPlaylistError, status: number) {
  return NextResponse.json({ error: body }, { status });
}

export async function POST(req: NextRequest) {
  let body: { url?: unknown } | null;
  try {
    body = (await req.json()) as { url?: unknown } | null;
  } catch {
    return err({ code: 'invalid_url', message: 'Invalid JSON body' }, 400);
  }

  const id = extractPlaylistId(body?.url);
  if (!id) {
    return err(
      {
        code: 'invalid_url',
        message:
          "That doesn't look like a Spotify playlist URL. Expected something like https://open.spotify.com/playlist/...",
      },
      400,
    );
  }

  try {
    const playlist = await getPublicPlaylist(id);
    return NextResponse.json({ playlist });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 404) {
      return err(
        {
          code: 'private_or_missing',
          message:
            "This playlist is private or doesn't exist. Ask the owner to make it public, or log in with Spotify to export private playlists.",
        },
        404,
      );
    }
    if (status === 502) {
      return err(
        {
          code: 'spotify_error',
          message: e instanceof Error ? e.message : 'Spotify public page is unavailable',
          status: 502,
        },
        502,
      );
    }
    console.error('[public-playlist] unexpected error:', e);
    return err(
      {
        code: 'internal_error',
        message: e instanceof Error ? e.message : 'Unknown error',
      },
      500,
    );
  }
}
