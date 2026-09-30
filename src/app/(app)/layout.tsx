import Link from 'next/link';
import { cookies } from 'next/headers';
import { AccountSwitcher } from '@/components/account-switcher';
import { Nav } from '@/components/nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { isThemePref, THEME_KEY, type ThemePref } from '@/lib/theme';
import { logout } from '@/lib/actions/auth';
import {
  getAccountMoney,
  getHiddenDayCount,
  getScope,
  getSessionDefs,
  getSettings,
  getTrades,
  groupAccounts,
} from '@/lib/queries';
import { fmtMoney } from '@/lib/format';
import { todayKey } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const prefCookie = (await cookies()).get(THEME_KEY)?.value;
  const themePref: ThemePref = isThemePref(prefCookie) ? prefCookie : 'matrix';
  const [scope, config, sessions] = await Promise.all([getScope(), getSettings(), getSessionDefs()]);
  const today = todayKey('America/New_York');
  const [money, hiddenDays, todayTrades] = await Promise.all([
    getAccountMoney(scope.accounts),
    getHiddenDayCount(scope.accountIds),
    scope.accountIds.length
      ? getTrades({ accountIds: scope.accountIds, from: today, to: today })
      : Promise.resolve([]),
  ]);

  const quickLog = Boolean(scope.account?.isQuickLog);
  const balance = scope.account
    ? (money.get(scope.account.id)?.balance ?? 0)
    : [...money.values()].reduce((sum, m) => sum + m.balance, 0);

  const activeSessionKeys = scope.account?.activeSessions?.length
    ? scope.account.activeSessions
    : sessions.map((s) => s.key);
  const cap = scope.account?.maxTradesPerSession ?? 3;
  const counters = sessions
    .filter((s) => activeSessionKeys.includes(s.key))
    .map((s) => `${s.shortName} ${todayTrades.filter((t) => t.sessionKey === s.key).length}/${cap}`);

  return (
    <div className="min-h-screen">
      <header className="app-header sticky top-0 z-30">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
          <Link href="/" className="wordmark mr-1 text-sm font-semibold tracking-[0.14em] text-fg" aria-label="Super-Journal">
            <span className="sm:hidden">SJ</span>
            <span className="hidden sm:inline">Super-Journal</span>
          </Link>
          <AccountSwitcher groups={groupAccounts(scope.accounts)} current={scope.account} />
          {scope.account && (
            <Link href={`/accounts/${scope.account.id}`} className="btn btn-sm btn-ghost">
              Edit
            </Link>
          )}
          {scope.account && (
            <span className="pill">
              {quickLog ? 'Quick log' : scope.account.type === 'PROP' ? (scope.account.firm ?? 'Prop') : 'Personal'}
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-dim">
            {hiddenDays > 0 && (
              <Link href="/calendar" className="text-warn hover:underline">
                hiding {hiddenDays} day{hiddenDays === 1 ? '' : 's'}
              </Link>
            )}
            {scope.accounts.length > 0 && !quickLog && <span className="tabular">balance {fmtMoney(balance)}</span>}
            {scope.accounts.length > 0 && counters.length > 0 && (
              <span className="tabular hidden sm:inline">{counters.join(' · ')}</span>
            )}
            <ThemeToggle initialPref={themePref} />
            <form action={logout}>
              <button className="btn btn-sm btn-ghost" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1500px] items-center px-4 pb-2">
          <Nav />
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-[1500px] overflow-x-clip px-4 py-5">{children}</main>
      <footer className="mx-auto max-w-[1500px] px-4 pb-10 pt-4 text-[11px] text-dim">
        Times shown in {config.timezone}. Sessions and trading days are New York time.
      </footer>
    </div>
  );
}
