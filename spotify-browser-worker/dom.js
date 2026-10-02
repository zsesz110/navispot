'use strict';

// This function runs inside the public Spotify page. Keep it self-contained so
// Playwright can serialize it; data-testid, roles and public links are the only
// selectors tied to Spotify's current DOM.
function extractVisibleRows(elements) {
  return elements.map((row) => {
    const cells = [...row.querySelectorAll('[role="gridcell"]')];
    const titleLink = row.querySelector('a[href^="/track/"]');
    const artists = [...(cells[1]?.querySelectorAll('a[href^="/artist/"]') || [])]
      .map((link) => link.textContent.trim()).filter(Boolean);
    const albumLink = cells[2]?.querySelector('a[href^="/album/"]');
    return {
      position: Number(cells[0]?.textContent.trim()),
      name: titleLink?.textContent.trim() || '',
      trackUrl: titleLink?.getAttribute('href') || '',
      artists,
      album: albumLink?.textContent.trim() || '',
      duration: cells[4]?.textContent.trim() || '',
    };
  });
}

function parseDuration(value) {
  if (!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const parts = value.split(':').map(Number);
  if (parts.slice(1).some((part) => part >= 60)) return null;
  return parts.reduce((total, part) => total * 60 + part, 0) * 1000;
}

function normalizeRow(row, expected) {
  if (!Number.isSafeInteger(row.position) || row.position < 1 || row.position > expected ||
      !row.name || !Array.isArray(row.artists) || !row.artists.length ||
      row.artists.some((artist) => typeof artist !== 'string' || !artist.trim())) {
    throw new Error(`Spotify public page has invalid metadata at track position ${row.position || '?'}`);
  }
  const match = row.trackUrl ? /^\/track\/([A-Za-z0-9]{22})$/.exec(row.trackUrl) : null;
  if (row.trackUrl && !match) throw new Error(`Spotify public page has invalid track URL at position ${row.position}`);
  const duration_ms = row.duration ? parseDuration(row.duration) : 0;
  if (duration_ms === null) throw new Error(`Spotify public page has invalid duration at position ${row.position}`);
  return {
    position: row.position,
    id: match?.[1] || null,
    name: row.name,
    artists: row.artists,
    album: row.album || '',
    duration_ms,
    ...(match ? { url: `https://open.spotify.com/track/${match[1]}` } : {}),
  };
}

class TrackCollector {
  constructor(expected) {
    if (!Number.isSafeInteger(expected) || expected < 1 || expected > 10_000) {
      throw new Error('Spotify public page has an invalid playlist total');
    }
    this.expected = expected;
    this.rows = new Map();
  }

  add(visibleRows) {
    for (const raw of visibleRows) {
      const row = normalizeRow(raw, this.expected);
      const previous = this.rows.get(row.position);
      const identity = (track) => track.id || [track.name.trim().toLowerCase(),
        track.artists.map((artist) => artist.trim().toLowerCase()).join(','), track.duration_ms].join('|');
      if (previous && identity(previous) !== identity(row)) {
        throw new Error(`Spotify public page changed track at position ${row.position} during extraction`);
      }
      this.rows.set(row.position, row);
    }
  }

  get size() { return this.rows.size; }
  get lastPosition() { return Math.max(0, ...this.rows.keys()); }
  get complete() { return this.size === this.expected; }

  result() {
    if (!this.complete) throw new Error(`Spotify public page extraction incomplete: expected ${this.expected} tracks, collected ${this.size}`);
    const ordered = [];
    for (let position = 1; position <= this.expected; position++) {
      const row = this.rows.get(position);
      if (!row) throw new Error(`Spotify public page extraction incomplete: missing position ${position}`);
      const track = { ...row };
      delete track.position;
      ordered.push(track);
    }
    return ordered;
  }
}

module.exports = { extractVisibleRows, parseDuration, normalizeRow, TrackCollector };
