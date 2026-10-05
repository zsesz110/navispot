'use strict';
const { extractVisibleRows, TrackCollector } = require('./dom');
const { canonicalPlaylistUrl, parseExpectedCount, playlistId } = require('./validation');

async function readPage(page, url, timeoutMs) {
  const targetUrl = canonicalPlaylistUrl(url);
  const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: Math.min(timeoutMs, 30_000) });
  if (response?.status() === 404) throw new Error('Spotify playlist is private or unavailable');
  if (!response?.ok()) throw new Error(`Spotify public page returned ${response?.status() || 'no response'}`);
  const list = page.locator('[data-testid="playlist-tracklist"]');
  await list.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 30_000) });
  const name = (await page.locator('[data-testid="entityTitle"]').innerText()).trim();
  const owner = (await page.locator('[data-testid="creator-link"]').first().innerText()).trim();
  const expected = parseExpectedCount(await page.locator('[data-testid="entity-header"]').innerText());
  if (!name || !owner) throw new Error('Spotify public page is missing playlist title or owner');
  const imageUrl = await page.locator('[data-testid="playlist-image"] img').first().getAttribute('src').catch(() => null);
  const collector = new TrackCollector(expected);
  let attempts = 0;
  let noProgress = 0;
  const maxAttempts = Math.max(20, Math.ceil(expected / 10) + 12);

  while (!collector.complete && attempts < maxAttempts && noProgress < 4) {
    const before = collector.size;
    collector.add(await list.locator('[data-testid="tracklist-row"]').evaluateAll(extractVisibleRows));
    if (collector.complete) break;
    if (collector.size > before) noProgress = 0;
    else noProgress++;
    const last = collector.lastPosition;
    const scroll = await list.evaluate((element) => {
      let node = element;
      while (node && !(node.scrollHeight > node.clientHeight + 100 &&
        ['auto', 'scroll'].includes(getComputedStyle(node).overflowY))) node = node.parentElement;
      if (!node) return null;
      const before = node.scrollTop;
      node.scrollTop += Math.max(500, node.clientHeight * 0.9);
      return { before, after: node.scrollTop };
    });
    attempts++;
    if (!scroll) throw new Error('Spotify public page scrolling container was not found');
    // Wait for a newly rendered position; a short timeout also covers rows
    // that were already in the DOM when the scroll completed.
    await page.waitForFunction((previous) => [...document.querySelectorAll('[data-testid="playlist-tracklist"] [data-testid="tracklist-row"]')]
      .some((row) => Number(row.querySelector('[role="gridcell"]')?.textContent.trim()) > previous), last,
      { timeout: 1800 }).catch(() => {});
  }
  collector.add(await list.locator('[data-testid="tracklist-row"]').evaluateAll(extractVisibleRows));
  if (!collector.complete) {
    throw new Error(`Spotify public page extraction incomplete: expected ${expected} tracks, collected ${collector.size}; scroll attempts ${attempts}; last position ${collector.lastPosition}`);
  }
  return {
    id: playlistId(targetUrl), name, owner, trackCount: expected,
    ...(imageUrl?.startsWith('https://') ? { imageUrl } : {}),
    tracks: collector.result(),
  };
}

module.exports = { readPage };
