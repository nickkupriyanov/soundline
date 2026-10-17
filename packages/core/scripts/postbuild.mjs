/**
 * Post-build step: concatenate the authored CSS into `dist/soundline.css`.
 *
 * The core owns the stylesheet for every binding — `soundline-react` copies this
 * file into its own `dist` so `@nickkupriyanov/soundline-react/styles.css` keeps
 * working, and a future binding will do the same.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Order matters: tokens first, then the base layer, then components. */
const CSS_SOURCES = ['src/styles/tokens.css', 'src/styles/base.css', 'src/styles/soundline.css'];

const banner = `/*! @nickkupriyanov/soundline-core — MIT licensed. Generated file, do not edit directly. */\n`;
const parts = [];
for (const file of CSS_SOURCES) {
  const source = await readFile(resolve(root, file), 'utf8');
  parts.push(`/* ---- ${file} ---- */\n${source.trim()}\n`);
}

const dist = resolve(root, 'dist');
await mkdir(dist, { recursive: true });
await writeFile(resolve(dist, 'soundline.css'), banner + parts.join('\n'), 'utf8');
console.log(`[soundline-core] css → dist/soundline.css (${CSS_SOURCES.length} sources)`);
