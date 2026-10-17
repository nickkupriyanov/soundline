/**
 * The React binding of the player controller.
 *
 * The hook owns nothing but the lifecycle: it creates one controller per mounted
 * widget, keeps it in step with the props, and subscribes with
 * `useSyncExternalStore`. Everything the widget shows comes from the controller's
 * snapshot, so any binding renders the same derivation instead of formatting the
 * same numbers again.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  FALLBACK_THEME,
  createPlayerController,
  resolveMessages,
  type PlayerConfigInput,
  type PlayerController,
  type PlayerControllerInputs,
  type Track,
} from '@nickkupriyanov/soundline-core';
import { observeVisibilityChange } from '@nickkupriyanov/soundline-core/dom';
import { cssAnimations } from './animations/css';
import type { SoundlineUIContextValue, UsePlayerFlowResult } from './context';
import type { SoundlineProps } from './types';

export type { UsePlayerFlowResult } from './context';

/* -------------------------------------------------------------------------- */
/*  Browser defaults                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The browser language, read once and applied *after* mounting.
 *
 * The first render — the one the server also produces — uses core's deterministic
 * fallbacks, so rendering and hydration agree; the widget then switches to what
 * the visitor actually uses. Detection lives in the binding on purpose: reading
 * `navigator` is not the framework-free half's business.
 */
let cachedLocale: string | null | undefined;

function browserLocale(): string | null {
  if (cachedLocale === undefined) {
    cachedLocale =
      typeof navigator !== 'undefined' && navigator.language ? navigator.language : null;
  }
  return cachedLocale;
}

function useBrowserLocale(): string | null {
  const [locale, setLocale] = useState<string | null>(null);

  useEffect(() => {
    setLocale(browserLocale());
  }, []);

  return locale;
}

/* -------------------------------------------------------------------------- */
/*  Props → controller options                                                 */
/* -------------------------------------------------------------------------- */

function configOf<TData>(props: SoundlineProps<TData>, locale: string | null): PlayerConfigInput {
  const resolvedLocale = props.locale ?? locale;
  return {
    ...(resolvedLocale === null || resolvedLocale === undefined ? {} : { locale: resolvedLocale }),
    ...(props.messages === undefined ? {} : { messages: props.messages }),
    ...(props.theme === undefined ? {} : { theme: props.theme }),
    ...(props.layout === undefined ? {} : { layout: props.layout }),
    ...(props.seekStep === undefined ? {} : { seekStep: props.seekStep }),
    ...(props.volumeStep === undefined ? {} : { volumeStep: props.volumeStep }),
    ...(props.showQueue === undefined ? {} : { showQueue: props.showQueue }),
    ...(props.pauseWhenHidden === undefined ? {} : { pauseWhenHidden: props.pauseWhenHidden }),
    ...(props.mediaSession === undefined ? {} : { mediaSession: props.mediaSession }),
  };
}

/**
 * Narrows the loose props into the controlled/initial pairs the controller takes.
 *
 * Passing the controlled value fixes that value's mode; passing only the matching
 * `default*` seeds the initial value and lets the controller own it from there.
 */
function inputsOf<TData>(props: SoundlineProps<TData>): PlayerControllerInputs {
  const inputs: PlayerControllerInputs = {};

  if (props.queue !== undefined) inputs.queue = props.queue;
  else if (props.defaultQueue !== undefined) inputs.defaultQueue = props.defaultQueue;

  if (props.currentTrackId !== undefined) inputs.currentTrackId = props.currentTrackId;
  else if (props.defaultTrackId !== undefined) inputs.defaultTrackId = props.defaultTrackId;

  if (props.playing !== undefined) inputs.playing = props.playing;
  else if (props.defaultPlaying !== undefined) inputs.defaultPlaying = props.defaultPlaying;

  if (props.volume !== undefined) inputs.volume = props.volume;
  else if (props.defaultVolume !== undefined) inputs.defaultVolume = props.defaultVolume;

  if (props.muted !== undefined) inputs.muted = props.muted;
  else if (props.defaultMuted !== undefined) inputs.defaultMuted = props.defaultMuted;

  if (props.loop !== undefined) inputs.loop = props.loop;
  else if (props.defaultLoop !== undefined) inputs.defaultLoop = props.defaultLoop;

  if (props.shuffle !== undefined) inputs.shuffle = props.shuffle;
  else if (props.defaultShuffle !== undefined) inputs.defaultShuffle = props.defaultShuffle;

  if (props.rate !== undefined) inputs.rate = props.rate;
  else if (props.defaultRate !== undefined) inputs.defaultRate = props.defaultRate;

  return inputs;
}

/* -------------------------------------------------------------------------- */
/*  Controller                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Creates the controller once and keeps it alive for as long as the widget is
 * mounted. Nothing happens at creation — the controller starts in the effect
 * below and stops when it unmounts — so a Strict Mode double mount is harmless.
 */
export function usePlayerController<TData = unknown>(
  props: SoundlineProps<TData>,
): PlayerController {
  const browser = useBrowserLocale();
  const propsRef = useRef(props);
  propsRef.current = props;
  const browserRef = useRef(browser);
  browserRef.current = browser;

  const controllerRef = useRef<PlayerController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createPlayerController({
      adapter: props.adapter,
      ...(props.engine === undefined ? {} : { engine: props.engine }),
      ...(props.initialEngineRef === undefined ? {} : { initialEngineRef: props.initialEngineRef }),
      config: configOf(props, browser),
      inputs: inputsOf(props),
      handlers: {
        // Every handler reads the latest props, so a re-render never leaves a
        // stale callback behind.
        onProgress: (seconds, metadata) => propsRef.current.onProgress?.(seconds, metadata),
        onTrackChange: (trackId, metadata) => propsRef.current.onTrackChange?.(trackId, metadata),
        onPlayingChange: (playing, metadata) =>
          propsRef.current.onPlayingChange?.(playing, metadata),
        onVolumeChange: (volume, metadata) => propsRef.current.onVolumeChange?.(volume, metadata),
        onMutedChange: (muted, metadata) => propsRef.current.onMutedChange?.(muted, metadata),
        onLoopChange: (loop, metadata) => propsRef.current.onLoopChange?.(loop, metadata),
        onShuffleChange: (shuffle, metadata) =>
          propsRef.current.onShuffleChange?.(shuffle, metadata),
        onRateChange: (rate, metadata) => propsRef.current.onRateChange?.(rate, metadata),
        onQueueChange: (queue, metadata) =>
          propsRef.current.onQueueChange?.(queue as Track<TData>[], metadata),
        onPlay: () => propsRef.current.onPlay?.(),
        onPause: () => propsRef.current.onPause?.(),
        onEnded: () => propsRef.current.onEnded?.(),
        onError: (error, context) => propsRef.current.onError?.(error, context),
      },
    });
  }
  const controller = controllerRef.current;

  // Props are the source of truth on every render. The controller compares them
  // structurally, so re-supplying equal values costs nothing.
  useEffect(() => {
    const current = propsRef.current;
    if (current.engine !== undefined) controller.updateEngine(current.engine);
    controller.updateAdapter(current.adapter);
    controller.updateConfig(configOf(current, browserRef.current));
    controller.updateInputs(inputsOf(current));
  });

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  // A tab that goes away may sleep through playback, so the binding — not the
  // framework-free core — listens and pauses when the application asked for it.
  useEffect(
    () =>
      observeVisibilityChange((visibility) => {
        if (visibility === 'hidden' && propsRef.current.pauseWhenHidden) controller.actions.pause();
      }),
    [controller],
  );

  return controller;
}

/* -------------------------------------------------------------------------- */
/*  Public hooks                                                               */
/* -------------------------------------------------------------------------- */

function useSubscribedFlow(controller: PlayerController): UsePlayerFlowResult {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  return useMemo(() => ({ snapshot, actions: controller.actions }), [snapshot, controller]);
}

/**
 * The headless widget: the whole flow, no markup.
 *
 * ```tsx
 * const { snapshot, actions } = usePlayerFlow({ adapter });
 * ```
 */
export function usePlayerFlow<TData = unknown>(props: SoundlineProps<TData>): UsePlayerFlowResult {
  return useSubscribedFlow(usePlayerController(props));
}

/** Presentation values shared by the built-in parts. */
export function usePlayerUI<TData = unknown>(
  props: SoundlineProps<TData>,
): SoundlineUIContextValue {
  const browser = useBrowserLocale();
  const locale = props.locale ?? browser ?? 'en';
  const messages = useMemo(() => resolveMessages(locale, props.messages), [locale, props.messages]);
  const theme = props.theme ?? FALLBACK_THEME;

  return useMemo<SoundlineUIContextValue>(
    () => ({
      animations: props.animations ?? cssAnimations,
      classNames: props.classNames,
      className: props.className,
      autoFocus: props.autoFocus ?? false,
      messages,
      locale,
      theme,
      layout: props.layout ?? 'card',
      ...(props.components === undefined ? {} : { components: props.components }),
    }),
    [
      props.animations,
      props.classNames,
      props.className,
      props.autoFocus,
      props.components,
      props.layout,
      props.theme,
      messages,
      locale,
      theme,
    ],
  );
}
