import 'server-only';
import { db } from '@/lib/db';
import {
  accounts,
  dayJournals,
  instruments,
  ledgerEntries,
  mistakeTags,
  playbookRules,
  playbooks,
  sessionDefs,
  settings,
  trades,
} from '@/lib/db/schema';

export async function buildBackup() {
  const [
    accountRows,
    tradeRows,
    journalRows,
    ledgerRows,
    playbookRows,
    ruleRows,
    instrumentRows,
    sessionRows,
    tagRows,
    settingsRows,
  ] = await Promise.all([
    db.select().from(accounts),
    db.select().from(trades),
    db.select().from(dayJournals),
    db.select().from(ledgerEntries),
    db.select().from(playbooks),
    db.select().from(playbookRules),
    db.select().from(instruments),
    db.select().from(sessionDefs),
    db.select().from(mistakeTags),
    db.select().from(settings),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: accountRows,
    trades: tradeRows,
    dayJournals: journalRows,
    ledgerEntries: ledgerRows,
    playbooks: playbookRows,
    playbookRules: ruleRows,
    instruments: instrumentRows,
    sessions: sessionRows,
    mistakeTags: tagRows,
    settings: settingsRows,
  };
}
