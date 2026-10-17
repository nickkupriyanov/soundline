import { useClassNames } from '../context';
import type { NowPlayingPartProps } from '../parts';

/**
 * What is playing: the artwork and the track's own labels.
 *
 * The artwork arrives as `children`, already rendered through the `Artwork`
 * part, so a replacement decides where it sits rather than how it loads. The
 * labels are the derived ones, so the row can never disagree with the announcer.
 */
export function NowPlaying({ nowPlaying, slotProps, children }: NowPlayingPartProps) {
  const cls = useClassNames();

  return (
    <div {...slotProps}>
      {children}

      <div className={cls('trackInfo')}>
        <span className={cls('title')}>{nowPlaying.title}</span>
        {nowPlaying.artist ? <span className={cls('artist')}>{nowPlaying.artist}</span> : null}
        {nowPlaying.album ? <span className={cls('album')}>{nowPlaying.album}</span> : null}
      </div>
    </div>
  );
}
