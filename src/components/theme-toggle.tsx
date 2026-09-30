'use client';

import { useEffect, useState } from 'react';
import { Dropdown } from '@/components/dropdown';
import { applyTheme, isThemePref, THEME_KEY, type ThemePref } from '@/lib/theme';

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'matrix', label: 'Matrix' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

function readPref(fallback: ThemePref): ThemePref {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (isThemePref(stored)) return stored;
  } catch {
    /* private mode */
  }
  const fromDom = document.documentElement.getAttribute('data-theme-pref');
  return isThemePref(fromDom) ? fromDom : fallback;
}

export function ThemeToggle({ initialPref = 'matrix' }: { initialPref?: ThemePref }) {
  const [pref, setPref] = useState<ThemePref>(initialPref);

  useEffect(() => {
    const sync = () => setPref(readPref(initialPref));
    sync();
    window.addEventListener('tj-theme', sync);
    return () => window.removeEventListener('tj-theme', sync);
  }, [initialPref]);

  const current = OPTIONS.find((option) => option.value === pref) ?? OPTIONS[0];

  return (
    <Dropdown
      className="shrink-0"
      menuClassName="right-0 w-36"
      label={() => (
        <span className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium uppercase tracking-wider text-dim transition hover:bg-ink-800 hover:text-fg">
          <span className="sr-only">Theme: </span>
          {current.label}
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      )}
    >
      {(close) =>
        OPTIONS.map((option) => {
          const on = pref === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={on}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm ${on ? 'chip-on' : 'text-fg hover:bg-ink-800'}`}
              onClick={() => {
                setPref(option.value);
                applyTheme(option.value);
                close();
              }}
            >
              {option.label}
            </button>
          );
        })
      }
    </Dropdown>
  );
}
