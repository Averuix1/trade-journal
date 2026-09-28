import { Empty } from '@/components/ui';

export function NoAccounts() {
  return (
    <Empty
      title="Add your first account"
      body="An account is one book — a Topstep eval, a funded account, or your own money. Everything else (trades, calendar, stats, rules) hangs off it."
      action={{ href: '/accounts/new', label: 'Add your first account' }}
    />
  );
}
