import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  createMockAdapter,
  type LoopMode,
  type PlaybackError,
  type SoundlineTheme,
} from '@nickkupriyanov/soundline-react';
import { motionAnimations } from '@nickkupriyanov/soundline-react/motion';
import { DemoPlayer, demoTracks, type DemoPlayback } from './demo';
import '@nickkupriyanov/soundline-react/styles.css';

/**
 * The accent presets: a hue and the ink that reads on it.
 *
 * Only these two values travel inline. The rest of the accent family — hover,
 * press, the soft tints, the focus ring and the ink used on card surfaces — is
 * derived from the hue in `app.css`, against the theme that is actually on, so
 * one preset works in the light and the dark theme instead of carrying one
 * theme's tuned colours into the other.
 */
const ACCENTS = {
  default: { accent: '#ff215a', contrast: '#ffffff' },
  violet: { accent: '#7c5cff', contrast: '#ffffff' },
  emerald: { accent: '#16c98d', contrast: '#06251a' },
  mono: { accent: '#8b8b96', contrast: '#171719' },
} satisfies Record<string, { accent: string; contrast: string }>;

interface LogEntry {
  id: number;
  label: string;
  detail: string;
}

export function App() {
  const [theme, setTheme] = useState<SoundlineTheme>('dark');
  const [locale, setLocale] = useState('en');
  const [layout, setLayout] = useState<'card' | 'compact'>('card');
  const [accent, setAccent] = useState<keyof typeof ACCENTS>('default');
  const [animations, setAnimations] = useState<'css' | 'motion'>('css');
  const [state, setState] = useState<DemoPlayback>('idle');
  const [showQueue, setShowQueue] = useState(true);
  const [pauseWhenHidden, setPauseWhenHidden] = useState(false);
  const [mediaSession, setMediaSession] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  // The same adapter instance serves every re-render, so switching a control
  // never reloads the playlist.
  const adapter = useMemo(() => createMockAdapter({ tracks: demoTracks }), []);

  const record = useCallback((label: string, detail: string) => {
    setLog((entries) =>
      [{ id: Date.now() + Math.random(), label, detail }, ...entries].slice(0, 6),
    );
  }, []);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1>@nickkupriyanov/soundline-react</h1>
          <p>
            Single track and playlist, dark by default, CSS-variable theming, keyboard and
            screen-reader complete.
          </p>
        </div>
        <span className="page__badge">
          {animations === 'motion' ? 'motion springs' : 'pure CSS'}
        </span>
      </header>

      <section className="controls" aria-label="Playground controls">
        <Field label="Theme">
          <select
            value={theme}
            onChange={(event) => setTheme(event.target.value as SoundlineTheme)}
          >
            <option value="dark">dark</option>
            <option value="light">light</option>
          </select>
        </Field>
        <Field label="Locale">
          <select value={locale} onChange={(event) => setLocale(event.target.value)}>
            <option value="en">en</option>
            <option value="ru">ru</option>
          </select>
        </Field>
        <Field label="Layout">
          <select
            value={layout}
            onChange={(event) => setLayout(event.target.value as 'card' | 'compact')}
          >
            <option value="card">card</option>
            <option value="compact">compact</option>
          </select>
        </Field>
        <Field label="Accent">
          <select
            value={accent}
            onChange={(event) => setAccent(event.target.value as keyof typeof ACCENTS)}
          >
            {Object.keys(ACCENTS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="State">
          <select value={state} onChange={(event) => setState(event.target.value as DemoPlayback)}>
            <option value="idle">idle</option>
            <option value="playing">playing</option>
            <option value="paused">paused</option>
            <option value="ended">ended</option>
          </select>
        </Field>
        <Field label="Animations">
          <select
            value={animations}
            onChange={(event) => setAnimations(event.target.value as 'css' | 'motion')}
          >
            <option value="css">css</option>
            <option value="motion">motion</option>
          </select>
        </Field>
        <Field label="Queue">
          <label className="page__check">
            <input
              type="checkbox"
              checked={showQueue}
              onChange={(event) => setShowQueue(event.target.checked)}
            />
            show
          </label>
        </Field>
        <Field label="Background">
          <label className="page__check">
            <input
              type="checkbox"
              checked={pauseWhenHidden}
              onChange={(event) => setPauseWhenHidden(event.target.checked)}
            />
            pause when hidden
          </label>
        </Field>
        <Field label="Media Session">
          <label className="page__check">
            <input
              type="checkbox"
              checked={mediaSession}
              onChange={(event) => setMediaSession(event.target.checked)}
            />
            claim OS controls
          </label>
        </Field>
      </section>

      <main className="page__main">
        <div className="surface">
          <div
            className="surface__widget"
            {...(accent === 'default' ? {} : { 'data-accent': accent })}
            style={
              {
                '--pg-accent': ACCENTS[accent].accent,
                '--pg-accent-contrast': ACCENTS[accent].contrast,
              } as CSSProperties
            }
          >
            <DemoPlayer
              adapter={adapter}
              theme={theme}
              locale={locale}
              layout={layout}
              state={state}
              showQueue={showQueue}
              pauseWhenHidden={pauseWhenHidden}
              mediaSession={mediaSession}
              {...(animations === 'motion' ? { animations: motionAnimations } : {})}
              onTrackChange={(trackId, metadata) =>
                record('onTrackChange', `${trackId ?? 'null'} · ${metadata.reason}`)
              }
              onPlayingChange={(playing, metadata) =>
                record('onPlayingChange', `${playing} · ${metadata.reason}`)
              }
              onLoopChange={(loop: LoopMode) => record('onLoopChange', loop)}
              onError={(error: PlaybackError, context) =>
                record('onError', `${error.code} · ${context.phase}`)
              }
            />
          </div>
        </div>

        <aside className="log" aria-live="polite">
          <h2>Events</h2>
          {log.length === 0 ? (
            <p className="log__empty">
              Play, pause, seek or pick a track to see the payloads your application receives.
            </p>
          ) : (
            <ol>
              {log.map((entry) => (
                <li key={entry.id}>
                  <code>{entry.label}</code>
                  <span>{entry.detail}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="control">
      <span>{label}</span>
      {children}
    </label>
  );
}
