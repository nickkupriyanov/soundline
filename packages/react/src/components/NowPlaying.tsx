import { useState } from 'react';
import type { NowPlayingView } from '@nickkupriyanov/soundline-core';
import { useClassNames } from '../context';
import { NoteIcon } from './icons';

/** Everything the now-playing row renders. */
export interface NowPlayingProps {
  /** The current track, ready to render. */
  nowPlaying: NowPlayingView;
}

/**
 * What is playing: the artwork and the track's own labels.
 *
 * The artwork is decorative — the title next to it carries the meaning — so it
 * is always rendered with an empty `alt`. When the track has no artwork, or the
 * image fails to load, the placeholder takes its place instead of a broken
 * image. The parent keys this block on the track id, which is what resets the
 * "the image failed" flag when the track changes.
 */
export function NowPlaying({ nowPlaying }: NowPlayingProps) {
  const cls = useClassNames();
  const [failed, setFailed] = useState(false);
  const artwork = failed ? null : nowPlaying.artwork;

  return (
    <div className={cls('nowPlaying')}>
      <div className={cls('artwork')}>
        {artwork ? (
          <img
            src={artwork}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className={cls('artworkFallback')} aria-hidden="true">
            <NoteIcon width={26} height={26} />
          </span>
        )}
      </div>

      <div className={cls('trackInfo')}>
        <span className={cls('title')}>{nowPlaying.title}</span>
        {nowPlaying.artist ? <span className={cls('artist')}>{nowPlaying.artist}</span> : null}
        {nowPlaying.album ? <span className={cls('album')}>{nowPlaying.album}</span> : null}
      </div>
    </div>
  );
}
