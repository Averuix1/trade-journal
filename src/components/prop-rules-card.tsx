import { Badge, Card, KeyValue, ProgressBar } from '@/components/ui';
import { fmtMoney, fmtPct } from '@/lib/format';
import type { PropStatus } from '@/lib/prop';

const DD_LABEL: Record<string, string> = {
  TRAILING: 'Trailing drawdown',
  EOD: 'End-of-day drawdown',
  STATIC: 'Static drawdown',
};

export function PropRulesCard({ status, name }: { status: PropStatus; name: string }) {
  return (
    <Card
      title="Prop rules"
      action={
        status.payoutReady ? <Badge tone="up">Payout ready</Badge> : <Badge tone="warn">Locked</Badge>
      }
    >
      <div className="mb-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs text-dim">Profit target</span>
          <span className="tabular text-sm font-medium text-[#e6fff5]">
            {status.profitTarget == null
              ? 'Not set'
              : status.targetLeft === 0
                ? 'Hit'
                : `${fmtMoney(status.targetLeft)} to go`}
          </span>
        </div>
        <ProgressBar pct={status.targetPct} />
        <div className="mt-1 text-[11px] text-dim">
          {fmtMoney(status.profit)} of {status.profitTarget == null ? '—' : fmtMoney(status.profitTarget)} on {name}
        </div>
      </div>

      <div className="divide-rows">
        <KeyValue
          label={status.drawdownType ? DD_LABEL[status.drawdownType] : 'Max drawdown'}
          value={
            status.drawdownLeft == null
              ? 'Not set'
              : `${fmtMoney(status.drawdownLeft)} left of ${fmtMoney(status.drawdownLimit)}`
          }
          tone={status.drawdownLeft != null && status.drawdownLeft <= 0 ? 'down' : undefined}
        />
        {status.drawdownLine != null && (
          <KeyValue
            label="Cut-off balance"
            value={`${fmtMoney(status.drawdownLine)}${status.drawdownLocked ? ' · locked at start' : ''}`}
          />
        )}
        <KeyValue
          label="Daily loss"
          value={
            status.dailyLossLimit == null
              ? 'No daily cap set'
              : `${fmtMoney(status.dailyLossLeft)} left of ${fmtMoney(status.dailyLossLimit)}`
          }
          tone={status.dailyLossLeft === 0 ? 'down' : undefined}
        />
        <KeyValue
          label="Consistency"
          value={
            status.consistencyPct == null
              ? 'No % cap set'
              : status.consistencyActual == null
                ? `Cap ${status.consistencyPct}% · no profit yet`
                : `${fmtPct(status.consistencyActual)} best day · cap ${status.consistencyPct}%`
          }
          tone={status.consistencyOk ? undefined : 'down'}
        />
        {status.consistencyGap != null && (
          <KeyValue label="To unlock consistency" value={`${fmtMoney(status.consistencyGap)} more profit`} />
        )}
        <KeyValue
          label="Trading days"
          value={
            status.minTradingDays == null
              ? `${status.tradingDays} logged`
              : `${status.tradingDays} of ${status.minTradingDays}`
          }
        />
        <KeyValue label="Best day" value={fmtMoney(status.bestDay)} />
      </div>

      <p className="mt-3 text-[11px] text-dim">
        {status.blockers.length
          ? `Blocked by: ${status.blockers.join(', ')}.`
          : 'All the rules you entered are satisfied.'}{' '}
        All figures come from the rules you typed in — check them against your firm.
      </p>
    </Card>
  );
}
