#!/usr/bin/env node
/**
 * Layout guard for the widget's width.
 *
 * jsdom has no layout engine, so the "the card resizes between states" class of
 * bug is invisible to the unit tests. This check drives a real Chrome over the
 * DevTools Protocol and asserts the invariants the stylesheet promises:
 *
 *   · the card fills the widget root exactly (no inner width of its own)
 *   · every state of one layout renders at one width
 *   · a narrower parent shrinks the widget, never the content
 *   · nothing overflows horizontally
 *
 * A served gallery is required:
 *   pnpm --filter @nickkupriyanov/soundline-playground build
 *   pnpm --filter @nickkupriyanov/soundline-playground preview   # http://localhost:4173
 *   node tools/check-layout.mjs
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv[2] ?? 'http://localhost:4173/gallery.html';

const PROBE = `
(async () => {
  const width = (element) => Math.round(element.getBoundingClientRect().width * 100) / 100;
  // The gallery marks its cases; the check reads them instead of counting figures, so
  // a new case never means editing the check and no number of states is assumed.
  const items = [...document.querySelectorAll('[data-sn-case]')];
  if (items.length === 0) return { error: 'no marked gallery cases' };

  const measured = items.map((item) => {
    const widget = item.querySelector('.sn-root');
    const card = item.querySelector('.sn-card');
    const rootWidth = width(widget);
    return {
      name: item.getAttribute('data-sn-case'),
      state: item.getAttribute('data-sn-state') || '',
      layout: item.getAttribute('data-sn-layout') || 'card',
      root: rootWidth,
      card: width(card),
      overflowX: widget.scrollWidth > Math.ceil(rootWidth),
    };
  });

  // A layout has one width; the two layouts may differ, which is the point of the
  // compact composition. Measured by resizing the parent of the first case, the way
  // an application would place the widget in a narrower panel.
  const first = items[0];
  const previous = first.style.width;
  first.style.width = '280px';
  const narrow = width(first.querySelector('.sn-root'));
  first.style.width = '1000px';
  const wide = width(first.querySelector('.sn-root'));
  first.style.width = previous;

  return { measured, narrow, wide };
})()
`;

const run = (args) =>
  new Promise((done, fail) => {
    const child = spawn(process.execPath, args, {
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
    '1980',
    '--height',
    '800',
    '--wait-for',
    '.sn-root',
    '--eval',
    PROBE,
  ]);
  report = JSON.parse(stdout);
} catch (error) {
  console.error(
    `✗ layout check could not run — is the playground preview serving ${url}?`,
  );
  throw error;
}

if (report.error) {
  console.error(`✗ ${report.error}`);
  process.exit(1);
}

const failures = [];

// Widths are grouped by layout: every case of one layout renders at one width, and
// a different layout may choose another.
const byLayout = new Map();
for (const entry of report.measured) {
  const list = byLayout.get(entry.layout) ?? [];
  list.push(entry);
  byLayout.set(entry.layout, list);
}
for (const [layout, entries] of byLayout) {
  const widths = [...new Set(entries.map((entry) => entry.width))];
  if (widths.length !== 1) {
    failures.push(
      `${layout} cases render at different widths: ${entries
        .map((entry) => `${entry.name} ${entry.width}px`)
        .join(', ')}`,
    );
  }
}
for (const entry of report.measured) {
  if (entry.overflowX) failures.push(`${entry.name} overflows horizontally`);
  if (entry.card !== entry.root) {
    failures.push(`${entry.name}: card ${entry.card}px ≠ root ${entry.root}px`);
  }
}

if (report.narrow !== 280) {
  failures.push(`280px parent → ${report.narrow}px widget (expected 280)`);
}
if (report.wide !== report.measured[0].root) {
  failures.push(
    `1000px parent → ${report.wide}px widget (expected ${report.measured[0].root}px)`,
  );
}

console.log(
  `cases:    ${report.measured
    .map((entry) => `${entry.name}/${entry.layout} ${entry.root}px`)
    .join('  ·  ')}`,
);
console.log(`parents:  280px → ${report.narrow}px   1000px → ${report.wide}px`);

if (failures.length > 0) {
  console.error('\n✗ layout check failed:');
  for (const failure of failures) console.error(`  · ${failure}`);
  process.exit(1);
}

console.log('\n✓ every state renders at its layout width, no overflow');
