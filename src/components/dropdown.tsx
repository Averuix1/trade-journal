'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Click-to-open menu that closes on outside click, Escape, or navigation. */
export function Dropdown({
  label,
  className = '',
  menuClassName = 'left-0 w-56',
  children,
}: {
  label: (open: boolean) => ReactNode;
  className?: string;
  menuClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        {label(open)}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full z-50 mt-2 rounded-xl border border-line bg-ink-900 p-1.5 shadow-2xl shadow-black/70 ${menuClassName}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
