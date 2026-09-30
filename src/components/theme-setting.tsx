'use client';

import { useEffect, useState } from 'react';
import { applyTheme, isThemePref, THEME_KEY, type ThemePref } from '@/lib/theme';

const OPTIONS: { value: ThemePref; label: string; hint: string }[] = [
  { value: 'matrix', label: 'Matrix', hint: 'Near-black' },
  { value: 'dark', label: 'Dark', hint: 'Charcoal' },
  { value: 'light', label: 'Light', hint: 'Warm paper' },
  { value: 'system', label: 'System', hint: 'Match this device' },
];

export function ThemeSetting({ initialPref = 'matrix' }: { initialPref?: ThemePref }) {
  const [pref, setPref] = useState<ThemePref>(initialPref);

  useEffect(() => {
    const read = () => {
      const stored = localStorage.getItem(THEME_KEY);
      const fromDom = document.documentElement.getAttribute('data-theme-pref');
      setPref(isThemePref(stored) ? stored : isThemePref(fromDom) ? fromDom : 'matrix');
    };
    read();
    window.addEventListener('tj-theme', read);
    return () => window.removeEventListener('tj-theme', read);
  }, []);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
        {OPTIONS.map((option) => {
          const on = pref === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setPref(option.value);
                applyTheme(option.value);
              }}
              className={`min-w-[7.5rem] rounded-lg border px-3 py-2 text-left ${
                on ? 'chip-on border-transparent' : 'border-line bg-ink-900 text-fg hover:bg-ink-800'
              }`}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className={`mt-0.5 block text-[11px] ${on ? 'opacity-70' : 'text-dim'}`}>{option.hint}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-dim">
        Saved in this browser. Matrix is the default for a new browser. A choice already saved here stays.
      </p>
    </div>
  );
}
