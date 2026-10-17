/**
 * `@nickkupriyanov/soundline-react/motion` — the same widget, spring animations.
 *
 * `motion` is the only extra dependency and it is optional: the main entry point
 * (`@nickkupriyanov/soundline-react`) never imports this module, so an
 * application that does not opt in never ships it.
 *
 * ```tsx
 * import { Player } from '@nickkupriyanov/soundline-react/motion';
 * import '@nickkupriyanov/soundline-react/styles.css';
 *
 * <Player adapter={adapter} />;
 * ```
 */
import { createPlayer } from './Player';
import { motionAnimations } from './animations/motion';

export * from './public';
export { motionAnimations };

/** The ready-made widget, with springs instead of CSS keyframes. */
export const Player = createPlayer(motionAnimations);
