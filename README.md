# Trade Journal

A private, single-user trading journal for futures (NQ / MNQ / ES / MES), built around prop-firm
accounts such as Topstep evals and funded accounts as well as personal money.

It is a journal and nothing else. It never connects to a broker, never places or closes an order,
and has no kill switch, no sharing, no community, no AI and no billing.

---

## What it does

| Page | What you use it for |
| --- | --- |
| **Desk** | Today at a glance: balance, change from start, ROI, today's trades and R, one card per session with your T1/T2/T3 slots, your prop rules, challenge pace, equity curve and the mini month calendar. |
| **System** | "You gave $X back." Compares the account you would have had if you had only taken in-system trades against the one you actually have. Shows the leak, why it leaked, and lets you edit the rules. |
| **Calendar** | Month or week grid of green/red day tiles with a weekly totals column, filters for session, in/outside system and $/R, monthly summary cards, a daily log table, and a day side panel with the intraday curve, screenshots, trades and the day journal. |
| **Stats** | Win %, trade and day profit factor, day and trade streaks, plus process stats: rules followed vs broken, reasons by cost, weekday rule-breaks, and results by mood, sleep, grade and checklist. |
| **Tank** | How many contracts for a given stop size and risk, and how many full-risk losses you have left before the drawdown cut-off (prop) or a zero balance (personal). |
| **Trades** | Filterable list with a fast add/edit form. P&L, fees and R are calculated for you and can be overridden. |
| **Money** | Per-account ledger (eval/reset/activation/monthly/data fees, payouts, deposits, withdrawals) plus a prop-house roll-up: total fees, payouts, net, cost per pass, cost per payout, eval vs funded tape and return on spend. |
| **Playbooks** | Your own setups, each with its own rules checklist, plus per-rule follow rate and P&L. |
| **Import** | CSV import from TopstepX, Tradovate and a Google Sheets journal export, with a preview, duplicate detection and undo. Also JSON backup and restore. |
| **Settings** | Timezone, breakeven band, R display rounding, the contract table (aliases, optional point value), session windows and aliases, a pre-trade checklist and mistake tags. |
| **Accounts** | Create prop or personal accounts, mark passed/blown, archive, and log a reset that opens a fresh eval with the same rules. |

### How the rules engine works

For each account you set the sessions you trade, an entry window in minutes from each session's open,
the max trades per session (default 3) and your risk per trade. Every trade is then classified
automatically:

- the 1st, 2nd and 3rd trade of a session become **T1 / T2 / T3**;
- the 4th and beyond become **Dump**;
- an entry after the entry window, or outside any session you trade, is **Late / outside**;
- ticking a playbook rule as broken, or attaching a mistake tag, is also a break.

The Google Sheets preset reads a day-per-slot export: date, session, slot, instrument, direction, dollar risk and dollar result. It recalculates R and does not trust the sheet's formula columns. Sheet dates are New York trading days. NASDAQ and NAS100 are aliased to NQ, and US30 to YM; any other unknown name is added as a dollar / R instrument. "New York" maps to New York AM, because the file has no clock time. You pick one account, or assign rows and date ranges in the preview. $500 risk is called out as a placeholder you can keep or replace. Day notes, the rules-followed answer, the reason and chart links are stored on the day. Undoing the import removes the trades and leaves those day notes.

A trade with no breaks is **in system**. Everything else is **outside**, and that split drives the
System page, the calendar filters and the stats.

Sessions and the trading day are always New York time, so a New York session is never split across
two calendar days. Times are entered and displayed in your own timezone (Australia/Sydney by
default) — change it in Settings.

---

## Deploying to Vercel (no terminal needed)

You need three free accounts: GitHub (where this code lives), Vercel and nothing else — the
database and file storage are both created from inside Vercel.

### 1. Import the repository

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Find this repository in the list and press **Import**.
3. Leave every build setting as it is. **Do not deploy yet** — press **Environment Variables** first,
   or just deploy and fix it in step 3; the first build will succeed either way, the app will simply
   say the database is missing until you finish step 2.

### 2. Add the database (and optionally file storage)

1. Open your new project, go to the **Storage** tab.
2. Press **Create Database**, choose **Neon** (Serverless Postgres), pick the free plan and a region
   close to you, and press **Create**. Vercel connects it to the project and sets `DATABASE_URL`
   automatically.
3. Still on the **Storage** tab, press **Create** again and choose **Blob**. This is where chart
   screenshots go. Vercel sets `BLOB_READ_WRITE_TOKEN` automatically.
   *This one is optional* — without it, screenshots are stored in the database instead (up to 4 MB each).

### 3. Add your password

Go to **Settings → Environment Variables** and add two variables, for all environments:

| Name | Value |
| --- | --- |
| `APP_PASSWORD` | The password you will type to sign in. Make it long. |
| `SESSION_SECRET` | A long random string. Press the "Generate" hint below, or use any 40+ random characters. |

To generate a secret without a terminal, open [random.org/strings](https://www.random.org/strings/)
and make one 32-character string, or just mash the keyboard for 50 characters.

### 4. Redeploy

Go to the **Deployments** tab, open the most recent deployment's `...` menu and press **Redeploy**.

Database migrations run automatically as part of every build (`npm run build` runs
`node scripts/migrate.mjs` before `next build`), so there is nothing else to do. When the deployment
finishes, open the URL, type your password, and press **Add your first account**.

### Environment variables in full

| Variable | Required | Set by | What it is |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Vercel Storage → Neon | Postgres connection string. `POSTGRES_URL` is accepted as a fallback. |
| `APP_PASSWORD` | Yes | You | The single sign-in password. |
| `SESSION_SECRET` | Yes | You | Signs the session cookie. Changing it signs you out. |
| `BLOB_READ_WRITE_TOKEN` | No | Vercel Storage → Blob | Uploads screenshots to Vercel Blob. Without it they go in Postgres. |

---

## Running it locally

```bash
npm install
cp .env.example .env.local     # then edit DATABASE_URL, APP_PASSWORD, SESSION_SECRET
npm run db:migrate             # create the tables
npm run dev                    # http://localhost:3000
```

Optional, **local testing only** — fills the database with three fake accounts and around 150 fake
trades so you can see every screen with data in it. It deletes existing accounts and trades first,
so never run it against real data:

```bash
npm run seed:demo
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server. |
| `npm run build` | Runs migrations, then builds for production. |
| `npm run start` | Serves the production build. |
| `npm run typecheck` | TypeScript, no emit. |
| `npm run lint` | ESLint. |
| `npm run db:generate` | Regenerate SQL migrations after editing `src/lib/db/schema.ts`. |
| `npm run db:migrate` | Apply pending migrations. |
| `npm run verify` | End-to-end smoke test (needs a running server and `npx playwright install chromium`). Signs in, walks every page, logs a trade, saves a journal entry, hides and unhides a day, imports and undoes a CSV, and writes screenshots to `/opt/cursor/artifacts`. |

---

## Backups

**Import → Download JSON backup** gives you one file with every account, trade, journal note,
playbook, screenshot reference and money entry. **Restore from a backup** brings them back
alongside your current data, suffixed "(restored)" so nothing is ever overwritten.

---

## Stack

- Next.js 15 (App Router) and TypeScript
- Tailwind CSS
- Drizzle ORM on Postgres (Neon on Vercel, plain Postgres locally)
- Vercel Blob for screenshots, with a Postgres fallback
- Single-password auth: an HMAC-signed, httpOnly session cookie checked in middleware on every page

No trades, prices, strategies or firm rules are hardcoded. The contract table, commissions, sessions,
mistake tags, playbooks and every prop rule are all values you enter and can change.
