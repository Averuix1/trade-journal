'use client';

import { useEffect, useState } from 'react';
import { applyTheme, isThemePref, THEME_KEY, type ThemePref } from '@/lib/theme';

function readPref(): ThemePref {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (isThemePref(stored)) return stored;
  } catch {
    /* private mode */
  }
  const fromDom = document.documentElement.getAttribute('data-theme-pref');
  return isThemePref(fromDom) ? fromDom : 'dark';
}

function readLight(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

export function ThemeToggle({ initialLight = false }: { initialLight?: boolean }) {
  const [light, setLight] = useState(initialLight);

  useEffect(() => {
    const sync = () => setLight(readLight());
    sync();
    window.addEventListener('tj-theme', sync);
    return () => window.removeEventListener('tj-theme', sync);
  }, []);

  const label = light ? 'Switch to dark theme' : 'Switch to light theme';

  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-dim transition hover:bg-ink-800 hover:text-fg"
      aria-label={label}
      title={label}
      onClick={() => {
        const pref = readPref();
        const resolved = pref === 'system' ? (readLight() ? 'light' : 'dark') : pref;
        const next = resolved === 'light' ? 'dark' : 'light';
        applyTheme(next);
        setLight(next === 'light');
      }}
    >
      {light ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <circle cx="8" cy="8" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.4v1.7M8 12.9v1.7M1.4 8h1.7M12.9 8h1.7M3.3 3.3l1.2 1.2M11.5 11.5l1.2 1.2M3.3 12.7l1.2-1.2M11.5 4.5l1.2-1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path
        d="M13.1 10.3A5.1 5.1 0 0 1 6.1 3.2 5.2 5.2 0 1 0 13.1 10.3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
