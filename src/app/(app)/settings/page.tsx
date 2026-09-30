import { cookies } from 'next/headers';
import { ThemeSetting } from '@/components/theme-setting';
import { isThemePref, THEME_KEY, type ThemePref } from '@/lib/theme';
import { Card } from '@/components/ui';
import { ChecklistForm, GeneralSettingsForm, InstrumentsForm, MistakeTagForm, SessionsForm } from '@/components/settings-forms';
import { deleteMistakeTag, deleteSession } from '@/lib/actions/settings';
import { unhideAllDays } from '@/lib/actions/journal';
import { getHiddenDayCount, getInstruments, getMistakeTags, getScope, getSessionDefs, getSettings } from '@/lib/queries';

export const metadata = { title: 'Settings — Super-Journal' };

export default async function SettingsPage() {
  const [config, instruments, sessions, tags, scope] = await Promise.all([
    getSettings(),
    getInstruments(),
    getSessionDefs(),
    getMistakeTags(),
    getScope(),
  ]);
  const hiddenCount = await getHiddenDayCount(scope.accountIds);
  const prefCookie = (await cookies()).get(THEME_KEY)?.value;
  const themePref: ThemePref = isThemePref(prefCookie) ? prefCookie : 'matrix';

  return (
    <div className="space-y-5">
      <Card title="Appearance">
        <ThemeSetting initialPref={themePref} />
      </Card>

      <Card title="General">
        <GeneralSettingsForm config={config} />
      </Card>

      <Card title="Contracts &amp; commissions">
        <InstrumentsForm instruments={instruments} />
      </Card>

      <Card title="Sessions">
        <SessionsForm sessions={sessions} />
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line-soft pt-3">
          {sessions.map((s) => (
            <form key={s.key} action={deleteSession}>
              <input type="hidden" name="key" value={s.key} />
              <button className="btn btn-sm btn-ghost text-loss-text" type="submit">
                Remove {s.name}
              </button>
            </form>
          ))}
        </div>
      </Card>

      <Card title="Pre-trade checklist">
        <ChecklistForm config={config} />
      </Card>

      <Card title="Mistake tags">
        <MistakeTagForm tags={tags} />
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <form key={tag.id} action={deleteMistakeTag}>
              <input type="hidden" name="id" value={tag.id} />
              <button className="pill hover:border-loss hover:text-loss-text" type="submit" title="Remove tag">
                {tag.name} ✕
              </button>
            </form>
          ))}
        </div>
      </Card>

      <Card title="Hidden days">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-dim">
            {hiddenCount === 0
              ? 'No days are hidden. Hiding a day keeps its trades but leaves it out of the calendar, stats and desk.'
              : `${hiddenCount} day(s) are hidden from results.`}
          </p>
          {hiddenCount > 0 && (
            <form action={unhideAllDays}>
              {scope.account && <input type="hidden" name="accountId" value={scope.account.id} />}
              <button className="btn" type="submit">
                Show all hidden days
              </button>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
