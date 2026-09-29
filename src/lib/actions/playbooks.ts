'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { playbookRules, playbooks, trades } from '@/lib/db/schema';
import { str, type FormState } from '@/lib/actions/shared';

function parseRules(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.replace(/^[-*\s]+/, '').trim())
    .filter(Boolean);
}

export async function createPlaybook(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = str(formData.get('name'));
  if (!name) return { error: 'Give the playbook a name.' };
  const [created] = await db
    .insert(playbooks)
    .values({
      name,
      description: str(formData.get('description')),
      colour: str(formData.get('colour')) ?? '#2ee6a6',
    })
    .returning({ id: playbooks.id });
  const rules = parseRules(str(formData.get('rules')));
  if (rules.length) {
    await db.insert(playbookRules).values(rules.map((text, i) => ({ playbookId: created.id, text, sortOrder: i })));
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Playbook created.' };
}

export async function updatePlaybook(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = Number(formData.get('id'));
  if (!id) return { error: 'Missing playbook.' };
  const name = str(formData.get('name'));
  if (!name) return { error: 'Give the playbook a name.' };
  await db
    .update(playbooks)
    .set({ name, description: str(formData.get('description')), colour: str(formData.get('colour')) ?? '#2ee6a6' })
    .where(eq(playbooks.id, id));

  const existing = await db.select().from(playbookRules).where(eq(playbookRules.playbookId, id));
  const next = parseRules(str(formData.get('rules')));
  // Keep ids stable for rules whose text is unchanged so historic ticks survive edits.
  const keep = new Set<number>();
  for (let i = 0; i < next.length; i += 1) {
    const match = existing.find((r) => r.text === next[i] && !keep.has(r.id));
    if (match) {
      keep.add(match.id);
      if (match.sortOrder !== i) await db.update(playbookRules).set({ sortOrder: i }).where(eq(playbookRules.id, match.id));
    } else {
      const [inserted] = await db
        .insert(playbookRules)
        .values({ playbookId: id, text: next[i], sortOrder: i })
        .returning({ id: playbookRules.id });
      keep.add(inserted.id);
    }
  }
  for (const rule of existing) {
    if (!keep.has(rule.id)) await db.delete(playbookRules).where(eq(playbookRules.id, rule.id));
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Playbook saved.' };
}

export async function deletePlaybook(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!id) return;
  await db.update(trades).set({ playbookId: null }).where(eq(trades.playbookId, id));
  await db.delete(playbookRules).where(eq(playbookRules.playbookId, id));
  await db.delete(playbooks).where(eq(playbooks.id, id));
  revalidatePath('/', 'layout');
}
