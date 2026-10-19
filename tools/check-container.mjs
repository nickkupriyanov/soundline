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
  const round = (value) => Math.round(value * 100) / 100;
  const box = (element) => element.getBoundingClientRect();
  const gap = (above, below) => round(box(below).top - box(above).bottom);
  const figure = document.querySelector("[data-sn-case='idle']");
  if (!figure) return { error: 'no idle gallery case' };
  const root = figure.querySelector('.sn-root');
  const card = figure.querySelector('.sn-card');
  const artwork = root.querySelector('.sn-artwork');

  const measure = () => ({
    width: Math.round(root.getBoundingClientRect().width),
    card: Math.round(card.getBoundingClientRect().width),
    artwork: Math.round(box(artwork).width),
    overflow: root.scrollWidth - root.clientWidth,
  });

  // The seek handle is 14px on a 6px bar and deliberately hangs over both ends of
  // it. No ancestor between the handle and the widget may clip that overhang.
  const seek = root.querySelector('.sn-seek');
  let clippedBy = null;
  if (seek) {
    for (
      let node = seek.querySelector('.sn-seek-thumb');
      node && node !== root;
      node = node.parentElement
    ) {
      const style = getComputedStyle(node);
      if (
        style.overflow === 'hidden' ||
        style.overflowX === 'hidden' ||
        style.overflowY === 'hidden'
      ) {
        clippedBy = String(node.className);
        break;
      }
    }
  }

  const widths = {};
  for (const width of ${JSON.stringify(WIDTHS)}) {
    figure.style.width = width + 'px';
    await sleep(150);
    widths[width] = measure();
  }
  figure.style.width = '';

  // The compact composition keeps its own, smaller cover at every width.
  const compactFigure = document.querySelector("[data-sn-case='compact']");
  const compactRoot = compactFigure && compactFigure.querySelector('.sn-root');
  const compactWidths = {};
  for (const width of ${JSON.stringify(WIDTHS)}) {
    compactFigure.style.width = width + 'px';
    await sleep(150);
    compactWidths[width] = {
      root: Math.round(box(compactRoot).width),
      artwork: Math.round(box(compactRoot.querySelector('.sn-artwork')).width),
    };
  }
  compactFigure.style.width = '';

  // The composition groups, measured from the rendered boxes rather than read
  // from the stylesheet: the browser is the only place the gaps are real.
  const nowPlaying = root.querySelector('.sn-now-playing');
  const progress = root.querySelector('.sn-progress');
  const controls = root.querySelector('.sn-controls');
  const timeDisplay = root.querySelector('.sn-time-display');
  const transport = root.querySelector('.sn-transport');
  const queue = root.querySelector('.sn-queue');
  const gaps = {
    trackToProgress: gap(nowPlaying, progress),
    seekToTime: gap(seek, timeDisplay),
    progressToControls: gap(progress, controls),
    transportToVolume: gap(transport, root.querySelector('.sn-volume')),
    controlsToQueue: gap(controls, queue),
  };

  // The volume row: the mute button and the slider are the only things in the
  // flow and are centred in the card; the percentage is an absolute hint beside
  // them and must not widen the row or leave the card.
  const volume = root.querySelector('.sn-volume');
  const volumeButton = root.querySelector('.sn-volume-button');
  const volumeSlider = root.querySelector('.sn-volume-slider');
  const volumeValue = root.querySelector('.sn-volume-value');
  const thumb = root.querySelector('.sn-volume-thumb');
  const thumbCentre = () =>
    round(box(thumb).left + box(thumb).width / 2 - box(volumeSlider).left);
  const cardPaddingRight = parseFloat(getComputedStyle(card).paddingRight);
  const volumeLayout = {
    width: round(box(volume).width),
    button: round(box(volumeButton).width),
    slider: round(box(volumeSlider).width),
    gap: round(box(volumeSlider).left - box(volumeButton).right),
    pairCentre: round((box(volumeButton).left + box(volumeSlider).right) / 2),
    cardCentre: round(box(card).left + box(card).width / 2),
    contentRight: round(box(card).right - cardPaddingRight),
  };
  const volumeAt = async (key) => {
    volumeSlider.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    await sleep(80);
    return {
      now: volumeSlider.getAttribute('aria-valuenow'),
      text: volumeValue.textContent,
      centre: thumbCentre(),
    };
  };
  const volumeEnds = { zero: await volumeAt('Home'), full: await volumeAt('End') };

  /*
   * The readout is a hint: hidden at rest, shown while the row has the focus or
   * the slider is dragged. It is out of the flow, so revealing it must not move
   * the button or the slider — and it must stay inside the card.
   */
  const readout = async () => ({
    opacity: getComputedStyle(volumeValue).opacity,
    width: round(box(volumeValue).width),
    right: round(box(volumeValue).right),
    pairCentre: round((box(volumeButton).left + box(volumeSlider).right) / 2),
    clipped: volumeValue.scrollWidth > volumeValue.clientWidth,
  });
  const readoutRest = await readout();
  volumeSlider.focus();
  await sleep(220);
  const readoutFocused = await readout();
  volumeSlider.blur();
  await sleep(220);

  // The narrowest card the specification names: the hint has to fit beside the
  // centred pair without leaving the 280px card.
  figure.style.width = '280px';
  await sleep(150);
  volumeSlider.focus();
  await sleep(220);
  const volumeNarrow = {
    opacity: getComputedStyle(volumeValue).opacity,
    readoutRight: round(box(volumeValue).right),
    contentRight: round(box(card).right - parseFloat(getComputedStyle(card).paddingRight)),
    pairCentre: round((box(volumeButton).left + box(volumeSlider).right) / 2),
    cardCentre: round(box(card).left + box(card).width / 2),
  };
  volumeSlider.blur();
  figure.style.width = '';
  await sleep(220);

  // The reset must not win the cascade: these are the component colours, as the
  // browser actually paints them, compared with the tokens they should read.
  const tokenColour = (token) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(' + token + ')';
    root.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  };
  const play = root.querySelector('.sn-play-button');
  const repeat = root.querySelector('.sn-repeat-button');
  const colours = {
    play: getComputedStyle(play).color,
    playToken: tokenColour('--sn-accent-contrast'),
    repeat: getComputedStyle(repeat).color,
    repeatToken: tokenColour('--sn-text-muted'),
  };
  // The pressed toggle has to paint the accent ink, not the muted text.
  repeat.click();
  await sleep(220);
  colours.repeatOn = getComputedStyle(repeat).color;
  colours.repeatOnToken = tokenColour('--sn-accent-ink');
  colours.repeatOnPressed = repeat.getAttribute('aria-pressed');
  repeat.click();
  await sleep(220);

  // The queue is part of the card now: no panel fill, frame, rounding or inset.
  const count = root.querySelector('.sn-queue-count');
  const heading = root.querySelector('.sn-header span');
  const firstTitleElements = {
    title: root.querySelector('.sn-track-title'),
    artist: root.querySelector('.sn-track-artist'),
    duration: root.querySelector('.sn-track-duration'),
  };
  const alignment = (() => {
    // The artist's box includes its 20px indent; the text is what has to line up.
    const textLeft = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return round(range.getBoundingClientRect().left);
    };
    return {
      title: textLeft(firstTitleElements.title),
      artist: textLeft(firstTitleElements.artist),
      heading: textLeft(heading),
      durationRight: round(box(firstTitleElements.duration).right),
      countRight: round(box(count).right),
    };
  })();
  const queueStyle = {
    background: getComputedStyle(queue).backgroundColor,
    border: getComputedStyle(queue).borderTopWidth,
    radius: getComputedStyle(queue).borderTopLeftRadius,
    padding: getComputedStyle(queue).paddingTop,
    countBackground: getComputedStyle(count).backgroundColor,
    headerOffset: round(alignment.title - alignment.heading),
  };

  // The queue list itself scrolls under a small cap, and the header above it stays.
  root.style.setProperty('--sn-queue-max-height', '60px');
  await sleep(150);
  const list = root.querySelector('.sn-queue-list');
  const header = root.querySelector('.sn-header');
  const scroll = {
    present: !!list,
    scrolls: !!list && list.scrollHeight > list.clientHeight + 1,
    rows: root.querySelectorAll('.sn-track-select').length,
    durations: root.querySelectorAll('.sn-track-duration').length,
    equalizers: root.querySelectorAll('.sn-eq').length,
    headerVisible:
      !!header &&
      header.getBoundingClientRect().height > 0 &&
      header.getBoundingClientRect().top >= root.getBoundingClientRect().top - 1,
  };
  root.style.removeProperty('--sn-queue-max-height');

  /*
   * At the end of the scroll the last row has to be fully visible: the bottom
   * fade and the bottom padding are the same size, so only the padding is dimmed
   * once there is nothing left to scroll.
   */
  root.style.setProperty('--sn-queue-max-height', '200px');
  await sleep(150);
  const endList = root.querySelector('.sn-queue-list');
  endList.scrollTop = endList.scrollHeight;
  await sleep(150);
  const allRows = [...root.querySelectorAll('.sn-track-item')];
  const lastRow = allRows[allRows.length - 1];
  const queueEnd = {
    paddingBottom: getComputedStyle(endList).paddingBottom,
    scrollPaddingBottom: getComputedStyle(endList).scrollPaddingBottom,
    mask: getComputedStyle(endList).maskImage,
    lastRowBottom: round(box(lastRow).bottom),
    listBottom: round(box(endList).bottom),
    atEnd: endList.scrollTop + endList.clientHeight >= endList.scrollHeight - 1,
  };
  endList.scrollTop = 0;
  root.style.removeProperty('--sn-queue-max-height');

  // Starting playback must not move the row: the equalizer's slot is already
  // reserved, so the title keeps its x position and the list keeps its height.
  const firstTitle = root.querySelector('.sn-track-title');
  const firstRow = root.querySelector('.sn-track-item');
  const listHeight = () => round(box(root.querySelector('.sn-queue-list')).height);
  const rowBefore = {
    title: round(box(firstTitle).left),
    row: round(box(firstRow).height),
    list: listHeight(),
  };
  root.querySelector('.sn-play-button').click();
  await sleep(400);
  const rowAfter = {
    title: round(box(firstTitle).left),
    row: round(box(firstRow).height),
    list: listHeight(),
    playing: firstRow.classList.contains('sn-track-item-playing'),
  };
  root.querySelector('.sn-play-button').click();
  await sleep(120);

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

  return {
    widths,
    compactWidths,
    gaps,
    volume: {
      layout: volumeLayout,
      ends: volumeEnds,
      readout: { rest: readoutRest, focused: readoutFocused },
      narrow: volumeNarrow,
    },
    colours,
    alignment,
    queueStyle,
    scroll,
    queueEnd,
    rows: { before: rowBefore, after: rowAfter },
    keyboard,
    motion,
    seek: { present: !!seek, clippedBy },
  };
})()
`;

const NARROW_PROBE = `
(() => {
  const items = [...document.querySelectorAll('.gallery__item')];
  const rects = items.map((item) => item.getBoundingClientRect());
  const roots = [...document.querySelectorAll('.sn-root')].map((root) =>
    root.getBoundingClientRect(),
  );
  const widths = rects.map((rect) => rect.width);
  return {
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    cases: items.length,
    minLeft: Math.round(Math.min(...rects.map((rect) => rect.left))),
    maxRight: Math.round(Math.max(...rects.map((rect) => rect.right))),
    maxWidth: Math.round(Math.max(...widths)),
    rootMaxWidth: Math.round(Math.max(...roots.map((rect) => rect.width))),
  };
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

async function probe(extraArgs, width = 1200, height = 800) {
  const stdout = await run([
    resolve(root, 'tools/screenshot.mjs'),
    '--url',
    url,
    '--width',
    String(width),
    '--height',
    String(height),
    '--wait-for',
    '.sn-track-select',
    ...extraArgs,
  ]);
  return JSON.parse(stdout);
}

let report;
let reduced;
let narrow;
try {
  report = await probe(['--tab', '30', '--eval', PROBE]);
  reduced = await probe(['--media', 'prefers-reduced-motion:reduce', '--eval', REDUCED_PROBE]);
  narrow = await probe(['--eval', NARROW_PROBE], 320, 844);
} catch (error) {
  console.error(`✗ container check could not run — is the playground preview serving ${url}?`);
  throw error;
}

if (report.error || narrow.error) {
  console.error(`\n✗ container check failed: ${report.error ?? narrow.error}`);
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
    failures.push(
      `a ${width}px container renders the widget at ${measured.width}px, expected ${expected}px`,
    );
  }
  if (measured.card !== measured.width) {
    failures.push(`at ${width}px the card is ${measured.card}px, the widget ${measured.width}px`);
  }
  if (measured.overflow > 1) {
    failures.push(`the widget overflows horizontally at ${width}px (${measured.overflow}px)`);
  }

  // The cover's responsive switch: 72px in a narrow card, 88px from 340px up.
  const artwork = width >= 400 ? 88 : 72;
  if (measured.artwork !== artwork) {
    failures.push(`at ${width}px the card artwork is ${measured.artwork}px, expected ${artwork}px`);
  }
}

for (const width of WIDTHS) {
  const compact = report.compactWidths[width];
  if (compact.artwork !== 64) {
    failures.push(`at ${width}px the compact artwork is ${compact.artwork}px, expected 64px`);
  }
  if (compact.root > 300) {
    failures.push(`at ${width}px the compact widget is ${compact.root}px, expected at most 300px`);
  }
}

const expectedGaps = {
  trackToProgress: 12,
  seekToTime: 4,
  progressToControls: 12,
  transportToVolume: 8,
  controlsToQueue: 12,
};
for (const [name, expected] of Object.entries(expectedGaps)) {
  const actual = report.gaps[name];
  if (Math.abs(actual - expected) > 1) {
    failures.push(`the ${name} gap is ${actual}px, expected ${expected}px`);
  }
}

const volume = report.volume.layout;
if (volume.width > 208.5)
  failures.push(`the volume row is ${volume.width}px wide, expected ≤208px`);
if (volume.button !== 32 || volume.slider !== 124) {
  failures.push(
    `the volume pair is ${volume.button}px button and ${volume.slider}px slider, expected 32px/124px`,
  );
}
if (Math.abs(volume.gap - 8) > 0.5) {
  failures.push(`the volume gap is ${volume.gap}px, expected 8px`);
}
if (Math.abs(volume.pairCentre - volume.cardCentre) > 0.5) {
  failures.push(
    `the mute button and slider are centred at ${volume.pairCentre}px, the card at ${volume.cardCentre}px`,
  );
}
if (volume.slider <= 0) failures.push('the volume slider has no width');

const zero = report.volume.ends.zero;
const full = report.volume.ends.full;
if (zero.now !== '0' || zero.text !== '0%') {
  failures.push(`volume 0% renders as ${zero.now}/${zero.text}, expected 0/0%`);
}
if (Math.abs(zero.centre - 7) > 0.75) {
  failures.push(`the volume thumb centre at 0% is ${zero.centre}px, expected 7px`);
}
if (full.now !== '100' || full.text !== '100%') {
  failures.push(`volume 100% renders as ${full.now}/${full.text}, expected 100/100%`);
}
if (Math.abs(full.centre - (volume.slider - 7)) > 0.75) {
  failures.push(
    `the volume thumb centre at 100% is ${full.centre}px, expected ${volume.slider - 7}px`,
  );
}

const readout = report.volume.readout;
if (readout.rest.opacity !== '0') {
  failures.push(`the volume readout is ${readout.rest.opacity} at rest, expected hidden`);
}
if (readout.focused.opacity !== '1') {
  failures.push(`the volume readout is ${readout.focused.opacity} focused, expected shown`);
}
if (Math.abs(readout.rest.pairCentre - readout.focused.pairCentre) > 0.5) {
  failures.push(
    `revealing the volume readout moved the pair from ${readout.rest.pairCentre}px to ${readout.focused.pairCentre}px`,
  );
}
if (readout.focused.right > volume.contentRight + 0.5) {
  failures.push(
    `the volume readout ends at ${readout.focused.right}px, past the card content ${volume.contentRight}px`,
  );
}
if (readout.rest.clipped || readout.focused.clipped) {
  failures.push('the volume readout is clipped');
}

const narrowVolume = report.volume.narrow;
if (narrowVolume.opacity !== '1') {
  failures.push(`the narrow volume hint is ${narrowVolume.opacity}, expected shown while focused`);
}
if (narrowVolume.readoutRight > narrowVolume.contentRight + 0.5) {
  failures.push(
    `at 280px the volume readout ends at ${narrowVolume.readoutRight}px, past the card content ${narrowVolume.contentRight}px`,
  );
}
if (Math.abs(narrowVolume.pairCentre - narrowVolume.cardCentre) > 0.5) {
  failures.push(
    `at 280px the pair is centred at ${narrowVolume.pairCentre}px, the card at ${narrowVolume.cardCentre}px`,
  );
}

if (report.colours.play !== report.colours.playToken) {
  failures.push(
    `the play button paints ${report.colours.play}, expected --sn-accent-contrast ${report.colours.playToken}`,
  );
}
if (report.colours.repeat !== report.colours.repeatToken) {
  failures.push(
    `the repeat button paints ${report.colours.repeat}, expected --sn-text-muted ${report.colours.repeatToken}`,
  );
}
if (report.colours.repeatOnPressed !== 'true') {
  failures.push('the repeat toggle did not report aria-pressed after a click');
}
if (report.colours.repeatOn !== report.colours.repeatOnToken) {
  failures.push(
    `the pressed repeat button paints ${report.colours.repeatOn}, expected --sn-accent-ink ${report.colours.repeatOnToken}`,
  );
}

const queueStyle = report.queueStyle;
if (queueStyle.background !== 'rgba(0, 0, 0, 0)') {
  failures.push(`the queue still paints a panel background (${queueStyle.background})`);
}
if (queueStyle.border !== '0px' || queueStyle.radius !== '0px') {
  failures.push(
    `the queue still has a frame (border ${queueStyle.border}, radius ${queueStyle.radius})`,
  );
}
if (queueStyle.padding !== '0px') failures.push(`the queue has a ${queueStyle.padding} inset`);
if (queueStyle.countBackground !== 'rgba(0, 0, 0, 0)') {
  failures.push(`the queue count still paints a chip (${queueStyle.countBackground})`);
}
if (Math.abs(queueStyle.headerOffset) > 1) {
  failures.push(`the queue heading is ${queueStyle.headerOffset}px away from the row titles`);
}

// One text column and one right edge: the title and the artist start together,
// and the durations end where the track count does.
const alignment = report.alignment;
if (Math.abs(alignment.title - alignment.artist) > 0.6) {
  failures.push(
    `the row title starts at ${alignment.title}px, the artist at ${alignment.artist}px`,
  );
}
if (Math.abs(alignment.durationRight - alignment.countRight) > 0.6) {
  failures.push(
    `the durations end at ${alignment.durationRight}px, the track count at ${alignment.countRight}px`,
  );
}

if (!report.rows.after.playing) {
  failures.push('pressing play did not mark the active queue row as playing');
}
if (Math.abs(report.rows.before.title - report.rows.after.title) > 0.5) {
  failures.push(
    `starting playback moved the row title from ${report.rows.before.title}px to ${report.rows.after.title}px`,
  );
}
if (Math.abs(report.rows.before.row - report.rows.after.row) > 0.5) {
  failures.push(
    `starting playback changed the row height from ${report.rows.before.row}px to ${report.rows.after.row}px`,
  );
}
if (Math.abs(report.rows.before.list - report.rows.after.list) > 0.5) {
  failures.push(
    `starting playback changed the list height from ${report.rows.before.list}px to ${report.rows.after.list}px`,
  );
}

if (!report.scroll.present) failures.push('the queue list is missing');
if (!report.scroll.scrolls) failures.push('the queue did not scroll under --sn-queue-max-height');
if (!report.scroll.headerVisible) {
  failures.push('the queue header scrolled away under --sn-queue-max-height');
}
if (report.scroll.rows === 0) failures.push('the queue listed no tracks');
if (report.scroll.durations !== report.scroll.rows) {
  failures.push(
    `the queue has ${report.scroll.durations} duration columns for ${report.scroll.rows} rows`,
  );
}
if (report.scroll.equalizers !== report.scroll.rows) {
  failures.push(
    `the queue has ${report.scroll.equalizers} equalizer slots for ${report.scroll.rows} rows`,
  );
}

const queueEnd = report.queueEnd;
if (!queueEnd.atEnd) failures.push('the queue could not be scrolled to its end');
if (queueEnd.paddingBottom !== '20px' || queueEnd.scrollPaddingBottom !== '20px') {
  failures.push(
    `the queue end padding is ${queueEnd.paddingBottom}/${queueEnd.scrollPaddingBottom}, expected 20px`,
  );
}
if (!queueEnd.mask || queueEnd.mask === 'none') {
  failures.push('the queue has no bottom fade');
}
if (queueEnd.lastRowBottom > queueEnd.listBottom - 20 + 1) {
  failures.push(
    `at the end of the scroll the last row reaches ${queueEnd.lastRowBottom}px into the ${queueEnd.listBottom}px list: it sits under the fade`,
  );
}

// The gallery is a separate page: at 320px its figures used to keep the widget's
// intrinsic 380px width and hang 30px off the left edge of the scroll.
if (narrow.scrollWidth > narrow.innerWidth + 1) {
  failures.push(`the gallery scrolls to ${narrow.scrollWidth}px at ${narrow.innerWidth}px`);
}
if (narrow.minLeft < -1) failures.push(`a gallery card starts at ${narrow.minLeft}px`);
if (narrow.maxRight > narrow.innerWidth + 1) {
  failures.push(`a gallery card ends at ${narrow.maxRight}px, past ${narrow.innerWidth}px`);
}
if (narrow.maxWidth > narrow.innerWidth - 32 + 1) {
  failures.push(
    `a gallery card is ${narrow.maxWidth}px wide at ${narrow.innerWidth}px, expected at most ${narrow.innerWidth - 32}px`,
  );
}
if (narrow.rootMaxWidth > narrow.maxWidth + 1) {
  failures.push(
    `the widget is ${narrow.rootMaxWidth}px inside a ${narrow.maxWidth}px gallery card`,
  );
}

if (report.keyboard.stops === 0) failures.push('no control was reached by Tab inside the widget');
if (report.keyboard.hidden.length > 0) {
  failures.push(`Tab reached hidden controls: ${report.keyboard.hidden.join(', ')}`);
}
if (report.keyboard.focusVisible === 0) {
  failures.push('no control reported :focus-visible after real Tab presses');
}

if (!report.seek.present) failures.push('the seek bar is missing');
if (report.seek.clippedBy) {
  failures.push(`the seek handle is clipped by ${report.seek.clippedBy}: it is wider than the bar`);
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
  `artwork:  ${WIDTHS.map((width) => `${width}px → ${report.widths[width].artwork}px`).join('  ·  ')} (compact ${report.compactWidths[400].artwork}px)`,
);
console.log(
  `rhythm:   ${Object.entries(report.gaps)
    .map(([name, value]) => `${name} ${value}px`)
    .join('  ·  ')}`,
);
console.log(
  `volume:   ${volume.width}px · pair ${volume.button}+${volume.gap}+${volume.slider}px centred ${volume.pairCentre}/${volume.cardCentre}px · thumb ${zero.centre}…${full.centre}px · readout ${readout.rest.opacity}→${readout.focused.opacity} to ${readout.focused.right}/${volume.contentRight}px (280px: ${narrowVolume.readoutRight}/${narrowVolume.contentRight}px)`,
);
console.log(
  `columns:  title ${alignment.title}px · artist ${alignment.artist}px · heading ${alignment.heading}px · durations ${alignment.durationRight}px · count ${alignment.countRight}px`,
);
console.log(
  `colours:  play ${report.colours.play} · repeat ${report.colours.repeat} → ${report.colours.repeatOn} (pressed)`,
);
console.log(
  `rows:     title ${report.rows.before.title}px → ${report.rows.after.title}px · height ${report.rows.before.row}px → ${report.rows.after.row}px`,
);
console.log(
  `queue:    ${report.scroll.rows} rows · ${report.scroll.scrolls ? 'scrolls' : 'fits'} under the cap · header ${report.scroll.headerVisible ? 'visible' : 'scrolled away'} · ${report.scroll.durations} durations · fade ${queueEnd.mask === 'none' ? 'missing' : 'present'} · end gap ${queueEnd.listBottom - queueEnd.lastRowBottom}px`,
);
console.log(
  `gallery:  320px → cards ${narrow.maxWidth}px (${narrow.cases} cases), scroll ${narrow.scrollWidth}px`,
);
console.log(
  `focus:    ${report.keyboard.stops} Tab stops inside the widget, ${report.keyboard.focusVisible} focus-visible`,
);
console.log(
  `seek:     handle ${report.seek.present ? 'present' : 'missing'} · ${report.seek.clippedBy ? `clipped by ${report.seek.clippedBy}` : 'not clipped'}`,
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
