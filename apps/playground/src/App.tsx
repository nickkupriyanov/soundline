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

/** Custom properties are not part of `CSSProperties`, so they get their own helper. */
const cssVars = (vars: Record<string, string>): CSSProperties => vars as CSSProperties;

const ACCENTS = {
  default: cssVars({}),
  violet: cssVars({
    '--sn-accent': '#7c5cff',
    '--sn-accent-hover': '#8f74ff',
    '--sn-accent-press': '#6a49f0',
    '--sn-accent-ink': '#ab9dff',
    '--sn-accent-soft': 'rgba(124, 92, 255, 0.18)',
    '--sn-accent-soft-strong': 'rgba(124, 92, 255, 0.3)',
    '--sn-accent-glow': 'rgba(124, 92, 255, 0.45)',
    '--sn-focus-ring': 'rgba(124, 92, 255, 0.6)',
  }),
  emerald: cssVars({
    '--sn-accent': '#16c98d',
    '--sn-accent-hover': '#1fdc9c',
    '--sn-accent-press': '#10ac77',
    '--sn-accent-ink': '#4fe0b0',
    '--sn-accent-soft': 'rgba(22, 201, 141, 0.16)',
    '--sn-accent-soft-strong': 'rgba(22, 201, 141, 0.28)',
    '--sn-accent-glow': 'rgba(22, 201, 141, 0.4)',
    '--sn-focus-ring': 'rgba(22, 201, 141, 0.55)',
  }),
  mono: cssVars({
    '--sn-accent': '#8b8b96',
    '--sn-accent-hover': '#9d9daa',
    '--sn-accent-press': '#74747f',
    '--sn-accent-ink': '#cfcfd6',
    '--sn-accent-soft': 'rgba(255, 255, 255, 0.08)',
    '--sn-accent-soft-strong': 'rgba(255, 255, 255, 0.14)',
    '--sn-accent-glow': 'rgba(0, 0, 0, 0)',
    '--sn-focus-ring': 'rgba(255, 255, 255, 0.4)',
  }),
} satisfies Record<string, CSSProperties>;

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
          <div className="surface__widget" style={ACCENTS[accent]}>
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
