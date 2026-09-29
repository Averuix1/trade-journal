'use client';

import { useEffect } from 'react';
import { applyTheme, isThemePref, THEME_KEY } from '@/lib/theme';

/** Keeps a System choice in step with the device, including after hydration. */
export function ThemeSync() {
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const fromDom = document.documentElement.getAttribute('data-theme-pref');
    const pref = isThemePref(stored) ? stored : isThemePref(fromDom) ? fromDom : 'dark';
    applyTheme(pref);
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      if (localStorage.getItem(THEME_KEY) === 'system') applyTheme('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return null;
}
