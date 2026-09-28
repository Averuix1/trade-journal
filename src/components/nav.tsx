'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PRIMARY = [
  { href: '/', label: 'Desk' },
  { href: '/system', label: 'System' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/stats', label: 'Stats' },
  { href: '/tank', label: 'Tank' },
];

const MORE = [
  { href: '/trades', label: 'Trades' },
  { href: '/money', label: 'Money' },
  { href: '/playbooks', label: 'Playbooks' },
  { href: '/import', label: 'Import' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/settings', label: 'Settings' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Nav() {
  const pathname = usePathname();
  const moreActive = MORE.some((item) => isActive(pathname, item.href));

  return (
    <nav className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
      {PRIMARY.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            isActive(pathname, item.href)
              ? 'bg-mint-500/15 text-mint-200 ring-1 ring-inset ring-mint-500/40'
              : 'text-dim hover:bg-ink-800 hover:text-[#cdefe2]'
          }`}
        >
          {item.label}
        </Link>
      ))}
      <details className="group relative">
        <summary
          className={`list-none whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            moreActive ? 'bg-mint-500/15 text-mint-200 ring-1 ring-inset ring-mint-500/40' : 'text-dim hover:bg-ink-800'
          } cursor-pointer`}
        >
          More
        </summary>
        <div className="absolute left-0 top-full z-40 mt-2 w-44 rounded-xl border border-line bg-ink-900 p-1 shadow-2xl shadow-black/60">
          {MORE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm ${
                isActive(pathname, item.href) ? 'bg-mint-500/15 text-mint-200' : 'text-[#cdefe2] hover:bg-ink-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </details>
    </nav>
  );
}
