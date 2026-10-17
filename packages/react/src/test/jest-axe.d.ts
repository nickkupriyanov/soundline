/**
 * Types for `jest-axe`, which ships none of its own.
 *
 * `@types/jest-axe` is deliberately not used: it drags the Jest globals and an
 * ancient `axe-core` into a Vitest project. Only `axe()` is ever called here, so
 * only `axe()` is declared.
 */
declare module 'jest-axe' {
  import type { AxeResults, RunOptions } from 'axe-core';

  /**
   * Runs axe on an element (or a raw HTML string) and resolves with its results.
   *
   * jest-axe disables its colour rules by itself, because jsdom never applies a
   * stylesheet and has no canvas to measure contrast with.
   */
  export function axe(element: Element | string, options?: RunOptions): Promise<AxeResults>;
}
