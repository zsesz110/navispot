'use strict';

function canonicalPlaylistUrl(input) {
  if (typeof input !== 'string') throw new Error('A public Spotify playlist URL or ID is required');
  const value = input.trim();
  if (/^[A-Za-z0-9]{22}$/.test(value)) return `https://open.spotify.com/playlist/${value}`;
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid Spotify playlist URL'); }
  if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' ||
      url.port || url.username || url.password || url.hash ||
      !/^\/playlist\/[A-Za-z0-9]{22}\/?$/.test(url.pathname)) {
    throw new Error('Only public open.spotify.com/playlist URLs are accepted');
  }
  return `https://open.spotify.com${url.pathname.replace(/\/$/, '')}`;
}

function playlistId(url) { return url.split('/').at(-1); }

function parseExpectedCount(text) {
  const match = /\b([\d,]+)\s+songs?\b/i.exec(text);
  if (!match) throw new Error('Spotify public page does not expose a playlist track total');
  const count = Number(match[1].replaceAll(',', ''));
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Spotify public page has an invalid playlist total');
  return count;
}

module.exports = { canonicalPlaylistUrl, playlistId, parseExpectedCount };
