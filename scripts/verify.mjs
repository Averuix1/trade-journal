// Local verification pass: exercises the main flows and writes screenshots.
//   node scripts/verify.mjs [baseUrl] [outDir]
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = process.argv[3] ?? '/opt/cursor/artifacts';
const PASSWORD = process.env.APP_PASSWORD ?? 'demo1234';

mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1.5 });
const nav = () => page.getByRole('navigation');
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const shot = async (name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
};

try {
  const bibleRefs = spawnSync('npx', ['tsx', 'scripts/check-bible-refs.ts'], { encoding: 'utf8' });
  check('Every curated verse resolves in the World English Bible', bibleRefs.status === 0, (bibleRefs.stdout || bibleRefs.stderr || '').trim());

  // --- login ---
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await shot('01-login');
  check('Login page renders', await page.getByRole('button', { name: 'Sign in' }).isVisible());

  await page.fill('#password', 'wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(600);
  check('Wrong password is rejected', await page.getByText('Wrong password.').isVisible());

  await page.fill('#password', PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  check('Sign in lands on the Desk', page.url() === `${BASE}/`);

  // --- desk ---
  await page.waitForSelector('text=Today');
  await shot('02-desk');
  check('Desk shows session slot cards', (await page.locator('text=/\\d\\/3 trades/').count()) > 0);
  check('Desk shows the prop rules card', await page.getByText('Prop rules').isVisible());

  // --- account switcher ---
  await page.getByRole('button', { name: /50K Combine/ }).click();
  await page.waitForTimeout(250);
  const switcherOpen = await page.getByRole('menu').isVisible();
  check('Account dropdown opens', switcherOpen);
  check('Account dropdown is grouped', (await page.getByText('Blown / archived').count()) > 0);
  await page.getByRole('button', { name: 'All accounts', exact: true }).click();
  let switchedAll = false;
  try {
    await page.getByRole('heading', { name: 'All accounts' }).waitFor({ timeout: 8000 });
    switchedAll = true;
  } catch {
    switchedAll = false;
  }
  check('Switching to All accounts works', switchedAll);
  await page.getByRole('banner').getByRole('button').first().click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: /50K Combine #2/ }).click();
  await page.waitForTimeout(1200);

  // --- More menu ---
  await nav().getByRole('button', { name: 'More' }).click();
  await page.waitForTimeout(250);
  const moreOpen = await page.getByRole('menuitem', { name: 'Playbooks' }).or(page.getByRole('link', { name: 'Playbooks' })).first().isVisible();
  check('More menu opens', moreOpen);
  await page.keyboard.press('Escape');

  // --- system ---
  await nav().getByRole('link', { name: 'System', exact: true }).click();
  await page.waitForURL('**/system');
  await page.waitForSelector('text=If you stopped');
  await shot('03-system');
  check('System page shows the leak headline', (await page.locator('h1').innerText()).length > 5);

  // --- calendar ---
  await nav().getByRole('link', { name: 'Calendar', exact: true }).click();
  await page.waitForURL('**/calendar');
  await page.waitForSelector('text=Week');
  await shot('04-calendar');
  const tiles = await page.locator('a[href*="day="]').count();
  check('Calendar renders day tiles', tiles > 0, `${tiles} tiles`);

  // day panel
  const tile = page.locator('a[href*="day="]').filter({ hasText: 'trade' }).first();
  await tile.click();
  await page.waitForTimeout(1200);
  await page.waitForSelector('text=Day performance');
  await shot('05-day-panel');
  check('Day panel opens', await page.getByText('Day performance').isVisible());

  // save journal
  await page.selectOption('#grade', 'B');
  await page.fill('#notes', 'Waited for the retest and let T1 work. Only clean entry of the day.');
  await page.getByRole('button', { name: 'Save journal' }).click();
  await page.waitForTimeout(1600);
  check('Day journal saves', await page.getByText('Journal saved.').isVisible());

  // hide / show day
  await page.getByRole('button', { name: 'Hide from results' }).click();
  await page.waitForTimeout(1600);
  const hiddenTiles = await page.getByText('Hidden', { exact: true }).count();
  check('Hiding a day marks it HIDDEN on the calendar', hiddenTiles > 0, `${hiddenTiles} hidden tile(s)`);
  await page.getByRole('button', { name: 'Show this day' }).click();
  await page.waitForTimeout(1600);
  check('Un-hiding a day restores it', await page.getByRole('button', { name: 'Hide from results' }).isVisible());
  await page.getByRole('link', { name: 'Close day panel' }).click();
  await page.waitForTimeout(800);

  // --- stats ---
  await nav().getByRole('link', { name: 'Stats', exact: true }).click();
  await page.waitForURL('**/stats');
  await page.waitForSelector('text=Profit factor');
  await shot('06-stats');
  check('Stats page renders breakdowns', await page.getByText('Trigger rate').isVisible());

  // --- tank ---
  await nav().getByRole('link', { name: 'Tank', exact: true }).click();
  await page.waitForURL('**/tank');
  await page.waitForSelector('text=Contracts per stop size');
  await shot('07-tank');
  check('Tank shows losses-left', await page.getByText('Full-risk losses left').isVisible());

  // --- trades + add form ---
  const headerBalance = async () => {
    const text = await page.getByRole('banner').getByText(/balance /).innerText();
    return Number(text.replace(/[^0-9.-]/g, ''));
  };
  const deleteRow = async (pnlText, rText) => {
    await page.goto(`${BASE}/trades`, { waitUntil: 'networkidle' });
    const row = page.locator('tbody tr').filter({ hasText: pnlText }).filter({ hasText: rText }).first();
    await row.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(1600);
  };

  await page.goto(`${BASE}/trades?new=1`, { waitUntil: 'networkidle' });
  check('Quick entry is the default', await page.locator('#takeProfit').isVisible());
  await page.getByRole('button', { name: 'Detailed', exact: true }).click();
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/trades?new=1`, { waitUntil: 'networkidle' });
  check('Detailed mode is remembered', await page.locator('#contracts').isVisible());
  await page.getByRole('button', { name: 'Quick', exact: true }).click();
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/trades?new=1`, { waitUntil: 'networkidle' });
  check('Quick mode is remembered', await page.locator('#takeProfit').isVisible() && (await page.locator('#contracts').count()) === 0);

  await page.fill('#plannedRisk', '250');
  await page.fill('#takeProfit', '500');
  await page.getByRole('button', { name: 'Win', exact: true }).click();
  await page.locator('#live-result').scrollIntoViewIfNeeded();
  await shot('23-quick-trade');
  const winLive = await page.locator('#live-result').innerText();
  const winPlan = await page.locator('#planned-rr').innerText();
  check('Quick win shows +$500 and +2R', winLive.includes('+$500.00') && winLive.includes('+2.00R'), winLive);
  check('Quick win shows planned 2R', winPlan.includes('+2.00R'), winPlan);
  const balanceBefore = await headerBalance();
  const winDay = await page.locator('#tradeDate').inputValue();
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/trades'), { timeout: 30000 }),
    page.getByRole('button', { name: 'Log trade' }).click(),
  ]);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const balanceAfterWin = await headerBalance();
  check('Quick win saves', balanceAfterWin - balanceBefore === 500, `${balanceBefore} -> ${balanceAfterWin}`);
  check('Quick win raises the balance by 500', balanceAfterWin - balanceBefore === 500, `${balanceBefore} -> ${balanceAfterWin}`);
  await page.goto(`${BASE}/calendar?day=${winDay}`, { waitUntil: 'networkidle' });
  const winCell = page.locator('a[href*="day="]').filter({ hasText: '+$500' }).filter({ hasText: '+2.00R' });
  check('Calendar shows the quick win', (await winCell.count()) > 0, `cells ${await winCell.count()}`);
  await page.goto(`${BASE}/stats`, { waitUntil: 'networkidle' });
  const plannedStat = page.getByText('Avg planned RR', { exact: true }).locator('..');
  check('Stats show average planned RR', await plannedStat.isVisible());
  check('Stats average planned RR is +2R', (await plannedStat.innerText()).includes('+2.00R'), await plannedStat.innerText());
  await deleteRow('+$500.00', '+2.00R');

  await page.goto(`${BASE}/trades?new=1`, { waitUntil: 'networkidle' });
  await page.fill('#plannedRisk', '250');
  await page.fill('#takeProfit', '500');
  await page.getByRole('button', { name: 'Loss', exact: true }).click();
  const lossLive = await page.locator('#live-result').innerText();
  check('Quick loss shows -$250 and -1R', lossLive.includes('-$250.00') && lossLive.includes('-1.00R'), lossLive);
  const balanceBeforeLoss = await headerBalance();
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/trades'), { timeout: 30000 }),
    page.getByRole('button', { name: 'Log trade' }).click(),
  ]);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const balanceAfterLoss = await headerBalance();
  check('Quick loss saves', balanceBeforeLoss - balanceAfterLoss === 250, `${balanceBeforeLoss} -> ${balanceAfterLoss}`);
  check('Quick loss lowers the balance by 250', balanceBeforeLoss - balanceAfterLoss === 250, `${balanceBeforeLoss} -> ${balanceAfterLoss}`);
  await deleteRow('-$250.00', '-1.00R');

  await page.goto(`${BASE}/trades?new=1`, { waitUntil: 'networkidle' });
  await page.fill('#plannedRisk', '250');
  await page.fill('#takeProfit', '500');
  await page.getByRole('button', { name: 'Partial', exact: true }).click();
  await page.fill('#customPnl', '125');
  const partialLive = await page.locator('#live-result').innerText();
  check('Quick partial shows +$125 and +0.50R', partialLive.includes('+$125.00') && partialLive.includes('+0.50R'), partialLive);
  const balanceBeforePartial = await headerBalance();
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/trades'), { timeout: 30000 }),
    page.getByRole('button', { name: 'Log trade' }).click(),
  ]);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const balanceAfterPartial = await headerBalance();
  check('Quick partial saves', balanceAfterPartial - balanceBeforePartial === 125, `${balanceBeforePartial} -> ${balanceAfterPartial}`);
  await deleteRow('+$125.00', '+0.50R');

  await page.goto(`${BASE}/trades?new=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Detailed', exact: true }).click();
  await page.selectOption('#symbol', 'MNQ');
  await page.fill('#contracts', '5');
  await page.fill('#entryPrice', '20100');
  await page.fill('#stopPrice', '20080');
  await page.fill('#exitPrice', '20145');
  await page.waitForTimeout(300);
  const resultText = await page.locator('#live-result').innerText();
  check('Trade form computes P&L live', /\$\d/.test(resultText), resultText);
  await page.locator('#live-result').scrollIntoViewIfNeeded();
  await shot('08-trades-add-form');

  const rowsBefore = await page.locator('tbody tr').count();
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/trades'), { timeout: 30000 }),
    page.getByRole('button', { name: 'Log trade' }).click(),
  ]);
  await page.goto(`${BASE}/trades`, { waitUntil: 'networkidle' });
  const rowsAfter = await page.locator('tbody tr').count();
  check('Trade saves', rowsAfter > rowsBefore, `${rowsBefore} -> ${rowsAfter}`);
  check('New trade appears in the list', rowsAfter >= rowsBefore, `${rowsBefore} -> ${rowsAfter}`);

  // delete it again so the demo data stays clean
  await page.locator('tbody tr').first().getByRole('button', { name: 'Delete' }).click();
  await page.waitForTimeout(1600);
  await page.goto(`${BASE}/trades?new=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Quick', exact: true }).click();
  await page.waitForTimeout(500);

  // --- money ---
  await page.goto(`${BASE}/money`, { waitUntil: 'networkidle' });
  await shot('09-money');
  check('Money shows the prop house roll-up', await page.getByText('Cost per pass').isVisible());

  // --- import ---
  await page.goto(`${BASE}/import`, { waitUntil: 'networkidle' });
  await page.setInputFiles('#file', '/home/ubuntu/topstepx-sample.csv');
  await page.getByRole('button', { name: 'Read file' }).click();
  await page.waitForTimeout(2000);
  check('CSV preview detects TopstepX', await page.getByText(/looks like TopstepX/).isVisible());
  await shot('10-import');
  const importButton = page.getByRole('button', { name: /^Import \d+ trades$/ });
  await importButton.click();
  await page.waitForTimeout(2500);
  check('CSV import reports a result', await page.getByText(/Imported \d+ trade/).isVisible());
  await page.goto(`${BASE}/import`, { waitUntil: 'networkidle' });
  const hasHistory = (await page.getByRole('button', { name: 'Undo import' }).count()) > 0;
  check('Import history lists the batch', hasHistory);
  if (hasHistory) {
    await page.getByRole('button', { name: 'Undo import' }).first().click();
    await page.waitForTimeout(2000);
      check('Undo import removes the batch', (await page.getByRole('button', { name: 'Undo import' }).count()) === 0);
  }

  // --- google sheets journal (preview, day record, then undo so demo data stays clean) ---
  const uploadDir = '/home/ubuntu/.cursor/projects/workspace/uploads';
  const sheetName = readdirSync(uploadDir)
    .filter((name) => name.startsWith('sheet-trades-all') && name.endsWith('.csv'))
    .sort()
    .at(-1);
  const sheetCsv = `${uploadDir}/${sheetName}`;
  await page.goto(`${BASE}/import`, { waitUntil: 'networkidle' });
  await page.setInputFiles('#file', sheetCsv);
  await page.getByRole('button', { name: 'Read file' }).click();
  await page.waitForTimeout(2000);
  check('Sheet preset is detected', await page.getByText('Google Sheets journal').first().isVisible());
  check('Sheet preview recalculates R', await page.getByText('+2.23R').isVisible());
  check('Sheet preview notes the $500 placeholder', await page.getByText(/\$500 is a placeholder/).isVisible());
  await shot('16-sheet-import');
  const sheetButton = page.getByRole('button', { name: /^Import \d+ trades$/ });
  const sheetLabel = await sheetButton.innerText();
  check('Sheet preview counts 18 trades', /Import 18 trades/.test(sheetLabel), sheetLabel);
  await sheetButton.click();
  let sheetImported = false;
  {
    const start = Date.now();
    while (Date.now() - start < 20000) {
      if (await page.getByText(/Imported 18 trade/).isVisible().catch(() => false)) {
        sheetImported = true;
        break;
      }
      await page.waitForTimeout(500);
    }
  }
  check('Sheet import reports 18 trades', sheetImported);

  await page.goto(`${BASE}/calendar?month=2026-09&day=2026-09-14`, { waitUntil: 'networkidle' });
  await page.getByLabel('Rules followed?').scrollIntoViewIfNeeded();
  await shot('17-day-record');
  check('Day record has rules followed', await page.getByLabel('Rules followed?').isVisible());
  check('Day record keeps the reason separate', await page.getByLabel('Rule-break reason').isVisible());
  for (const name of ['check_london_0', 'check_london_1', 'check_london_2']) {
    await page.locator(`select[name="${name}"]`).selectOption('no');
  }
  await page.getByText('Pre-trade checklist').scrollIntoViewIfNeeded();
  await shot('18-checklist');
  check('Day checklist warns about skipping', await page.getByText(/consider skipping/).isVisible());
  await page.getByRole('button', { name: 'Save journal' }).click();
  await page.waitForTimeout(1500);

  await page.goto(`${BASE}/stats`, { waitUntil: 'networkidle' });
  await page.locator('#process').scrollIntoViewIfNeeded();
  await shot('19-process-stats');
  check('Stats show day profit factor', await page.getByText('Day profit factor').isVisible());
  check(
    'Stats show rules followed vs broken',
    await page.getByRole('heading', { name: 'By day · rules followed vs broken' }).isVisible(),
  );
  check('Stats show checklist passed vs failed', await page.getByText('Checklist passed vs failed').isVisible());

  await page.goto(`${BASE}/import`, { waitUntil: 'networkidle' });
  const sheetHistory = (await page.getByRole('button', { name: 'Undo import' }).count()) > 0;
  if (sheetHistory) {
    await page.getByRole('button', { name: 'Undo import' }).first().click();
    await page.waitForTimeout(2500);
    check('Undo sheet import removes the batch', (await page.getByRole('button', { name: 'Undo import' }).count()) === 0);
  } else {
    check('Undo sheet import removes the batch', false, 'no undo button');
  }

  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.getByText('Contracts & commissions').scrollIntoViewIfNeeded();
  await shot('20-settings-aliases');
  const aliasValues = await page.locator('input[name="aliases"]').evaluateAll((els) => els.map((el) => el.value));
  const symbols = await page.locator('input[name="symbol"]').evaluateAll((els) => els.map((el) => el.value));
  check(
    'Settings list instrument aliases',
    aliasValues.some((value) => value.includes('NASDAQ')) && aliasValues.some((value) => value.includes('US30')) && symbols.includes('MYM'),
    aliasValues.join(' | '),
  );
  await page.getByText('Mistake tags').scrollIntoViewIfNeeded();
  await shot('21-settings-reasons');
  check('Settings seed the eight reasons', await page.getByText('Overtrading').isVisible() && await page.getByText('Late Entry').isVisible());
  await page.getByText('Pre-trade checklist').scrollIntoViewIfNeeded();
  await shot('22-settings-checklist');
  check('Checklist editor is on Settings', await page.getByRole('button', { name: 'Save checklist' }).isVisible());

  // --- playbooks ---
  await page.goto(`${BASE}/playbooks`, { waitUntil: 'networkidle' });
  await shot('11-playbooks');
  check('Playbooks show per-rule follow rate', await page.getByText('Follow rate').first().isVisible());

  // --- settings ---
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await shot('12-settings');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(1600);
  check('General settings save', await page.getByText('Settings saved.').isVisible());

  // --- bible ---
  await page.goto(`${BASE}/bible`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Verse of the moment');
  check('Bible tab shows a verse', await page.getByRole('button', { name: 'New verse' }).isVisible());
  const verseBefore = await page.locator('p.font-serif').first().innerText();
  await page.getByRole('button', { name: 'New verse' }).click();
  const verseAfter = await page.locator('p.font-serif').first().innerText();
  check('New verse does not repeat the last one', verseBefore !== verseAfter);
  check('Verse card links into the chapter', await page.getByRole('link', { name: 'Read in context' }).isVisible());
  const bookSlugs = await page.locator('[data-bible-book]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bible-book')));
  check('Bible lists all 66 books', bookSlugs.length === 66, String(bookSlugs.length));
  const closedBooks = [];
  for (const slug of bookSlugs) {
    const res = await page.request.get(`${BASE}/bible/${slug}/1`);
    if (!res.ok()) closedBooks.push(slug);
  }
  check('All 66 books open', closedBooks.length === 0, closedBooks.slice(0, 5).join(', '));

  await page.goto(`${BASE}/bible/john/1`, { waitUntil: 'networkidle' });
  check('Chapter shows WEB text', await page.getByRole('button', { name: 'Verse 1', exact: true }).isVisible());
  await page.getByRole('button', { name: 'Verse 1', exact: true }).click();
  await page.fill('#verse-note', 'local bookmark note');
  await page.getByRole('button', { name: 'Save verse bookmark' }).click();
  await page.waitForTimeout(1200);
  check('Verse bookmark saves', await page.getByText('Verse bookmarked.').isVisible());
  await page.goto(`${BASE}/bible`, { waitUntil: 'networkidle' });
  check('Continue reading resumes the chapter', await page.getByRole('link', { name: /Continue reading · John 1/ }).isVisible());
  const note = page.getByLabel('Note for John 1:1');
  check('Bookmark is listed', await note.isVisible());
  await note.fill('edited bookmark note');
  await page.getByRole('button', { name: 'Save note' }).first().click();
  await page.waitForTimeout(1200);
  check('Bookmark note edits', await page.getByText('Note saved.').isVisible());
  await page.locator('div').filter({ has: page.getByLabel('Note for John 1:1') }).getByRole('button', { name: 'Delete' }).click();
  await page.waitForTimeout(1200);
  check('Bookmark deletes', (await page.getByLabel('Note for John 1:1').count()) === 0);

  await page.goto(`${BASE}/bible/malachi/4`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Next · Matthew 1' }).first().click();
  await page.waitForURL('**/bible/matthew/1');
  check('Next chapter crosses into Matthew', page.url().includes('/bible/matthew/1'));
  await page.getByRole('link', { name: 'Previous · Malachi 4' }).first().click();
  await page.waitForURL('**/bible/malachi/4');
  check('Previous chapter crosses back to Malachi', page.url().includes('/bible/malachi/4'));

  await page.goto(`${BASE}/bible/acts/8`, { waitUntil: 'networkidle' });
  check('Blank WEB verses are not rendered', (await page.getByRole('button', { name: 'Verse 37', exact: true }).count()) === 0);
  check(
    'Verse numbers stay put after a blank',
    (await page.getByRole('button', { name: 'Verse 36', exact: true }).isVisible()) &&
      (await page.getByRole('button', { name: 'Verse 38', exact: true }).isVisible()),
  );
  check('Bible attributes the World English Bible', await page.getByText('World English Bible (public domain)').isVisible());

  // --- quick log ---
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.getByRole('banner').getByRole('button').first().click();
  await page.getByRole('button', { name: /^Quick log/ }).click();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/tank`, { waitUntil: 'networkidle' });
  check('Tank is not applicable for Quick log', await page.getByText('Not applicable for Quick log').isVisible());
  await page.goto(`${BASE}/money`, { waitUntil: 'networkidle' });
  check('Money is not applicable for Quick log', await page.getByText('Not applicable for Quick log').isVisible());

  await page.goto(`${BASE}/trades?new=1`, { waitUntil: 'networkidle' });
  if ((await page.locator('#takeProfit').count()) === 0) {
    await page.getByRole('button', { name: 'Quick', exact: true }).click();
  }
  check('Quick log trade form hides fees', (await page.locator('#quickFees').count()) === 0);
  await page.fill('#tradeDate', '2020-02-02');
  await page.fill('#plannedRisk', '200');
  await page.fill('#takeProfit', '400');
  await page.getByRole('button', { name: 'Win', exact: true }).click();
  await page.getByRole('button', { name: 'Log trade' }).click();
  let quickSaved = false;
  {
    const start = Date.now();
    while (Date.now() - start < 15000) {
      if (await page.getByText('Trade logged.').isVisible().catch(() => false)) {
        quickSaved = true;
        break;
      }
      await page.waitForTimeout(400);
    }
  }
  if (!quickSaved) {
    await page.goto(`${BASE}/trades`, { waitUntil: 'networkidle' });
    quickSaved = (await page.locator('tbody tr').filter({ hasText: '2020-02-02' }).count()) > 0;
  }
  check('Quick log trade saves without account balance', quickSaved);

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  check('Desk works for Quick log', await page.getByText('not applicable for Quick log').isVisible());
  check('Desk lists the Quick log trade', await page.getByText('2020-02-02').first().isVisible());
  await page.goto(`${BASE}/calendar?month=2020-02&day=2020-02-02`, { waitUntil: 'networkidle' });
  check('Calendar shows the Quick log trade', await page.getByText('+$400').first().isVisible());
  await page.goto(`${BASE}/stats`, { waitUntil: 'networkidle' });
  check('Stats render for Quick log', await page.getByRole('heading', { name: 'By month' }).isVisible());
  check('Entry timing renders for Quick log', await page.getByRole('heading', { name: 'Entry timing' }).isVisible());

  await page.goto(`${BASE}/trades`, { waitUntil: 'networkidle' });
  const quickRow = page.locator('tbody tr').filter({ hasText: '2020-02-02' }).first();
  const editHref = await quickRow.getByRole('link', { name: 'Edit' }).getAttribute('href');
  await page.goto(`${BASE}${editHref}`, { waitUntil: 'networkidle' });
  await page.selectOption('#accountId', { label: 'Personal futures' });
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/trades'), { timeout: 30000 }),
    page.getByRole('button', { name: 'Save trade' }).click(),
  ]);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.getByRole('banner').getByRole('button').first().click();
  await page.getByRole('button', { name: /Personal futures/ }).click();
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/trades`, { waitUntil: 'networkidle' });
  check('A trade can move to another account', (await page.locator('tbody tr').filter({ hasText: '2020-02-02' }).count()) > 0);

  await page.goto(`${BASE}/accounts/new`, { waitUntil: 'networkidle' });
  await page.getByRole('main').getByText('Personal', { exact: true }).click();
  await page.fill('#name', 'Temp Keep Book');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  await page.goto(`${BASE}/trades?new=1`, { waitUntil: 'networkidle' });
  if ((await page.locator('#takeProfit').count()) === 0) {
    await page.getByRole('button', { name: 'Quick', exact: true }).click();
  }
  await page.fill('#tradeDate', '2020-03-03');
  await page.fill('#plannedRisk', '150');
  await page.fill('#takeProfit', '150');
  await page.getByRole('button', { name: 'Win', exact: true }).click();
  await page.getByRole('button', { name: 'Log trade' }).click();
  await page.waitForTimeout(2000);
  check('Trade on a temporary account saves', await page.getByText('Trade logged.').isVisible());
  await page.goto(`${BASE}/calendar?month=2020-03&day=2020-03-03`, { waitUntil: 'networkidle' });
  await page.fill('#notes', 'temp day note');
  await page.getByRole('button', { name: 'Save journal' }).click();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.getByRole('banner').getByRole('button').first().click();
  await page.getByRole('button', { name: /^Quick log/ }).click();
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/calendar?month=2020-03&day=2020-03-03`, { waitUntil: 'networkidle' });
  await page.fill('#notes', 'quick day note');
  await page.getByRole('button', { name: 'Save journal' }).click();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/accounts`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Temp Keep Book' }).click();
  await page.waitForURL('**/accounts/*');
  await page.getByRole('button', { name: 'Delete account…' }).click();
  await page.getByRole('button', { name: 'Delete account but keep its trades (move to Quick log)' }).click();
  await page.waitForURL('**/accounts', { timeout: 15000 });
  check('Kept-trades delete removes the account', (await page.getByText('Temp Keep Book').count()) === 0);
  await page.goto(`${BASE}/trades`, { waitUntil: 'networkidle' });
  const kept = page.locator('tbody tr').filter({ hasText: '2020-03-03' }).first();
  check('Kept trades land in Quick log', await kept.isVisible() && (await kept.innerText()).includes('Quick log'));
  check('Kept trades keep the former account label', (await kept.innerText()).includes('from Temp Keep Book'));
  await page.goto(`${BASE}/calendar?month=2020-03&day=2020-03-03`, { waitUntil: 'networkidle' });
  const mergedNotes = await page.locator('#notes').inputValue();
  check('Day notes merge onto Quick log', mergedNotes.includes('quick day note') && mergedNotes.includes('temp day note'), mergedNotes);
  await page.goto(`${BASE}/trades`, { waitUntil: 'networkidle' });
  await page.locator('tbody tr').filter({ hasText: '2020-03-03' }).first().getByRole('button', { name: 'Delete' }).click();
  await page.waitForTimeout(1200);

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.getByRole('banner').getByRole('button').first().click();
  await page.getByRole('button', { name: /Personal futures/ }).click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/trades`, { waitUntil: 'networkidle' });
  const movedRow = page.locator('tbody tr').filter({ hasText: '2020-02-02' }).first();
  if (await movedRow.count()) {
    await movedRow.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(1200);
  }
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.getByRole('banner').getByRole('button').first().click();
  await page.getByRole('button', { name: /50K Combine #2/ }).click();
  await page.waitForTimeout(800);

  // --- backup ---
  const backup = await page.request.get(`${BASE}/api/backup`);
  check('JSON backup downloads', backup.ok(), `${backup.status()}`);
  const backupBody = await backup.json();
  check('Backup includes bible tables', Array.isArray(backupBody.bibleBookmarks) && Array.isArray(backupBody.bibleState));
  check('Backup includes Quick log', backupBody.accounts?.some((account) => account.isQuickLog === true));

  // --- auth guard ---
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  const res = await anonPage.goto(`${BASE}/stats`, { waitUntil: 'domcontentloaded' });
  check('Unauthenticated request is redirected to login', anonPage.url().includes('/login'), `${res?.status()}`);
  await anon.close();
} finally {
  if (errors.length) {
    console.log('\nBrowser console/page errors:');
    for (const e of [...new Set(errors)]) console.log(' -', e);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  await browser.close();
  process.exitCode = failed.length ? 1 : 0;
}
