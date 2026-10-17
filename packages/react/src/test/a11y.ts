import { axe } from 'jest-axe';
import { expect } from 'vitest';

/**
 * The accessibility gate: axe found nothing wrong in this subtree.
 *
 * One call per state, not one per element: the widget is what a visitor gets,
 * and the point of the run is the combination — the region, the sliders, the
 * list, the live region and the state blocks together.
 *
 * Two things the run can never say anything about, and both are checked
 * elsewhere on purpose:
 *
 * - **Contrast.** jsdom applies no stylesheet (`css: false`) and has no canvas,
 *   so jest-axe switches its own colour rules off. The real check is a browser
 *   pass over the built stylesheet (`tools/check-layout.mjs`, Iteration 15).
 * - **What a screen reader actually says.** axe validates roles, names and
 *   states against a spec, not the announcement order. The announcement rules
 *   are asserted directly, on the live region.
 *
 * Violations are reduced to a diffable shape (`id`, `impact`, `targets`) so a
 * failure names the rule and the element instead of dumping the axe tree.
 * `incomplete` results are not failures: they are the rules axe could not decide
 * in a browserless environment.
 */
export async function expectNoA11yViolations(container: HTMLElement): Promise<void> {
  const results = await axe(container);
  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.flatMap((node) => node.target),
  }));

  expect(violations).toEqual([]);
}
