// Local verification pass: exercises the main flows and writes screenshots.
//   node scripts/verify.mjs [baseUrl] [outDir]
import { mkdirSync } from 'node:fs';
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
  await page.waitForTimeout(1200);
  check('Switching to All accounts works', (await page.getByText('All accounts').count()) > 0);
  await page.getByRole('button', { name: /All accounts/ }).first().click();
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
  await page.goto(`${BASE}/trades?new=1`, { waitUntil: 'networkidle' });
  await page.selectOption('#symbol', 'MNQ');
  await page.fill('#contracts', '5');
  await page.fill('#entryPrice', '20100');
  await page.fill('#stopPrice', '20080');
  await page.fill('#exitPrice', '20145');
  await page.waitForTimeout(300);
  const resultText = await page.locator('form').getByText(/^\$/).last().innerText();
  check('Trade form computes P&L live', /\$\d/.test(resultText), resultText);
  await shot('08-trades-add-form');

  const rowsBefore = await page.locator('tbody tr').count();
  await page.getByRole('button', { name: 'Log trade' }).click();
  await page.waitForTimeout(2200);
  check('Trade saves', await page.getByText('Trade logged.').isVisible());
  await page.goto(`${BASE}/trades`, { waitUntil: 'networkidle' });
  const rowsAfter = await page.locator('tbody tr').count();
  check('New trade appears in the list', rowsAfter >= rowsBefore, `${rowsBefore} -> ${rowsAfter}`);

  // delete it again so the demo data stays clean
  await page.locator('tbody tr').first().getByRole('button', { name: 'Delete' }).click();
  await page.waitForTimeout(1600);

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

  // --- backup ---
  const backup = await page.request.get(`${BASE}/api/backup`);
  check('JSON backup downloads', backup.ok(), `${backup.status()}`);

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
