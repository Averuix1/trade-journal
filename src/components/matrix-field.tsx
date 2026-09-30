'use client';

import { useEffect, useRef } from 'react';

/** Faint scanline layer. CSS hides it unless the Matrix theme is active. */
export function MatrixField() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      el.style.animationPlayState = document.hidden ? 'paused' : 'running';
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return <div ref={ref} className="matrix-field" aria-hidden="true" />;
}
