import type { QueuePartProps } from '../parts';

/**
 * The queue panel: the frame around the listbox.
 *
 * The listbox, its rows and their keyboard navigation belong to the library and
 * arrive as `children`; the header row arrives as `header`, already rendered
 * through the `Header` part. A replacement places those two wherever its layout
 * wants them — this part owns neither of them.
 */
export function Queue({ slotProps, header, children }: QueuePartProps) {
  return (
    <div {...slotProps}>
      {header}
      {children}
    </div>
  );
}
