'use strict';
const http = require('node:http');
const { chromium } = require('playwright');
const { canonicalPlaylistUrl } = require('./validation');
const { readPage } = require('./collect');

class WorkerTimeoutError extends Error {}
const port = Number(process.env.PORT) || 8787;
const host = process.env.BIND_HOST || '127.0.0.1';
const configuredTimeout = Number(process.env.SPOTIFY_BROWSER_WORKER_TIMEOUT_MS);
const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout >= 10_000 && configuredTimeout <= 180_000
  ? configuredTimeout : 75_000;
let browser;
let active = false;

function withTimeout(work, milliseconds) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new WorkerTimeoutError(`Spotify public page extraction timed out after ${milliseconds}ms`)), milliseconds);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function readBody(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 4096) throw new Error('Request body is too large');
  }
  try { return JSON.parse(text); } catch { throw new Error('Invalid JSON body'); }
}

async function extract(url) {
  const context = await browser.newContext({
    locale: 'en-US', viewport: { width: 1400, height: 950 },
    serviceWorkers: 'block', acceptDownloads: false,
  });
  try {
    // No caller state is loaded; strip even Spotify's anonymous cookies.
    await context.route('**/*', (route) => {
      const request = route.request();
      if (request.resourceType() === 'media' || /\/mp3-preview\/|\.(?:mp3|m4a)(?:\?|$)/i.test(request.url())) {
        return route.abort();
      }
      const headers = { ...request.headers() };
      delete headers.cookie;
      return route.continue({ headers });
    });
    const page = await context.newPage();
    return await withTimeout(readPage(page, url, timeoutMs), timeoutMs);
  } finally {
    await context.close().catch(() => {});
  }
}

async function handler(req, res) {
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/playlist') return json(res, 404, { error: 'Not found' });
  if (req.headers.cookie || req.headers.authorization) {
    return json(res, 400, { error: 'Caller cookies and authorization are not accepted' });
  }
  if (active) return json(res, 503, { error: 'Spotify browser worker is busy; retry shortly' });
  let url;
  try {
    const body = await readBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !Object.hasOwn(body, 'url')) {
      throw new Error('Only a public playlist URL is accepted');
    }
    url = canonicalPlaylistUrl(body.url);
  }
  catch (error) { return json(res, 400, { error: error.message }); }
  active = true;
  try { return json(res, 200, await extract(url)); }
  catch (error) {
    const status = error instanceof WorkerTimeoutError ? 504 : /extraction incomplete/.test(error.message) ? 422 : 502;
    return json(res, status, { error: error.message });
  } finally { active = false; }
}

async function main() {
  browser = await chromium.launch({
    headless: true, chromiumSandbox: false,
    ...(process.env.SPOTIFY_BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.SPOTIFY_BROWSER_EXECUTABLE_PATH } : {}),
    ...(process.env.SPOTIFY_BROWSER_PROXY ? { proxy: { server: process.env.SPOTIFY_BROWSER_PROXY } } : {}),
  });
  const server = http.createServer((req, res) => { handler(req, res).catch((error) => json(res, 500, { error: error.message })); });
  server.listen(port, host, () => console.log(`Spotify browser worker listening on ${host}:${port}`));
  const shutdown = () => server.close(() => browser.close().catch(() => {}));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

if (require.main === module) main().catch((error) => { console.error('Spotify browser worker failed to start:', error.message); process.exitCode = 1; });
module.exports = { readBody, extract, handler, WorkerTimeoutError, withTimeout };
