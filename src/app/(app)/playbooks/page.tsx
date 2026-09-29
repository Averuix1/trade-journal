import { Card, Empty, MoneyText, Stat, StatGrid } from '@/components/ui';
import { PlaybookForm } from '@/components/playbook-form';
import { deletePlaybook } from '@/lib/actions/playbooks';
import { getPlaybookRules, getPlaybooks, getScope, getSettings, getTrades } from '@/lib/queries';
import { computeStats } from '@/lib/stats';
import { fmtNum, fmtPct, fmtR, fmtSigned } from '@/lib/format';

export const metadata = { title: 'Playbooks — Trade Journal' };

export default async function PlaybooksPage() {
  const scope = await getScope();
  const [config, playbooks, rules, trades] = await Promise.all([
    getSettings(),
    getPlaybooks(),
    getPlaybookRules(),
    scope.accountIds.length ? getTrades({ accountIds: scope.accountIds }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <Card title="New playbook">
        <PlaybookForm />
        <p className="mt-3 text-[11px] text-dim">
          A playbook is your own setup with its own checklist. Nothing is pre-filled — write the rules you actually
          trade.
        </p>
      </Card>

      {playbooks.length === 0 ? (
        <Empty title="No playbooks yet" body="Create one above, then pick it on each trade and tick the rules you kept or broke." />
      ) : (
        playbooks.map((playbook) => {
          const own = trades.filter((t) => t.playbookId === playbook.id);
          const stats = computeStats(own, config.beBandR);
          const playbookRules = rules.filter((r) => r.playbookId === playbook.id);
          return (
            <Card
              key={playbook.id}
              title={
                <span className="flex items-center gap-2">
                  <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: playbook.colour }} />
                  {playbook.name}
                </span>
              }
              action={
                <form action={deletePlaybook}>
                  <input type="hidden" name="id" value={playbook.id} />
                  <button className="btn btn-sm btn-ghost text-loss-text" type="submit">
                    Delete
                  </button>
                </form>
              }
            >
              <StatGrid cols={6}>
                <Stat label="Trades" value={stats.trades} size="sm" />
                <Stat label="Net P&L" value={fmtSigned(stats.totalPnl)} size="sm" tone={stats.totalPnl >= 0 ? 'up' : 'down'} />
                <Stat label="Win rate" value={fmtPct(stats.winRate)} size="sm" />
                <Stat label="Profit factor" value={fmtNum(stats.profitFactor)} size="sm" />
                <Stat label="Expectancy" value={fmtSigned(stats.expectancy)} size="sm" />
                <Stat label="Avg R" value={fmtR(stats.avgR)} size="sm" />
              </StatGrid>

              {playbookRules.length > 0 && (
                <div className="mt-4 scroll-x">
                  <table className="tabular">
                    <thead>
                      <tr>
                        <th className="py-1.5">Rule</th>
                        <th className="text-right">Kept</th>
                        <th className="text-right">Broke</th>
                        <th className="text-right">Follow rate</th>
                        <th className="text-right">P&L when kept</th>
                        <th className="text-right">P&L when broken</th>
                      </tr>
                    </thead>
                    <tbody className="divide-rows">
                      {playbookRules.map((rule) => {
                        const kept = own.filter((t) => t.followedRuleIds.includes(rule.id));
                        const broke = own.filter((t) => t.brokenRuleIds.includes(rule.id));
                        const seen = kept.length + broke.length;
                        return (
                          <tr key={rule.id}>
                            <td className="py-1.5 text-fg">{rule.text}</td>
                            <td className="text-right text-dim">{kept.length}</td>
                            <td className="text-right text-dim">{broke.length}</td>
                            <td className="text-right text-dim">{seen ? fmtPct((kept.length / seen) * 100) : '—'}</td>
                            <td className="text-right">
                              <MoneyText value={kept.reduce((s, t) => s + t.pnl, 0)} />
                            </td>
                            <td className="text-right">
                              <MoneyText value={broke.reduce((s, t) => s + t.pnl, 0)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-mint-300">Edit playbook</summary>
                <div className="mt-3">
                  <PlaybookForm playbook={playbook} rules={playbookRules} />
                </div>
              </details>
            </Card>
          );
        })
      )}
    </div>
  );
}
