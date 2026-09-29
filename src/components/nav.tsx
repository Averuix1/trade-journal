'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dropdown } from '@/components/dropdown';

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

const tabClass = (active: boolean) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    active
      ? 'bg-mint-500/15 text-mint-200 ring-1 ring-inset ring-mint-500/40'
      : 'text-dim hover:bg-ink-800 hover:text-[#cdefe2]'
  }`;

export function Nav() {
  const pathname = usePathname();
  const moreActive = MORE.some((item) => isActive(pathname, item.href));

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {PRIMARY.map((item) => (
        <Link key={item.href} href={item.href} prefetch="auto" className={tabClass(isActive(pathname, item.href))}>
          {item.label}
        </Link>
      ))}
      <Dropdown
        menuClassName="left-0 w-44"
        label={() => <span className={tabClass(moreActive)}>More</span>}
      >
        {(close) =>
          MORE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch="auto"
              onClick={close}
              className={`block rounded-lg px-3 py-2 text-sm ${
                isActive(pathname, item.href) ? 'bg-mint-500/15 text-mint-200' : 'text-[#cdefe2] hover:bg-ink-800'
              }`}
            >
              {item.label}
            </Link>
          ))
        }
      </Dropdown>
    </nav>
  );
}
