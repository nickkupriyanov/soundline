#!/usr/bin/env node
/**
 * Packaging check for every published package, in two consumer environments.
 *
 *   1. build + `pnpm pack` core and React (in that order — the binding copies
 *      the core stylesheet during its own build)
 *   2. build one scratch copy per leg in `.verify/`, each from a template in
 *      `tools/install-check/`: the shared application sources plus the manifest
 *      of that environment, with `file:` references to the tarballs that were
 *      packed
 *   3. `npm install` each copy with **its own npm cache**, so no leg can see
 *      another's tree
 *   4. prove the consumer can use what it installed, for `react-18` and
 *      `react-19`: `tsc --noEmit`, a production `vite build`, a server render
 *      plus client hydration in jsdom, and a hydration of the prerendered page
 *      in a real browser
 *
 * Along the way the packed manifests are asserted: the export map of each
 * package, the React package's dependency on core (resolved to a version, never
 * `workspace:`), `motion` staying an optional peer, and the tarball actually
 * shipping the README and the LICENSE its `files` array promises.
 *
 * The layouts and the pinned versions come from the templates in
 * `tools/install-check/`; the tarball names are derived from the manifests, never
 * hardcoded.
 *
 * Usage:
 *   node tools/verify-install.mjs                     # pack everything, run all legs
 *   node tools/verify-install.mjs --leg react-18      # one leg
 *   node tools/verify-install.mjs --tarballs .verify/tarballs
 *                                                     # use artifacts packed elsewhere
 *   node tools/verify-install.mjs --pack-only .verify/tarballs
 *                                                     # build, pack and stop
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templates = join(root, 'tools/install-check');
const verifyRoot = join(root, '.verify');

/** npm needs the executable; each leg gets its own cache inside its own copy. */
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/**
 * The legs. `manifest` names the directory under `tools/install-check/` that
 * carries the pinned versions; `template` names the shared application sources.
 */
const LEGS = [
  { name: 'react-18', template: 'react', manifest: 'react-18' },
  { name: 'react-19', template: 'react', manifest: 'react-19' },
];

const argv = process.argv.slice(2);
const option = (name) => {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
};

const onlyLeg = option('--leg');
const tarballDir = option('--tarballs');
const packOnly = option('--pack-only');

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

/** `@scope/name` at `version` → the file name `pnpm pack` produces. */
const tarballName = (name, version) => `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;

const step = (message) => console.log(`\n\u001b[1m▸ ${message}\u001b[0m`);

function run(command, args, cwd) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', env: process.env });
    child.on('error', fail);
    child.on('close', (code) =>
      code === 0 ? done() : fail(new Error(`${command} ${args.join(' ')} exited with ${code}`)),
    );
  });
}

function capture(command, args, cwd) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', fail);
    child.on('close', (code) =>
      code === 0 ? done(stdout) : fail(new Error(`${command} ${args.join(' ')}: ${stderr}`)),
    );
  });
}

/** Reads `package/package.json` out of a tarball without unpacking the rest. */
async function packedManifest(tarball) {
  return JSON.parse(
    await capture('tar', ['-xzOf', basename(tarball), 'package/package.json'], dirname(tarball)),
  );
}

/** Lists the entries of a tarball. */
async function packedEntries(tarball) {
  return (await capture('tar', ['-tzf', basename(tarball)], dirname(tarball)))
    .split('\n')
    .filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/*  Pack                                                                       */
/* -------------------------------------------------------------------------- */

/** Builds and packs the libraries; core first, because React copies its CSS. */
async function packLibraries() {
  const packed = [];

  for (const relativeDir of ['packages/core', 'packages/react']) {
    const packageDir = join(root, relativeDir);
    const manifest = await readJson(join(packageDir, 'package.json'));

    step(`build ${manifest.name}`);
    await run('pnpm', ['build'], packageDir);

    step(`pnpm pack ${manifest.name}`);
    for (const file of await readdir(packageDir)) {
      if (file.endsWith('.tgz')) await rm(join(packageDir, file));
    }
    await run('pnpm', ['pack'], packageDir);

    const produced = (await readdir(packageDir)).find((file) => file.endsWith('.tgz'));
    const expected = tarballName(manifest.name, manifest.version);
    if (produced !== expected) {
      throw new Error(`pnpm pack produced ${produced}, but this script expected ${expected}`);
    }
    packed.push({
      label: manifest.name,
      version: manifest.version,
      file: join(packageDir, produced),
    });
    console.log(`  → ${produced}`);
  }

  return packed;
}

/** Uses the tarballs an earlier job packed, instead of building them again. */
async function collectLibraries(dir) {
  const files = (await readdir(dir)).filter((file) => file.endsWith('.tgz'));
  const packed = [];

  for (const relativeDir of ['packages/core', 'packages/react']) {
    const manifest = await readJson(join(root, relativeDir, 'package.json'));
    const expected = tarballName(manifest.name, manifest.version);
    if (!files.includes(expected)) throw new Error(`${expected} is missing from ${dir}`);
    packed.push({ label: manifest.name, version: manifest.version, file: join(dir, expected) });
  }

  return packed;
}

/* -------------------------------------------------------------------------- */
/*  Manifest assertions                                                        */
/* -------------------------------------------------------------------------- */

/** A packed manifest must resolve its sibling package without the workspace protocol. */
async function assertPinned(label, tarball, dependency, version) {
  step(`assert the packed ${label} manifest resolves ${dependency}`);
  const manifest = await packedManifest(tarball);
  const pinned = manifest.dependencies?.[dependency];
  if (!pinned) throw new Error(`the packed ${label} manifest has no ${dependency} dependency`);
  if (pinned.includes('workspace:')) {
    throw new Error(`the tarball ships "${pinned}" — a clean app could not install it`);
  }
  const allowed = [version, `^${version}`, `~${version}`];
  if (!allowed.includes(pinned)) {
    throw new Error(
      `the packed ${label} manifest pins ${dependency} to "${pinned}", expected one of ${allowed
        .map((value) => `"${value}"`)
        .join(', ')}`,
    );
  }
  console.log(`  → ${dependency} pinned to ${pinned}`);
}

/** Every export a consumer imports has to survive packing. */
async function assertExports(label, tarball, keys) {
  step(`assert the packed ${label} export map`);
  const manifest = await packedManifest(tarball);
  const exports = manifest.exports ?? {};
  for (const key of keys) {
    if (exports[key] === undefined) {
      throw new Error(`the packed ${label} manifest does not export "${key}"`);
    }
  }
  console.log(`  → ${keys.join(', ')}`);
}

/** Motion is an optional peer of the React binding, exposed as its own entry point. */
async function assertOptionalMotion(tarball) {
  step('assert motion stays an optional peer of the React binding');
  const manifest = await packedManifest(tarball);
  if (manifest.peerDependencies?.motion === undefined) {
    throw new Error('the packed React manifest does not declare motion as a peer');
  }
  if (manifest.peerDependenciesMeta?.motion?.optional !== true) {
    throw new Error('the packed React manifest does not mark motion as an optional peer');
  }
  console.log('  → motion: optional peer');
}

/**
 * A tarball ships what its `files` array claims, licence and all.
 *
 * The point is the `files` array: a package that drops its README or its LICENSE
 * from the tarball is a packaging regression nobody notices until it is published.
 */
async function assertShipFiles(label, tarball, entries) {
  step(`assert the packed ${label} ships its documentation`);
  const packed = await packedEntries(tarball);
  for (const entry of entries) {
    if (!packed.includes(entry)) {
      throw new Error(`the packed ${label} does not contain ${entry}`);
    }
  }
  console.log(`  → ${entries.join(', ')}`);
}

/* -------------------------------------------------------------------------- */
/*  Legs                                                                       */
/* -------------------------------------------------------------------------- */

const widgetMarker = 'sn-root';

/** The packed React tarball, for the assertions that read its manifest. */
const packedReactTarball = (packed) =>
  packed.find((entry) => entry.label.endsWith('soundline-react')).file;

/** Copies a template, points it at the tarballs and installs it with its own cache. */
async function prepareLeg(leg, packed) {
  const scratch = join(verifyRoot, leg.name);
  step(`prepare the ${leg.name} scratch app`);
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });
  await cp(join(templates, leg.template), scratch, { recursive: true });
  await cp(join(templates, leg.manifest, 'package.json'), join(scratch, 'package.json'));

  // The template does not pin the library versions, so the tarballs that were just
  // packed take their place — derived from the manifests, never hardcoded.
  const manifestPath = join(scratch, 'package.json');
  const manifest = await readJson(manifestPath);
  for (const entry of packed) {
    manifest.dependencies[entry.label] = `file:${relative(scratch, entry.file)}`;
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  step(`npm install (${leg.name}, own cache)`);
  await run(
    npm,
    ['install', '--no-audit', '--no-fund', '--cache', join(scratch, 'npm-cache')],
    scratch,
  );

  return scratch;
}

async function runReactLeg(leg, scratch) {
  // Motion is an optional peer: the base entry point has to build without it.
  if (existsSync(join(scratch, 'node_modules/motion'))) {
    throw new Error(`the ${leg.name} scratch app installed motion, which is optional`);
  }

  step(`tsc --noEmit (${leg.name} consumer types)`);
  await run('npx', ['tsc', '--noEmit'], scratch);

  step(`vite build (${leg.name} production bundle)`);
  await run('npx', ['vite', 'build'], scratch);

  const assets = await readdir(join(scratch, 'dist/assets'));
  const script = assets.find((file) => file.endsWith('.js'));
  if (!script) throw new Error(`the ${leg.name} build produced no bundle`);
  const contents = await readFile(join(scratch, 'dist/assets', script), 'utf8');
  if (!contents.includes(widgetMarker)) {
    throw new Error(`the ${leg.name} bundle does not contain the widget`);
  }

  step(`server render + hydration in Node (${leg.name})`);
  await run(npm, ['run', 'ssr'], scratch);

  // The page is rebuilt with the server's markup inside `#root`, so the browser
  // hydrates what the server rendered instead of rendering from scratch.
  step(`prerender the page (${leg.name})`);
  await run(npm, ['run', 'prerender'], scratch);

  step(`hydration in a real browser (${leg.name})`);
  await run(
    'node',
    [
      join(root, 'tools/check-hydration.mjs'),
      '--dir',
      join(scratch, 'dist'),
      '--scope',
      '#root',
      '--label',
      leg.name,
    ],
    root,
  );
}

/* -------------------------------------------------------------------------- */

const legs = onlyLeg ? LEGS.filter((leg) => leg.name === onlyLeg) : LEGS;
if (legs.length === 0) {
  throw new Error(
    `unknown leg "${onlyLeg}"; known legs: ${LEGS.map((leg) => leg.name).join(', ')}`,
  );
}

const packed = tarballDir ? await collectLibraries(tarballDir) : await packLibraries();

const core = packed.find((entry) => entry.label.endsWith('soundline-core'));
const react = packed.find((entry) => entry.label.endsWith('soundline-react'));

await assertExports(core.label, core.file, ['.', './dom', './styles.css']);
await assertExports(react.label, react.file, ['.', './motion', './styles.css']);
await assertShipFiles(core.label, core.file, [
  'package/README.md',
  'package/LICENSE',
  'package/dist/index.js',
  'package/dist/soundline.css',
]);
await assertShipFiles(react.label, react.file, [
  'package/README.md',
  'package/LICENSE',
  'package/THIRD-PARTY-LICENSES.md',
  'package/dist/index.js',
  'package/dist/motion.js',
  'package/dist/soundline.css',
]);
await assertPinned(react.label, react.file, core.label, core.version);
await assertOptionalMotion(react.file);

if (packOnly) {
  const target = resolve(root, packOnly);
  await mkdir(target, { recursive: true });
  for (const entry of packed) {
    await cp(entry.file, join(target, basename(entry.file)));
  }
  step(`packed ${packed.length} packages into ${packOnly}`);
  process.exit(0);
}

for (const leg of legs) {
  const scratch = await prepareLeg(leg, packed);
  await runReactLeg(leg, scratch);
  console.log(`\u001b[32m✓ ${leg.name}\u001b[0m`);
}

console.log(
  `\n\u001b[32m✓ packed packages install and build in ${legs.length} clean consumer ${
    legs.length === 1 ? 'app' : 'apps'
  }\u001b[0m`,
);
for (const leg of legs) console.log(`  .verify/${leg.name}`);
console.log('');
