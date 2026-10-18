#!/usr/bin/env node
/**
 * Browser check for server rendering and hydration.
 *
 * The unit tests and the packaging check render on the server in Node and hydrate
 * in jsdom; this is the one place where a real browser hydrates the markup a real
 * server produced. The page records its own console output in `window.__problems`
 * (`tools/install-check/react/src/main.tsx`), so React's mismatch warnings are
 * caught even though they happen while the application boots, before a probe could
 * install a listener.
 *
 *   · the served HTML already contains the widget (the server rendered it)
 *   · the client hydrated it and the flow is interactive (the queue arrived and
 *     pressing play starts playback), which only works if hydration attached to
 *     the server's markup
 *   · the page reported no hydration mismatch
 *
 *   node tools/check-hydration.mjs --dir .verify/react-19/dist --scope '#root'
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index]?.replace(/^--/, ''), process.argv[index + 1]);
}

const directory = resolve(process.cwd(), args.get('dir') ?? '.');
const urlPath = args.get('path') ?? '/';
const label = args.get('label') ?? directory.replace(`${root}/`, '');
/** The element the server rendered around the widget, so the probe stays inside it. */
const scope = args.get('scope') ?? 'body';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Serves the built page, falling back to `index.html`. */
async function serve(directory) {
  const server = createServer(async (request, response) => {
    const path = join(
      directory,
      decodeURIComponent(new URL(request.url, 'http://localhost').pathname),
    );
    let file = path;
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = join(file, 'index.html');
    } catch {
      file = join(directory, 'index.html');
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, {
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('not found');
    }
  });

  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { server, port: server.address().port };
}

const PROBE = `
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const deadline = Date.now() + 20000;
  const scope = document.querySelector(${JSON.stringify(scope)}) ?? document;
  const widget = () => scope.querySelector('.sn-root');
  const selects = () => scope.querySelectorAll('.sn-track-select');

  // The client has to load the queue the server could not: the rows appearing is
  // what proves hydration took over the server's markup.
  while (Date.now() < deadline && selects().length === 0) await sleep(100);

  const tracks = selects().length;
  const state = widget()?.getAttribute('data-sn-state') ?? null;

  // Pressing play has to reach the engine: a static server render would not move.
  widget()?.querySelector('.sn-play-button')?.click();
  while (Date.now() < deadline && widget()?.getAttribute('data-sn-playing') !== 'true') {
    await sleep(100);
  }

  return {
    tracks,
    state,
    playing: widget()?.getAttribute('data-sn-playing') ?? null,
    problems: (window.__problems ?? []).slice(0, 20),
  };
})()
`;

// The page has to have been rendered on the server: that is what makes the browser
// run a hydration rather than a first render.
const served = await readFile(join(directory, 'index.html'), 'utf8');
if (!/class="sn-root"/.test(served)) {
  console.error(`✗ ${label}: index.html does not contain server-rendered widget markup`);
  process.exit(1);
}

const { server, port } = await serve(directory);
const url = `http://127.0.0.1:${port}${urlPath}`;

const run = (argv) =>
  new Promise((done, fail) => {
    const child = spawn(process.execPath, argv, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', fail);
    child.on('close', (code) =>
      code === 0 ? done(stdout) : fail(new Error(`probe exited ${code}`)),
    );
  });

let report;
try {
  const stdout = await run([
    resolve(root, 'tools/screenshot.mjs'),
    '--url',
    url,
    '--width',
    '1200',
    '--height',
    '900',
    '--wait-for',
    '.sn-root',
    '--eval',
    PROBE,
  ]);
  report = JSON.parse(stdout);
} finally {
  server.close();
}

const failures = [];
if (report.tracks === 0) {
  failures.push('the hydrated widget listed no tracks: hydration did not take over');
}
if (report.playing !== 'true') {
  failures.push(`pressing play did not start playback (data-sn-playing=${report.playing})`);
}
const mismatches = report.problems.filter((line) =>
  /hydrat|did not match|mismatch|server rendered|server html/i.test(line),
);
if (mismatches.length > 0) {
  failures.push(`hydration reported problems:\n    ${mismatches.join('\n    ')}`);
}

console.log(`${label}:  ${report.tracks} tracks  ·  state ${report.state}  ·  playing ${report.playing}`);
if (report.problems.length > 0) {
  console.log(`  console: ${report.problems.length} message(s), none about hydration`);
}

if (failures.length > 0) {
  console.error(`\n✗ ${label}: hydration check failed:`);
  for (const failure of failures) console.error(`  · ${failure}`);
  process.exit(1);
}

console.log(`✓ ${label}: server markup hydrated in the browser and stayed interactive`);
