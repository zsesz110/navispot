import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

afterEach(() => vi.unstubAllGlobals());

describe('public Spotify playlist input validation', () => {
  it.each([
    'bad-id',
    'https://example.com/playlist/1Y81del2NT6OMjKvhzq9uW',
    'https://open.spotify.com/track/1Y81del2NT6OMjKvhzq9uW',
    'https://open.spotify.com.evil.test/playlist/1Y81del2NT6OMjKvhzq9uW',
  ])('rejects %s before any network request', async (url) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const req = new NextRequest('http://localhost/api/spotify/public-playlist', {
      method: 'POST',
      body: JSON.stringify({ url }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('invalid_url');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
