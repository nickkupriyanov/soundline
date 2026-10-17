import { createContext, useCallback, useContext, useMemo } from 'react';
import {
  SN_CLASS,
  cx,
  defaultMessages,
  type ClassValue,
  type PlayerControllerActions,
  type PlayerSnapshot,
  type SnClassSlot,
  type SoundlineLayout,
  type SoundlineMessages,
  type SoundlineTheme,
} from '@nickkupriyanov/soundline-core';
import { cssAnimations } from './animations/css';
import { DEFAULT_COMPONENTS, type SoundlineComponents } from './parts';
import type { AnimationKit } from './types';

/* -------------------------------------------------------------------------- */
/*  Flow context                                                               */
/* -------------------------------------------------------------------------- */

/** What the flow hands to a binding: one immutable snapshot and the actions. */
export interface UsePlayerFlowResult {
  snapshot: PlayerSnapshot;
  actions: PlayerControllerActions;
}

export const FlowContext = createContext<UsePlayerFlowResult | null>(null);

/**
 * Reads the player flow from the nearest `<Player>` / `<PlayerProvider>`.
 *
 * This is the hook to build a fully custom UI on top of:
 *
 * ```tsx
 * const { snapshot, actions } = usePlayerContext();
 * ```
 */
export function usePlayerContext(): UsePlayerFlowResult {
  const flow = useContext(FlowContext);
  if (!flow) {
    throw new Error(
      '[soundline] usePlayerContext() must be used inside <Player> or <PlayerProvider>.',
    );
  }
  return flow;
}

/** Internal short alias used by the built-in components. */
export const useFlow = usePlayerContext;

/* -------------------------------------------------------------------------- */
/*  UI context                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Presentation values shared by the built-in parts: how the application asked
 * the widget to look and speak, not something derived from the flow.
 */
export interface SoundlineUIContextValue {
  animations: AnimationKit;
  classNames?: Partial<Record<SnClassSlot, string>> | undefined;
  className?: string | undefined;
  autoFocus: boolean;
  messages: SoundlineMessages;
  locale: string;
  theme: SoundlineTheme;
  layout: SoundlineLayout;
  /** Parts the application replaced; anything absent falls back to the default. */
  components?: SoundlineComponents | undefined;
}

export const UIContext = createContext<SoundlineUIContextValue>({
  animations: cssAnimations,
  autoFocus: false,
  messages: defaultMessages.en,
  locale: 'en',
  theme: 'dark',
  layout: 'card',
});

export function useUI(): SoundlineUIContextValue {
  return useContext(UIContext);
}

/**
 * The parts this widget renders, with the defaults filled in.
 *
 * A replacement is per part and independent of `classNames`: a custom part keeps
 * the library's classes unless it chooses otherwise.
 */
export function useComponents(): Required<SoundlineComponents> {
  const { components } = useContext(UIContext);
  return useMemo(() => ({ ...DEFAULT_COMPONENTS, ...components }), [components]);
}

export function useAnimations(): AnimationKit {
  return useContext(UIContext).animations;
}

/** `classes('trackItem', isActive && 'is-active')` → `"sn-track-item is-active <consumer class>"`. */
export function useClassNames(): (slot: SnClassSlot, ...extra: ClassValue[]) => string {
  const { classNames } = useUI();
  return useCallback(
    (slot: SnClassSlot, ...extra: ClassValue[]) => cx(SN_CLASS[slot], classNames?.[slot], ...extra),
    [classNames],
  );
}
