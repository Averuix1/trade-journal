'use client';

import Link from 'next/link';
import type { Account } from '@/lib/db/schema';
import { Dropdown } from '@/components/dropdown';
import { selectAccount } from '@/lib/actions/accounts';

type Group = { label: string; accounts: Account[] };

function stageLabel(account: Account) {
  if (account.type === 'PERSONAL') return 'Personal';
  const stage = account.stage === 'FUNDED' ? 'Funded' : account.stage === 'BLOWN' ? 'Blown' : 'Eval';
  return `${account.firm ?? 'Prop'} · ${stage}`;
}

export function AccountSwitcher({ groups, current }: { groups: Group[]; current: Account | null }) {
  return (
    <Dropdown
      menuClassName="left-0 max-h-[70vh] w-72 overflow-y-auto"
      label={() => (
        <span className="flex items-center gap-2 rounded-lg border border-line bg-ink-850 px-3 py-1.5 text-sm font-semibold text-fg-strong hover:border-line-bright">
          <span className="max-w-[16rem] truncate">{current ? current.name : 'All accounts'}</span>
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-dim" aria-hidden>
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      )}
    >
      {(close) => (
        <>
          <form action={selectAccount} onSubmit={close}>
            <button
              name="accountId"
              value="all"
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                current == null ? 'chip-on' : 'text-fg hover:bg-ink-800'
              }`}
            >
              All accounts
            </button>
          </form>
          {groups.map((group) => (
            <div key={group.label} className="mt-1">
              <div className="px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-dim">{group.label}</div>
              <form action={selectAccount} onSubmit={close}>
                {group.accounts.map((account) => (
                  <button
                    key={account.id}
                    name="accountId"
                    value={account.id}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                      current?.id === account.id ? 'chip-on' : 'text-fg hover:bg-ink-800'
                    }`}
                  >
                    <span className="truncate">{account.name}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-dim">{stageLabel(account)}</span>
                  </button>
                ))}
              </form>
            </div>
          ))}
          <div className="mt-1 border-t border-line-soft pt-1">
            <Link href="/accounts/new" onClick={close} className="block rounded-lg px-3 py-2 text-sm text-mint-200 hover:bg-ink-800">
              + New account
            </Link>
            <Link href="/accounts" onClick={close} className="block rounded-lg px-3 py-2 text-sm text-dim hover:bg-ink-800">
              Manage accounts
            </Link>
          </div>
        </>
      )}
    </Dropdown>
  );
}
