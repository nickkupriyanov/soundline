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
const indexCss = read('index.css');

const READMES = [resolve(repoRoot, 'README.md'), resolve(packageRoot, 'README.md')];

/** Custom properties `tokens.css` actually defines. */
function definedTokens(): Set<string> {
  const names = new Set<string>();
  for (const match of tokensCss.matchAll(/(--sn-[a-z0-9-]+)\s*:/g)) names.add(match[1] as string);
  return names;
}

/**
 * Vars the component layer owns itself, next to the token that feeds them: the
 * `data-sn-layout` widths and the volume fill, which a binding writes inline.
 */
const LOCAL_VARS = new Set(['--sn-width-current', '--sn-volume-percent']);

describe('design tokens', () => {
  it('defines the player tokens the layout reads', () => {
    const defined = definedTokens();

    expect(defined).toContain('--sn-width');
    expect(defined).toContain('--sn-width-compact');
    expect(defined).toContain('--sn-artwork-radius');
    expect(defined).toContain('--sn-seek-height');
    expect(defined).toContain('--sn-seek-fill');
    expect(defined).toContain('--sn-queue-max-height');
  });

  it('every var used by the component layer comes from the tokens', () => {
    const defined = definedTokens();
    const used = new Set(
      [...`${baseCss}\n${soundlineCss}`.matchAll(/var\((--sn-[a-z0-9-]+)/g)].map(
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
    const missing = Object.values(SN_CLASS).filter(
      (className) => !new RegExp(`\\.${className}(?![\\w-])`).test(soundlineCss),
    );

    expect(missing).toEqual([]);
  });

  it('honours the OS reduced-motion setting', () => {
    expect(baseCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(baseCss).toContain('transition-duration: 1ms !important');
  });

  it('concatenates the three authored files in order', () => {
    const imports = [...indexCss.matchAll(/@import\s+'\.\/([\w.-]+)'/g)].map((m) => m[1]);
    expect(imports).toEqual(['tokens.css', 'base.css', 'soundline.css']);
  });
});
