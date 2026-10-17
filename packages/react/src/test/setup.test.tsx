import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/**
 * Proves the test environment itself works: jsdom, `@testing-library/react` and
 * the jest-dom matchers are wired up. Real suites arrive with the binding.
 */
describe('test environment', () => {
  it('renders into jsdom with jest-dom matchers available', () => {
    render(<div role="status">ready</div>);
    expect(screen.getByRole('status')).toHaveTextContent('ready');
  });
});
