const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { extractVisibleRows, parseDuration, normalizeRow, TrackCollector } = require('./dom');
const { canonicalPlaylistUrl, parseExpectedCount } = require('./validation');
const { readPage } = require('./collect');
const { handler, withTimeout, WorkerTimeoutError } = require('./server');
const http = require('node:http');

const id = '1Y81del2NT6OMjKvhzq9uW';
const row = (position, trackId, name, artists, album, duration) => `
<div data-testid="tracklist-row"><div role="gridcell">${position}</div>
<div role="gridcell"><a href="/track/${trackId}">${name}</a>${artists.map(a => `<a href="/artist/0000000000000000000000">${a}</a>`).join('')}</div>
<div role="gridcell"><a href="/album/0000000000000000000000">${album}</a></div>
<div role="gridcell">Sep 1, 2026</div><div role="gridcell">${duration}</div></div>`;

test('parses Chinese titles, multiple artists, album, duration and track URL', () => {
  const html = row(101, '4RcSMQhxprw2Zmv2fFsdi2', '更堅固 (Stronger)', ['Hillsong 華語', 'Joshua Band'], 'Global Project 華語', '4:20');
  const document = new JSDOM(html).window.document;
  const parsed = normalizeRow(extractVisibleRows([...document.querySelectorAll('[data-testid="tracklist-row"]')])[0], 126);
  assert.deepEqual(parsed, {
    position: 101, id: '4RcSMQhxprw2Zmv2fFsdi2', name: '更堅固 (Stronger)',
    artists: ['Hillsong 華語', 'Joshua Band'], album: 'Global Project 華語',
    duration_ms: 260000, url: 'https://open.spotify.com/track/4RcSMQhxprw2Zmv2fFsdi2',
  });
  assert.equal(parseDuration('1:02:03'), 3723000);
  assert.equal(parseDuration('4:60'), null);
});

test('deduplicates overlapping virtual windows and retains playlist order', () => {
  const document = new JSDOM(row(2, '4RcSMQhxprw2Zmv2fFsdi2', '更堅固', ['Hillsong 華語'], '專輯', '4:20') +
    row(1, '0yPy2W5TDenzATj1CTuYPN', '基督是我滿足', ['Joshua Band'], '點燃', '5:15')).window.document;
  const rows = extractVisibleRows([...document.querySelectorAll('[data-testid="tracklist-row"]')]);
  const collector = new TrackCollector(2);
  collector.add(rows);
  collector.add(rows);
  assert.equal(collector.size, 2);
  assert.deepEqual(collector.result().map(track => track.name), ['基督是我滿足', '更堅固']);
});

test('rejects missing rows, changed positions, and unexpected DOM', () => {
  const collector = new TrackCollector(2);
  collector.add([{ position: 1, name: '歌', artists: ['歌手'], trackUrl: '/track/0yPy2W5TDenzATj1CTuYPN', duration: '2:00' }]);
  assert.throws(() => collector.result(), /expected 2 tracks, collected 1/);
  assert.throws(() => collector.add([{ position: 1, name: '另一首', artists: ['歌手'], trackUrl: '/track/5grU5YzRr8G1jrkuQl47I2', duration: '2:00' }]), /changed track/);
  assert.throws(() => normalizeRow({ position: 1, name: '', artists: [], trackUrl: '', duration: '' }, 2), /invalid metadata/);
});

test('uses a metadata identity when a public track URL is absent', () => {
  const collector = new TrackCollector(1);
  const row = { position: 1, name: '無連結歌曲', artists: ['歌手'], trackUrl: '', duration: '' };
  collector.add([row, row]);
  assert.equal(collector.size, 1);
  assert.deepEqual(collector.result()[0], { id: null, name: '無連結歌曲', artists: ['歌手'], album: '', duration_ms: 0 });
});

test('accepts only public Spotify playlist URLs or IDs', () => {
  const expected = `https://open.spotify.com/playlist/${id}`;
  for (const input of [id, expected, `${expected}?si=abc`]) {
    assert.equal(canonicalPlaylistUrl(input), expected);
  }
  for (const bad of [`http://open.spotify.com/playlist/${id}`, `https://evil.test/playlist/${id}`,
    `https://open.spotify.com.evil.test/playlist/${id}`, `https://open.spotify.com/track/${id}`,
    `https://open.spotify.com/playlist/${id}#x`, `[${expected}](${expected})`]) {
    assert.throws(() => canonicalPlaylistUrl(bad));
  }
  assert.equal(parseExpectedCount('Henry Zheng • 126 songs, about 13 hr'), 126);
});

test('browser navigation receives only the canonical URL', async () => {
  const expected = `https://open.spotify.com/playlist/${id}`;
  for (const input of [id, expected, `${expected}?si=abc`]) {
    let navigatedTo;
    const page = { goto: async (url) => { navigatedTo = url; throw new Error('stop before network'); } };
    await assert.rejects(readPage(page, input, 1000), /stop before network/);
    assert.equal(navigatedTo, expected);
  }
  let called = false;
  await assert.rejects(readPage({ goto: () => { called = true; } }, `[${expected}](${expected})`, 1000));
  assert.equal(called, false);
});

test('HTTP endpoint rejects malformed playlist URLs', async () => {
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/playlist`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://evil.test/playlist/' + id }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Only public/);
    const tokenResponse = await fetch(`http://127.0.0.1:${server.address().port}/playlist`, {
      method: 'POST', headers: { Authorization: 'Bearer forbidden', 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: id }),
    });
    assert.equal(tokenResponse.status, 400);
  } finally { server.close(); }
});

test('browser work has a bounded timeout', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 5), WorkerTimeoutError);
});
