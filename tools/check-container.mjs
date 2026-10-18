#!/usr/bin/env node
/**
 * Browser check for the container adaptation of the widget.
 *
 * A real engine is the only place where overflow, `:focus-visible` and the
 * reduced-motion kill switch can be observed, so this drives the served gallery
 * through the widths the specification names — 280, 320, 400 and 800 px — and
 * checks, in one browser each:
 *
 *   · the widget fits the container it is given and never overflows horizontally
 *   · a very wide panel stops at the widget's own width (`--sn-width`)
 *   · the queue scrolls under `--sn-queue-max-height` while its header stays put
 *   · real Tab presses reach visible controls that report `:focus-visible`
 *   · `prefers-reduced-motion: reduce` collapses the animations and transitions
 *
 * A served gallery is required:
 *   pnpm --filter @nickkupriyanov/soundline-playground build
 *   pnpm --filter @nickkupriyanov/soundline-playground preview   # http://localhost:4173
 *   node tools/check-container.mjs
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv[2] ?? 'http://localhost:4173/gallery.html';

const WIDTHS = [280, 320, 400, 800];

const PROBE = `
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const figure = document.querySelector("[data-sn-case='idle']");
  if (!figure) return { error: 'no idle gallery case' };
  const root = figure.querySelector('.sn-root');
  const card = figure.querySelector('.sn-card');

  const measure = () => ({
    width: Math.round(root.getBoundingClientRect().width),
    card: Math.round(card.getBoundingClientRect().width),
    overflow: root.scrollWidth - root.clientWidth,
  });

  const widths = {};
  for (const width of ${JSON.stringify(WIDTHS)}) {
    figure.style.width = width + 'px';
    await sleep(150);
    widths[width] = measure();
  }
  figure.style.width = '';

  // The queue list itself scrolls under a small cap, and the header above it stays.
  root.style.setProperty('--sn-queue-max-height', '60px');
  await sleep(150);
  const list = root.querySelector('.sn-queue-list');
  const header = root.querySelector('.sn-header');
  const scroll = {
    present: !!list,
    scrolls: !!list && list.scrollHeight > list.clientHeight + 1,
    rows: root.querySelectorAll('.sn-track-select').length,
    headerVisible:
      !!header &&
      header.getBoundingClientRect().height > 0 &&
      header.getBoundingClientRect().top >= root.getBoundingClientRect().top - 1,
  };
  root.style.removeProperty('--sn-queue-max-height');

  // What real Tab presses visited, recorded by the harness.
  const trail = (window.__snFocusTrail || []).filter((stop) => stop.inWidget);
  const keyboard = {
    stops: trail.length,
    hidden: trail.filter((stop) => !stop.visible).map((stop) => stop.className || stop.tag),
    focusVisible: trail.filter((stop) => stop.focusVisible).length,
  };

  // The reduced-motion pass reads the same values for comparison.
  const step = root.querySelector('.sn-step');
  const row = root.querySelector('.sn-track-item');
  const motion = {
    step: step ? getComputedStyle(step).animationDuration : null,
    row: row ? getComputedStyle(row).transitionDuration : null,
  };

  return { widths, scroll, keyboard, motion };
})()
`;

const REDUCED_PROBE = `
(() => {
  const root = document.querySelector("[data-sn-case='idle'] .sn-root") || document.querySelector('.sn-root');
  const step = root.querySelector('.sn-step');
  const row = root.querySelector('.sn-track-item');
  return {
    step: step ? getComputedStyle(step).animationDuration : null,
    row: row ? getComputedStyle(row).transitionDuration : null,
  };
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

async function probe(extraArgs) {
  const stdout = await run([
    resolve(root, 'tools/screenshot.mjs'),
    '--url',
    url,
    '--width',
    '1200',
    '--height',
    '800',
    '--wait-for',
    '.sn-track-select',
    ...extraArgs,
  ]);
  return JSON.parse(stdout);
}

let report;
let reduced;
try {
  report = await probe(['--tab', '30', '--eval', PROBE]);
  reduced = await probe(['--media', 'prefers-reduced-motion:reduce', '--eval', REDUCED_PROBE]);
} catch (error) {
  console.error(
    `✗ container check could not run — is the playground preview serving ${url}?`,
  );
  throw error;
}

if (report.error) {
  console.error(`\n✗ container check failed: ${report.error}`);
  process.exit(1);
}

/** `0.14s` or `1ms` → seconds. */
const seconds = (value) => {
  if (typeof value !== 'string') return null;
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return null;
  return value.trim().endsWith('ms') ? number / 1000 : number;
};

const failures = [];
const natural = report.widths[800].width;

if (natural <= 0) failures.push('the idle case rendered with no width');

for (const width of WIDTHS) {
  const measured = report.widths[width];
  const expected = Math.min(width, natural);
  if (measured.width !== expected) {
    failures.push(`a ${width}px container renders the widget at ${measured.width}px, expected ${expected}px`);
  }
  if (measured.card !== measured.width) {
    failures.push(`at ${width}px the card is ${measured.card}px, the widget ${measured.width}px`);
  }
  if (measured.overflow > 1) {
    failures.push(`the widget overflows horizontally at ${width}px (${measured.overflow}px)`);
  }
}

if (!report.scroll.present) failures.push('the queue list is missing');
if (!report.scroll.scrolls) failures.push('the queue did not scroll under --sn-queue-max-height');
if (!report.scroll.headerVisible) {
  failures.push('the queue header scrolled away under --sn-queue-max-height');
}
if (report.scroll.rows === 0) failures.push('the queue listed no tracks');

if (report.keyboard.stops === 0) failures.push('no control was reached by Tab inside the widget');
if (report.keyboard.hidden.length > 0) {
  failures.push(`Tab reached hidden controls: ${report.keyboard.hidden.join(', ')}`);
}
if (report.keyboard.focusVisible === 0) {
  failures.push('no control reported :focus-visible after real Tab presses');
}

const normalStep = seconds(report.motion.step);
const reducedStep = seconds(reduced.step);
const normalRow = seconds(report.motion.row);
const reducedRow = seconds(reduced.row);

if (normalStep === null || normalStep < 0.05) {
  failures.push(`the artwork step animation is not running (${report.motion.step})`);
}
if (reducedStep === null || reducedStep > 0.01) {
  failures.push(`reduced motion did not collapse the artwork step (${reduced.step})`);
}
if (normalRow === null || normalRow < 0.05) {
  failures.push(`the queue row transition is not running (${report.motion.row})`);
}
if (reducedRow === null || reducedRow > 0.01) {
  failures.push(`reduced motion did not collapse the queue row transition (${reduced.row})`);
}

console.log(
  `widths:   ${WIDTHS.map((width) => `${width}px → ${report.widths[width].width}px`).join('  ·  ')}`,
);
console.log(
  `queue:    ${report.scroll.rows} rows · ${report.scroll.scrolls ? 'scrolls' : 'fits'} under the cap · header ${report.scroll.headerVisible ? 'visible' : 'scrolled away'}`,
);
console.log(
  `focus:    ${report.keyboard.stops} Tab stops inside the widget, ${report.keyboard.focusVisible} focus-visible`,
);
console.log(
  `motion:   step ${report.motion.step} → ${reduced.step} · row ${report.motion.row} → ${reduced.row}`,
);

if (failures.length > 0) {
  console.error('\n✗ container check failed:');
  for (const failure of failures) console.error(`  · ${failure}`);
  process.exit(1);
}

console.log('\n✓ the widget adapts to every checked width and honours reduced motion');
