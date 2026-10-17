import type { ReactNode } from 'react';
import {
  EmptyBlock as DefaultEmpty,
  ErrorBlock as DefaultError,
  LoadingBlock as DefaultLoading,
} from './components/blocks';

/**
 * The extension points of the widget.
 *
 * Every part receives the data it renders and the actions it triggers — nothing
 * else. The library keeps the behaviour that must not be re-implemented (focus,
 * keyboard navigation, the flow itself) and hands a part only prepared values.
 *
 * This is the minimal set the skeleton renders; the full map (transport, seek,
 * volume, queue, …) arrives with Iteration 9.
 */

/** A part is a component, or a function returning nodes — whatever fits the call site. */
export type PartComponent<Props> = (props: Props) => ReactNode;

/** The track list is being fetched. */
export interface LoadingPartProps {
  /** The accessible/visible text, already localised. */
  label: string;
}

/** The track list loaded and is empty. */
export interface EmptyPartProps {
  /** The accessible/visible text, already localised. */
  label: string;
}

/** A load failed. */
export interface ErrorPartProps {
  /** Title of the error state. */
  title: string;
  /** The human description, already localised. */
  message: string;
  /** Label of the retry button. */
  retryLabel: string;
  /** Present when retrying is meaningful. */
  onRetry?: (() => void) | undefined;
}

export interface SoundlineComponents {
  Loading?: PartComponent<LoadingPartProps>;
  Empty?: PartComponent<EmptyPartProps>;
  Error?: PartComponent<ErrorPartProps>;
}

export { DefaultEmpty, DefaultError, DefaultLoading };

/** What the widget renders when the application replaces nothing. */
export const DEFAULT_COMPONENTS: Required<SoundlineComponents> = {
  Loading: DefaultLoading,
  Empty: DefaultEmpty,
  Error: DefaultError,
};
