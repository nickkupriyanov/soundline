// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDocumentHidden, observeVisibilityChange } from './visibility';

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

function fireVisibilityChange(): void {
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  setVisibility('visible');
});

describe('isDocumentHidden', () => {
  it('reads the document', () => {
    setVisibility('hidden');
    expect(isDocumentHidden()).toBe(true);

    setVisibility('visible');
    expect(isDocumentHidden()).toBe(false);
  });
});

describe('observeVisibilityChange', () => {
  it('reports both directions, and does not report on subscribe', () => {
    setVisibility('visible');
    const seen: DocumentVisibilityState[] = [];
    const stop = observeVisibilityChange((state) => seen.push(state));

    expect(seen).toEqual([]);

    setVisibility('hidden');
    fireVisibilityChange();
    expect(seen).toEqual(['hidden']);

    setVisibility('visible');
    fireVisibilityChange();
    expect(seen).toEqual(['hidden', 'visible']);

    stop();
  });

  it('stops listening once it is removed', () => {
    const listener = vi.fn();
    const stop = observeVisibilityChange(listener);

    setVisibility('hidden');
    fireVisibilityChange();
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    setVisibility('visible');
    fireVisibilityChange();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
