import { useState } from 'react';
import { useClassNames } from '../context';
import type { ArtworkPartProps } from '../parts';
import { NoteIcon } from './icons';

/**
 * The artwork of the current track.
 *
 * The artwork is decorative — the title beside it carries the meaning — so it is
 * always rendered with an empty `alt`. When the track has no artwork, or the
 * image fails to load, the placeholder takes its place instead of a broken
 * image. The parent remounts this part on every track change (`key` on the track
 * id), which is what resets the "the image failed" flag.
 *
 * A replacement owns its own fallback: the box, its class and its sizing arrive
 * in `slotProps`, and `nowPlaying.artwork` is `null` when the track has none.
 */
export function Artwork({ nowPlaying, slotProps }: ArtworkPartProps) {
  const cls = useClassNames();
  const [failed, setFailed] = useState(false);
  const artwork = failed ? null : nowPlaying.artwork;

  return (
    <div {...slotProps}>
      {artwork ? (
        <img src={artwork} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className={cls('artworkFallback')} aria-hidden="true">
          <NoteIcon width={26} height={26} />
        </span>
      )}
    </div>
  );
}
