/**
 * Local-only demo data. Never run this against the account you actually journal in.
 *   npm run seed:demo
 */
import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db/index';
import {
  accounts,
  dayJournals,
  imports,
  instruments,
  ledgerEntries,
  mistakeTags,
  playbookRules,
  playbooks,
  screenshots,
  sessionDefs,
  settings,
  trades,
} from '../src/lib/db/schema';
import { DEFAULT_INSTRUMENTS, DEFAULT_MISTAKE_TAGS, DEFAULT_SESSIONS } from '../src/lib/defaults';
import { autoFees, autoPnl, autoR, classifyDay, round2 } from '../src/lib/calc';
import { tradingDay, zonedInputToUtc } from '../src/lib/time';

const TZ = 'America/New_York';

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry(20260928);
const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)];
const pad = (n: number) => String(n).padStart(2, '0');

async function reset() {
  await db.delete(screenshots);
  await db.delete(trades);
  await db.delete(dayJournals);
  await db.delete(ledgerEntries);
  await db.delete(imports);
  await db.delete(playbookRules);
  await db.delete(playbooks);
  await db.delete(accounts);
  await db.execute(sql`alter sequence accounts_id_seq restart with 1`);
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  await db.insert(instruments).values(DEFAULT_INSTRUMENTS).onConflictDoNothing();
  await db.insert(sessionDefs).values(DEFAULT_SESSIONS).onConflictDoNothing();
  const tags = await db.select().from(mistakeTags).limit(1);
  if (!tags.length) {
    await db.insert(mistakeTags).values(DEFAULT_MISTAKE_TAGS.map((name, i) => ({ name, sortOrder: i })));
  }
}

function weekdaysBack(count: number): string[] {
  const out: string[] = [];
  const cursor = new Date();
  while (out.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      out.push(`${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}-${pad(cursor.getUTCDate())}`);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return out.reverse();
}

async function main() {
  console.log('Seeding demo data…');
  await reset();

  const startDate = weekdaysBack(45)[0];

  const [evalAccount] = await db
    .insert(accounts)
    .values({
      name: '50K Combine #1',
      type: 'PROP',
      stage: 'BLOWN',
      status: 'ARCHIVED',
      firm: 'Topstep',
      program: 'Combine',
      accountSize: 50000,
      startingBalance: 50000,
      startDate,
      profitTarget: 3000,
      maxDrawdown: 2000,
      drawdownType: 'TRAILING',
      dailyLossLimit: 1000,
      consistencyPct: 50,
      minTradingDays: 5,
      maxTradesPerSession: 3,
      riskPerTrade: 300,
      activeSessions: ['london', 'ny_am', 'ny_pm'],
      entryWindows: { london: 45, ny_am: 30, ny_pm: 30 },
      sortOrder: 0,
    })
    .returning();

  const [mainAccount] = await db
    .insert(accounts)
    .values({
      name: '50K Combine #2',
      type: 'PROP',
      stage: 'EVAL',
      firm: 'Topstep',
      program: 'Combine',
      accountSize: 50000,
      startingBalance: 50000,
      targetBalance: 53000,
      startDate: weekdaysBack(30)[0],
      profitTarget: 3000,
      maxDrawdown: 2000,
      drawdownType: 'TRAILING',
      dailyLossLimit: 1000,
      consistencyPct: 50,
      minTradingDays: 5,
      maxTradesPerSession: 3,
      riskPerTrade: 300,
      activeSessions: ['london', 'ny_am', 'ny_pm'],
      entryWindows: { london: 45, ny_am: 30, ny_pm: 30 },
      resetOfAccountId: evalAccount.id,
      sortOrder: 1,
    })
    .returning();

  const [personal] = await db
    .insert(accounts)
    .values({
      name: 'Personal futures',
      type: 'PERSONAL',
      startingBalance: 12000,
      targetBalance: 20000,
      startDate: weekdaysBack(45)[0],
      maxTradesPerSession: 3,
      riskPerTrade: 200,
      activeSessions: ['ny_am'],
      entryWindows: { ny_am: 30 },
      sortOrder: 2,
    })
    .returning();

  const [breakout] = await db
    .insert(playbooks)
    .values({ name: 'Opening range break', description: 'First push out of the 15m range', colour: '#22d39a' })
    .returning();
  const [reversal] = await db
    .insert(playbooks)
    .values({ name: 'Failed breakdown', description: 'Sweep of the low then reclaim', colour: '#4f9fe8' })
    .returning();

  const breakoutRules = await db
    .insert(playbookRules)
    .values([
      { playbookId: breakout.id, text: 'Range marked before the open', sortOrder: 0 },
      { playbookId: breakout.id, text: 'Waited for the retest', sortOrder: 1 },
      { playbookId: breakout.id, text: 'Stop behind the range', sortOrder: 2 },
    ])
    .returning();
  const reversalRules = await db
    .insert(playbookRules)
    .values([
      { playbookId: reversal.id, text: 'Prior day low swept', sortOrder: 0 },
      { playbookId: reversal.id, text: 'Reclaim confirmed on the 1m close', sortOrder: 1 },
    ])
    .returning();

  await db.insert(ledgerEntries).values([
    { accountId: evalAccount.id, date: startDate, kind: 'EVAL_FEE', amount: 49, note: 'Combine subscription' },
    { accountId: evalAccount.id, date: startDate, kind: 'MONTHLY_FEE', amount: 49, note: 'Month 2' },
    { accountId: mainAccount.id, date: mainAccount.startDate, kind: 'RESET_FEE', amount: 49, note: 'Reset after #1' },
    { accountId: personal.id, date: personal.startDate, kind: 'DEPOSIT', amount: 3000, note: 'Top-up' },
  ]);

  const sessionTimes: Record<string, [number, number]> = {
    london: [3 * 60, 45],
    ny_am: [9 * 60 + 30, 30],
    ny_pm: [13 * 60, 30],
  };

  type Plan = { account: typeof mainAccount; days: string[]; bias: number };
  const plans: Plan[] = [
    { account: evalAccount, days: weekdaysBack(45).slice(0, 14), bias: -0.12 },
    { account: mainAccount, days: weekdaysBack(30), bias: 0.22 },
    { account: personal, days: weekdaysBack(45).filter((_, i) => i % 3 === 0), bias: 0.1 },
  ];

  let totalTrades = 0;
  for (const plan of plans) {
    for (const date of plan.days) {
      if (rand() < 0.25) continue;
      const sessionsToday = (plan.account.activeSessions as string[]).filter(() => rand() < 0.65);
      if (!sessionsToday.length) continue;

      for (const sessionKey of sessionsToday) {
        const [startMinute, windowMins] = sessionTimes[sessionKey] ?? [9 * 60 + 30, 30];
        const count = 1 + Math.floor(rand() * 3) + (rand() < 0.12 ? 1 : 0);
        for (let i = 0; i < count; i += 1) {
          const late = i >= 3 || rand() < 0.1;
          const offset = late ? windowMins + 5 + Math.floor(rand() * 60) : Math.floor(rand() * windowMins);
          const minute = startMinute + offset;
          const openedAt = zonedInputToUtc(`${date}T${pad(Math.floor(minute / 60) % 24)}:${pad(minute % 60)}`, TZ);
          const closedAt = new Date(openedAt.getTime() + (3 + Math.floor(rand() * 40)) * 60000);

          const symbol = rand() < 0.65 ? 'MNQ' : 'NQ';
          const spec = DEFAULT_INSTRUMENTS.find((s) => s.symbol === symbol)!;
          const contracts = symbol === 'MNQ' ? 4 + Math.floor(rand() * 6) : 1;
          const side = rand() < 0.55 ? 'LONG' : 'SHORT';
          const entry = round2(19800 + rand() * 900);
          const stopPts = 20 + Math.floor(rand() * 16);
          const stop = side === 'LONG' ? round2(entry - stopPts) : round2(entry + stopPts);

          const win = rand() < 0.52 + plan.bias * 0.4;
          const rMove = win ? 0.7 + rand() * 2.1 : -(0.55 + rand() * 0.75);
          const movePts = round2(stopPts * rMove);
          const exit = side === 'LONG' ? round2(entry + movePts) : round2(entry - movePts);

          const fees = autoFees(contracts, spec.commissionPerContract);
          const pnl = autoPnl(side, entry, exit, contracts, spec.pointValue, fees) ?? 0;
          const rMultiple = autoR(side, entry, stop, contracts, spec.pointValue, pnl);

          const playbook = rand() < 0.75 ? (rand() < 0.6 ? breakout : reversal) : null;
          const rules = playbook?.id === breakout.id ? breakoutRules : reversalRules;
          const brokeRule = playbook && rand() < 0.16;
          const mistakes = rand() < 0.1 ? [pick(['Revenge', 'FOMO', 'Chased move'])] : [];

          await db.insert(trades).values({
            accountId: plan.account.id,
            openedAt,
            closedAt,
            tradeDate: tradingDay(openedAt),
            symbol,
            side,
            contracts,
            entryPrice: entry,
            stopPrice: stop,
            exitPrice: exit,
            fees,
            pnl,
            rMultiple,
            playbookId: playbook?.id ?? null,
            followedRuleIds: playbook && !brokeRule ? rules.map((r) => r.id) : [],
            brokenRuleIds: brokeRule ? [pick(rules).id] : [],
            mistakeTags: mistakes,
            externalId: `demo-${plan.account.id}-${date}-${sessionKey}-${i}`,
          });
          totalTrades += 1;
        }
      }
    }
  }

  // Re-derive session, slot and break flags exactly the way the app does.
  const defs = await db.select().from(sessionDefs).orderBy(sessionDefs.sortOrder);
  for (const account of [evalAccount, mainAccount, personal]) {
    const rows = await db.select().from(trades);
    const mine = rows.filter((r) => r.accountId === account.id);
    const byDate = new Map<string, typeof mine>();
    for (const row of mine) {
      const list = byDate.get(row.tradeDate) ?? [];
      list.push(row);
      byDate.set(row.tradeDate, list);
    }
    for (const [, dayTrades] of byDate) {
      const classified = classifyDay(dayTrades, account, defs);
      for (const trade of dayTrades) {
        const c = classified.get(trade.id);
        if (!c) continue;
        await db
          .update(trades)
          .set({ sessionKey: c.sessionKey, slot: c.slot, breaks: c.breaks, inSystem: c.inSystem })
          .where(sql`${trades.id} = ${trade.id}`);
      }
    }
  }

  const recentDays = weekdaysBack(12);
  const moods = [3, 4, 5, 2, 4];
  await db.insert(dayJournals).values(
    recentDays.slice(0, 8).map((date, i) => ({
      accountId: mainAccount.id,
      date,
      grade: ['A', 'B', 'C', 'B', 'A', 'D', 'B', 'C'][i],
      mood: moods[i % moods.length],
      sleepHours: 6 + (i % 3),
      followedPlan: i % 4 !== 0,
      lesson: i % 2 ? 'Let T1 work instead of adding.' : 'Only took the level I marked pre-open.',
      notes: 'Marked levels pre-open, waited for the retest. Second entry was the only clean one.',
      hidden: i === 0,
      satOut: false,
    })),
  );

  console.log(`Done. ${totalTrades} demo trades across 3 accounts.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
