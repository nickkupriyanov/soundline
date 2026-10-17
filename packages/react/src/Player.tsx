import { useMemo, useSyncExternalStore } from 'react';
import { cssAnimations } from './animations/css';
import { PlayerView } from './components/PlayerView';
import { FlowContext, UIContext } from './context';
import { usePlayerController, usePlayerUI } from './usePlayerFlow';
import type { AnimationKit, SoundlineProps, SoundlineProviderProps } from './types';

/**
 * Provides the player flow to any UI. Use it directly to build a custom widget
 * on top of `usePlayerContext()`.
 *
 * The provider owns exactly one controller: it is created here, kept in step with
 * the props, started after mounting and stopped on unmount.
 */
export function PlayerProvider<TData = unknown>(props: SoundlineProviderProps<TData>) {
  const { children } = props;
  const controller = usePlayerController(props);
  const ui = usePlayerUI(props);

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const flow = useMemo(() => ({ snapshot, actions: controller.actions }), [snapshot, controller]);

  return (
    <FlowContext.Provider value={flow}>
      <UIContext.Provider value={ui}>{children}</UIContext.Provider>
    </FlowContext.Provider>
  );
}

/**
 * Builds a `Player` bound to a specific animation kit — used by
 * `@nickkupriyanov/soundline-react/motion` and available for custom kits.
 */
export function createPlayer(animations: AnimationKit) {
  function ComposedPlayer<TData = unknown>(props: SoundlineProps<TData>) {
    return (
      <PlayerProvider {...props} animations={props.animations ?? animations}>
        <PlayerView />
      </PlayerProvider>
    );
  }
  ComposedPlayer.displayName = 'Player';
  return ComposedPlayer;
}

/**
 * The ready-made widget.
 *
 * ```tsx
 * import { Player, createMockAdapter } from '@nickkupriyanov/soundline-react';
 * import '@nickkupriyanov/soundline-react/styles.css';
 *
 * <Player adapter={createMockAdapter({ tracks })} theme="dark" locale="ru" />
 * ```
 */
export const Player = createPlayer(cssAnimations);
