'use client';

import { useState } from 'react';
import { deleteAccount } from '@/lib/actions/accounts';

export function DeleteAccountPanel({ id, name }: { id: number; name: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-dim">
          Deleting {name} can keep the trades in Quick log, or remove them with the account. Archiving is almost always
          what you want instead. Blown and archived accounts keep every trade, note and fee.
        </p>
        <button className="btn btn-danger" type="button" onClick={() => setOpen(true)}>
          Delete account…
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg">Choose what happens to the trades on {name}.</p>
      <form action={deleteAccount} className="space-y-2 rounded-xl border border-line bg-ink-850/40 p-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="mode" value="keep" />
        <button className="btn btn-primary" type="submit">
          Delete account but keep its trades (move to Quick log)
        </button>
        <p className="text-sm text-dim">
          This removes {name}. Its trades move to Quick log and each one is labelled “{name}” so you can see where it
          came from. Chart screenshots move with the trades. Day notes move too; if Quick log already has a note for
          the same day, the two notes are combined and nothing is dropped. Fees and payouts on {name} are deleted and
          are not moved. Import batches for {name} are removed. This is the default.
        </p>
      </form>
      <form action={deleteAccount} className="space-y-2 rounded-xl border border-loss bg-loss-soft p-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="mode" value="purge" />
        <button className="btn btn-danger" type="submit">
          Delete account and all its trades
        </button>
        <p className="text-sm text-loss-text">
          This permanently deletes {name} and every trade, screenshot, day note, fee and payout on it. Nothing is moved
          to Quick log. This cannot be undone.
        </p>
      </form>
      <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
