/**
 * The stylesheet is a public contract, so it is tested like one.
 *
 * Runs in the default node environment on purpose: it only reads files.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SN_CLASS } from '../classNames';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '../..');
const repoRoot = resolve(packageRoot, '../..');

function read(relativePath: string): string {
  return readFileSync(resolve(here, relativePath), 'utf8');
}

const tokensCss = read('tokens.css');
const baseCss = read('base.css');
const soundlineCss = read('soundline.css');
const animationsCss = read('animations.css');
const indexCss = read('index.css');

const READMES = [resolve(repoRoot, 'README.md'), resolve(packageRoot, 'README.md')];

/** Custom properties `tokens.css` actually defines. */
function definedTokens(): Set<string> {
  const names = new Set<string>();
  for (const match of tokensCss.matchAll(/(--sn-[a-z0-9-]+)\s*:/g)) names.add(match[1] as string);
  return names;
}

/**
 * Vars the component layers own themselves, next to the token that feeds them:
 * the `data-sn-layout` widths and the volume fill, which a binding writes inline,
 * and the hooks the animation kits write inline — the stagger delay, the
 * direction the artwork steps in from, and the duration of a row's exit, written
 * by the queue so that the transition and its unmount timer share one number.
 */
const LOCAL_VARS = new Set([
  '--sn-width-current',
  '--sn-volume-percent',
  '--sn-index',
  '--sn-step-shift',
  '--sn-exit-duration',
]);

describe('design tokens', () => {
  it('defines the player tokens the layout reads', () => {
    const defined = definedTokens();

    expect(defined).toContain('--sn-width');
    expect(defined).toContain('--sn-width-compact');
    expect(defined).toContain('--sn-card-gap');
    expect(defined).toContain('--sn-artwork-radius');
    expect(defined).toContain('--sn-artwork-size');
    expect(defined).toContain('--sn-seek-height');
    expect(defined).toContain('--sn-seek-fill');
    expect(defined).toContain('--sn-queue-max-height');
    expect(defined).toContain('--sn-queue-fade');
    expect(defined).toContain('--sn-track');
    expect(defined).toContain('--sn-row-max-height');
    expect(defined).toContain('--sn-volume-width');
    expect(defined).toContain('--sn-danger-contrast');
  });

  it('every var used by the component layer comes from the tokens', () => {
    const defined = definedTokens();
    const used = new Set(
      [...`${baseCss}\n${soundlineCss}\n${animationsCss}`.matchAll(/var\((--sn-[a-z0-9-]+)/g)].map(
        (match) => match[1] as string,
      ),
    );

    const unknown = [...used].filter((name) => !defined.has(name) && !LOCAL_VARS.has(name));
    expect(unknown).toEqual([]);
  });

  it('documents every token the READMEs mention', () => {
    const defined = definedTokens();
    const mentioned = new Set<string>();

    for (const path of READMES) {
      const markdown = readFileSync(path, 'utf8');
      for (const match of markdown.matchAll(/(--sn-[a-z0-9-]+)/g)) {
        mentioned.add(match[1] as string);
      }
    }

    const undocumented = [...mentioned].filter((name) => !defined.has(name));
    expect(undocumented).toEqual([]);
  });

  it('ships a light theme as the same set of variables', () => {
    const light = tokensCss.slice(tokensCss.indexOf("[data-sn-theme='light']"));
    const overridden = new Set([...light.matchAll(/(--sn-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

    expect(light).not.toBe('');
    expect(overridden.size).toBeGreaterThan(20);
  });
});

describe('component layer', () => {
  it('styles every slot in SN_CLASS', () => {
    const stylesheet = `${soundlineCss}\n${animationsCss}`;
    const missing = Object.values(SN_CLASS).filter(
      (className) => !new RegExp(`\\.${className}(?![\\w-])`).test(stylesheet),
    );

    expect(missing).toEqual([]);
  });

  it('leaves the button reset at zero specificity', () => {
    // A bare `.sn-root button { color: inherit }` outranks `.sn-play-button`
    // and silently replaces its colour; `:where()` keeps the reset underneath
    // the component classes, where it belongs.
    expect(baseCss).toContain(':where(.sn-root) :where(button)');
    expect(baseCss).not.toMatch(/\.sn-root button\s*\{/);
  });

  it('keeps the remove button visible without hover', () => {
    // A touch device has no hover gesture to reveal the second control.
    expect(soundlineCss).toMatch(
      /@media \(hover: none\) \{[\s\S]*?\.sn-track-remove \{[\s\S]*?opacity: 1;/,
    );
  });

  it('reveals the volume readout only while the row is in use', () => {
    // It is a hint, not a permanent column: hidden at rest, shown while the
    // slider is dragged or the row has the focus, and out of the flow so it
    // never widens the row or pushes the slider off centre.
    expect(soundlineCss).toMatch(/\.sn-volume-value\s*\{[\s\S]*?position:\s*absolute;/);
    expect(soundlineCss).toMatch(/\.sn-volume-value\s*\{[\s\S]*?opacity:\s*0;/);
    expect(soundlineCss).not.toMatch(/\.sn-volume-value\s*\{[^}]*width:\s*36px/);
    expect(soundlineCss).toMatch(/\.sn-volume:focus-within \.sn-volume-value/);
    expect(soundlineCss).toMatch(/\.sn-volume-slider\[data-sn-dragging='true'\] \.sn-volume-value/);
  });

  it('centres the slider between equal side slots', () => {
    expect(soundlineCss).toMatch(
      /\.sn-volume\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*center;/,
    );
    expect(soundlineCss).toMatch(/\.sn-volume::after\s*\{[^}]*flex:\s*0 0 34px;/);
    expect(soundlineCss).toMatch(/\.sn-volume-value\s*\{[^}]*width:\s*34px;/);
    expect(soundlineCss).toMatch(/\.sn-volume-button\s*\{[\s\S]*?flex:\s*0 0 34px;/);
    expect(soundlineCss).toMatch(/\.sn-volume-slider\s*\{[\s\S]*?flex:\s*0 1 124px;/);
  });

  it('keeps one text column and one right edge in the queue', () => {
    // The title follows the equalizer slot (14 + 6) inside the 10px row padding;
    // the artist is indented by the same 20px. The heading carries the left
    // inset (10 + 20) and the right one (10 + 8 + 26), so the count lands on the
    // durations' right edge.
    expect(soundlineCss).toMatch(/\.sn-track-artist\s*\{[\s\S]*?padding-left:\s*20px;/);
    expect(soundlineCss).toMatch(/\.sn-header\s*\{[\s\S]*?padding:\s*2px 44px 0 30px;/);
  });

  it('fades the queue bottom without hiding the last row at the end', () => {
    // The fade and the bottom padding are the same size, so only padding is
    // dimmed once the list is scrolled to its end.
    expect(soundlineCss).toMatch(
      /\.sn-queue-list\s*\{[\s\S]*?padding:\s*0 0 var\(--sn-queue-fade\)/,
    );
    expect(soundlineCss).toMatch(/mask-image:\s*linear-gradient\(to bottom, #000/);
    expect(soundlineCss).toMatch(/scroll-padding-bottom:\s*var\(--sn-queue-fade\)/);
  });

  it('grows the slider hit area on coarse pointers only', () => {
    // The visual bar stays 6px on 22px; a finger gets 44px of seek and 40px of
    // volume above the same layout. The volume target stops at the 8px gap, so it
    // never covers the bottom of a transport button.
    expect(soundlineCss).toMatch(
      /@media \(pointer: coarse\) \{[\s\S]*?\.sn-seek::after \{[\s\S]*?inset: -11px 0;/,
    );
    expect(soundlineCss).toMatch(
      /@media \(pointer: coarse\) \{[\s\S]*?\.sn-volume-slider::after \{[\s\S]*?inset: -7px 0 -11px;/,
    );
  });

  it('honours the OS reduced-motion setting', () => {
    expect(baseCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(baseCss).toContain('transition-duration: 1ms !important');
  });

  it('concatenates the four authored files in order', () => {
    const imports = [...indexCss.matchAll(/@import\s+'\.\/([\w.-]+)'/g)].map((m) => m[1]);
    expect(imports).toEqual(['tokens.css', 'base.css', 'soundline.css', 'animations.css']);
  });
});

describe('caption contrast', () => {
  /*
   * CAPTIONS ARE TEXT, SO THEY ANSWER TO WCAG AA's 4.5:1, and the surfaces they
   * land on include the tinted background of a playing row, not just the card.
   * The palette cannot be eyeballed into compliance — the previous light greys
   * looked secondary and measured 2.0:1 — so it is measured here instead.
   */

  /** `tokens.css` without its prose (the header shows tokens in a comment). */
  const css = tokensCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const lightStart = css.indexOf("[data-sn-theme='light']");

  function declarations(block: string): Map<string, string> {
    const found = new Map<string, string>();
    for (const match of block.matchAll(/(--sn-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      found.set(match[1] as string, (match[2] as string).trim());
    }
    return found;
  }

  type Rgba = readonly [number, number, number, number];

  function rgba(value: string): Rgba {
    const hex = /^#([0-9a-f]{6})$/i.exec(value);
    if (hex) {
      const number = Number.parseInt(hex[1] as string, 16);
      return [(number >> 16) & 255, (number >> 8) & 255, number & 255, 1];
    }
    const fn = /^rgba?\(([^)]+)\)$/i.exec(value);
    if (fn) {
      const parts = (fn[1] as string)
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number);
      return [parts[0] as number, parts[1] as number, parts[2] as number, parts[3] ?? 1];
    }
    throw new Error(`Unsupported colour in tokens.css: ${value}`);
  }

  /** Flattens a translucent layer onto an opaque one. */
  function over(foreground: string, background: string): Rgba {
    const [r, g, b, alpha] = rgba(foreground);
    const [br, bg, bb] = rgba(background);
    return [
      r * alpha + br * (1 - alpha),
      g * alpha + bg * (1 - alpha),
      b * alpha + bb * (1 - alpha),
      1,
    ];
  }

  function luminance([r, g, b]: Rgba): number {
    const channel = (value: number): number => {
      const s = value / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  function contrast(a: Rgba, b: Rgba): number {
    const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
      number,
      number,
    ];
    return (lighter + 0.05) / (darker + 0.05);
  }

  type Theme = { name: string; tokens: Map<string, string> };

  function themes(): Theme[] {
    return [
      { name: 'dark', tokens: declarations(css.slice(0, lightStart)) },
      { name: 'light', tokens: declarations(css.slice(lightStart)) },
    ];
  }

  function tokenColour(tokens: Map<string, string>, name: string): Rgba {
    const value = tokens.get(name);
    if (!value) throw new Error(`${name} is missing from tokens.css`);
    return rgba(value);
  }

  /** A translucent layer at `strength`, flattened onto an opaque background. */
  function tint(foreground: string, strength: number, background: string): Rgba {
    const [r, g, b, alpha] = rgba(foreground);
    return over(`rgba(${r}, ${g}, ${b}, ${alpha * strength})`, background);
  }

  /** The body of the one rule with this exact selector, from the component layer. */
  function ruleBody(selector: string): string {
    const pattern = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`${pattern}\\s*\\{([^}]*)\\}`).exec(soundlineCss);
    if (!match) throw new Error(`soundline.css has no rule for ${selector}`);
    return match[1] as string;
  }

  function declared(body: string, property: string): string {
    const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, '');
    const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i').exec(withoutComments);
    if (!match) throw new Error(`no ${property} declaration in "${body.trim()}"`);
    return (match[1] as string).trim();
  }

  function tokenUsed(value: string): string {
    const match = /var\((--sn-[a-z0-9-]+)/.exec(value);
    if (!match) throw new Error(`"${value}" does not read a token`);
    return match[1] as string;
  }

  /**
   * The surfaces captions actually land on.
   *
   * The queue is transparent now, so its rows sit on the card, not on a panel of
   * their own. A playing row is a 60% (`color-mix`) tint of the accent over that
   * card. The empty state still draws the panel surface.
   */
  function surfaces(tokens: Map<string, string>): Array<{ where: string; colour: Rgba }> {
    const card = tokens.get('--sn-surface') as string;
    return [
      { where: 'the card', colour: rgba(card) },
      { where: 'the empty state panel', colour: rgba(tokens.get('--sn-panel') as string) },
      { where: 'a control', colour: rgba(tokens.get('--sn-control') as string) },
      {
        where: 'a playing row',
        colour: tint(tokens.get('--sn-accent-soft') as string, 0.6, card),
      },
    ];
  }

  it('keeps --sn-text-muted and --sn-text-subtle at 4.5:1 in both themes', () => {
    const failures: string[] = [];

    for (const theme of themes()) {
      for (const token of ['--sn-text-muted', '--sn-text-subtle']) {
        const colour = theme.tokens.get(token);
        expect(colour, `${token} is missing from the ${theme.name} theme`).toBeDefined();
        for (const surface of surfaces(theme.tokens)) {
          const ratio = contrast(rgba(colour as string), surface.colour);
          if (ratio < 4.5) {
            failures.push(
              `${theme.name} ${token} on ${surface.where}: ${ratio.toFixed(2)}:1 (needs 4.5:1)`,
            );
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps the retry button readable in both themes', () => {
    const body = ruleBody('.sn-error button');
    // The stylesheet has to use the danger text token, not the accent one: the
    // dark danger fill is light and needs dark ink.
    expect(tokenUsed(declared(body, 'color'))).toBe('--sn-danger-contrast');
    expect(tokenUsed(declared(body, 'background'))).toBe('--sn-danger');

    const failures: string[] = [];
    for (const theme of themes()) {
      const ratio = contrast(
        tokenColour(theme.tokens, '--sn-danger-contrast'),
        tokenColour(theme.tokens, '--sn-danger'),
      );
      if (ratio < 4.5) {
        failures.push(`${theme.name} retry: ${ratio.toFixed(2)}:1 (needs 4.5:1)`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('keeps every queue row state readable in both themes', () => {
    const failures: string[] = [];
    const check = (theme: Theme, state: string, foreground: Rgba, background: Rgba): void => {
      const ratio = contrast(foreground, background);
      if (ratio < 4.5) {
        failures.push(`${theme.name} ${state}: ${ratio.toFixed(2)}:1 (needs 4.5:1)`);
      }
    };

    for (const theme of themes()) {
      const card = tokenColour(theme.tokens, '--sn-surface');
      const control = tokenColour(theme.tokens, '--sn-control-hover');

      // Resting: the row's own colour, on the card the transparent queue exposes.
      check(
        theme,
        'resting row',
        tokenColour(theme.tokens, tokenUsed(declared(ruleBody('.sn-track-item'), 'color'))),
        card,
      );

      // Hover and selected rows paint their own control-coloured background.
      check(
        theme,
        'hovered row',
        tokenColour(theme.tokens, tokenUsed(declared(ruleBody('.sn-track-item:hover'), 'color'))),
        control,
      );
      check(
        theme,
        'selected row',
        tokenColour(theme.tokens, tokenUsed(declared(ruleBody('.sn-track-item-active'), 'color'))),
        control,
      );

      // The playing row keeps a 60% accent tint. Its title is pink and its
      // artist line is a caption — both have to read on that tint.
      const playing = ruleBody('.sn-track-item-playing');
      expect(declared(playing, 'background')).toContain(
        'color-mix(in srgb, var(--sn-accent-soft) 60%, transparent)',
      );
      const playingBackground = tint(
        theme.tokens.get('--sn-accent-soft') as string,
        0.6,
        theme.tokens.get('--sn-surface') as string,
      );
      check(
        theme,
        'playing row title',
        tokenColour(
          theme.tokens,
          tokenUsed(declared(ruleBody('.sn-track-item-playing .sn-track-title'), 'color')),
        ),
        playingBackground,
      );
      check(
        theme,
        'playing row artist',
        tokenColour(theme.tokens, tokenUsed(declared(ruleBody('.sn-track-artist'), 'color'))),
        playingBackground,
      );
    }

    expect(failures).toEqual([]);
  });

  it('keeps the empty slider track visible in both themes', () => {
    /*
     * The track is a graphic, not text: 3:1 would be the WCAG target for a
     * boundary that has to be identified, which a slider with a thumb and a fill
     * does not rely on. What it does need is to exist — the light theme used to
     * paint it with `--sn-control`, one step away from the card, and the bar
     * disappeared at 0%. The bar also has to stay distinguishable from the
     * buffered part laid over it.
     */
    const failures: string[] = [];
    for (const theme of themes()) {
      const track = tokenColour(theme.tokens, '--sn-track');
      const surface = tokenColour(theme.tokens, '--sn-surface');
      const ratio = contrast(track, surface);
      if (ratio < 1.25) {
        failures.push(`${theme.name} track: ${ratio.toFixed(2)}:1 (needs 1.25:1)`);
      }

      const buffered = over(
        theme.tokens.get('--sn-border-strong') as string,
        theme.tokens.get('--sn-track') as string,
      );
      const bufferedRatio = contrast(buffered, track);
      if (bufferedRatio < 1.15) {
        failures.push(`${theme.name} buffered part: ${bufferedRatio.toFixed(2)}:1 (needs 1.15:1)`);
      }
    }

    expect(declared(ruleBody('.sn-seek-track'), 'background')).toBe('var(--sn-track)');
    expect(declared(ruleBody('.sn-volume-slider::before'), 'background')).toContain(
      'var(--sn-track)',
    );
    expect(failures).toEqual([]);
  });
});

describe('animation layer', () => {
  it('defines a rule for every hook the kits render', () => {
    for (const hook of [
      '.sn-step-host',
      '.sn-step',
      '.sn-stagger-item',
      '.sn-height',
      '.sn-height-inner',
      '.sn-eq',
    ]) {
      expect(animationsCss, hook).toContain(`${hook} {`);
    }
  });

  it('delays a staggered row by its index', () => {
    expect(animationsCss).toContain('animation-delay: calc(var(--sn-index, 0) * 40ms)');
  });

  it('animates a row that is leaving, timed by the value the queue writes', () => {
    // The rule the queue's `data-sn-exiting` hook turns on, and the one number it
    // shares with the unmount timer rather than reading a token of its own.
    expect(animationsCss).toContain("[data-sn-exiting='true']");
    expect(animationsCss).toContain('var(--sn-exit-duration');
    expect(animationsCss).toContain('@keyframes sn-row-out');
  });

  it('keeps the CSS keyframes away from the kit that animates itself', () => {
    expect(animationsCss).toContain("[data-sn-motion='true']");
  });
});
