/**
 * Post-build steps:
 *  1. copy the core stylesheet into `dist/soundline.css`, so
 *     `@nickkupriyanov/soundline-react/styles.css` keeps working now that the core
 *     owns the authored CSS
 *  2. make sure both entry points start with the `"use client"` directive so React
 *     Server Components can import them from a client boundary.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/* -------------------------------------------------------------------------- */
/*  1. CSS                                                                    */
/* -------------------------------------------------------------------------- */

let coreStylesheet;
try {
  coreStylesheet = require.resolve('@nickkupriyanov/soundline-core/styles.css');
} catch {
  throw new Error(
    '[soundline-react] cannot find @nickkupriyanov/soundline-core/styles.css — ' +
      'build @nickkupriyanov/soundline-core first (pnpm build).',
  );
}

const dist = resolve(root, 'dist');
await mkdir(dist, { recursive: true });
await writeFile(resolve(dist, 'soundline.css'), await readFile(coreStylesheet, 'utf8'), 'utf8');
console.log(`[soundline-react] css → dist/soundline.css (copied from @nickkupriyanov/soundline-core)`);

/* -------------------------------------------------------------------------- */
/*  2. "use client"                                                           */
/* -------------------------------------------------------------------------- */

const BUNDLES = ['index.js', 'index.cjs', 'motion.js', 'motion.cjs'];
const DIRECTIVE = `"use client";\n`;

for (const file of BUNDLES) {
  const path = resolve(dist, file);
  const source = await readFile(path, 'utf8');
  if (source.startsWith('"use client"') || source.startsWith("'use client'")) continue;
  await writeFile(path, DIRECTIVE + source, 'utf8');
}
console.log(`[soundline-react] "use client" → ${BUNDLES.join(', ')}`);
