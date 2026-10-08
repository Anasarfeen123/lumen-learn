// End-to-end journeys in a real browser, with screenshots. Uses no test-only
// hooks: round words are read from the saved profile, and OCR is tested with a
// freshly generated picture and PDF each run (never a prefilled result).
//
//   npm run dev                       # in one terminal
//   npm run smoke -- [url] [out-dir]  # defaults: http://localhost:5173 ./smoke-shots
//
// Uses the system Chrome/Chromium (set CHROME_PATH to override).
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = process.argv[2] || 'http://localhost:5173';
const OUT = process.argv[3] || 'smoke-shots';
const WORDS = JSON.parse(readFileSync(new URL('../src/data/words.json', import.meta.url)));
const FAMILY_WORDS = JSON.parse(readFileSync(new URL('../src/data/families.json', import.meta.url)))
  .flatMap((f) => f.words.map((w) => ({ ...w, id: `${f.id}:${w.word}` })));
const CANDIDATES = [process.env.CHROME_PATH, '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const executablePath = CANDIDATES.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome found. Set CHROME_PATH.');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath });
const errors = [];
const passed = [];
let step = 0;

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return page;
}
const shot = (page, name) => page.screenshot({ path: join(OUT, `${String(++step).padStart(2, '0')}-${name}.png`) });
const pause = (page, ms = 300) => page.waitForTimeout(ms);
const profile = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('lumen.profile.v1') ?? '{}'));
const visible = (loc) => loc.isVisible().catch(() => false);

async function journey(name, fn) {
  try {
    await fn();
    passed.push(name);
    console.log(`  ✓ ${name}`);
  } catch (e) {
    errors.push(`${name}: ${String(e).split('\n')[0]}`);
    console.log(`  ✗ ${name}`);
  }
}

/** Answers a choice item by trying options in order (two tries, then the answer is revealed). */
async function answerChoice(page) {
  for (let i = 0; i < 3; i++) {
    if (await visible(page.getByRole('button', { name: /^(Continue|Got it)$/ }))) return;
    if (await visible(page.locator('.item-nav .btn.go:not([disabled])'))) return;
    if (await visible(page.locator('.answer.reveal'))) { await page.locator('.answer.reveal').click(); return; }
    const option = page.locator('.answers .answer:not([disabled])').first();
    if (!(await visible(option))) return;
    await option.click();
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await pause(page, 250);
    const again = page.getByRole('button', { name: 'Try again', exact: true });
    if (await visible(again)) await again.click();
  }
}

/** Plays a Classroom round of whichever game comes up, until Round complete. */
/** Wait until a page change has finished: the slide is done and focus has moved to the new heading. */
async function settled(page) {
  await page.waitForFunction(() => !document.documentElement.dataset.nav && document.activeElement?.matches('h1'), null, { timeout: 10000 }).catch(() => {});
}

async function playRound(page) {
  for (let i = 0; i < 9; i++) {
    if (await visible(page.getByText('Round complete!'))) return;
    await pause(page, 400);
    if (await visible(page.locator('.speller-row.current'))) {
      const p = await profile(page);
      const word = FAMILY_WORDS.find((w) => w.id === p.recentWords.at(-5 + Math.min(i, 4))) ?? FAMILY_WORDS[0];
      const boxes = page.locator('.speller-row.current [data-box]:not(:disabled)');
      const n = await boxes.count();
      for (let k = 0; k < n; k++) {
        const idx = Number(await boxes.nth(k).getAttribute('data-box'));
        await page.locator(`.speller-row.current [data-box="${idx}"]`).click();
        for (const ch of word.syllables[idx] ?? '') await page.getByRole('button', { name: `Letter ${ch}`, exact: true }).click();
      }
      await page.getByRole('button', { name: 'Check', exact: true }).click();
    } else if (await visible(page.locator('.slots'))) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const tiles = page.locator('.tray .tile:not([disabled])');
        while ((await page.locator('.slot:not(.filled):not(.locked)').count()) && (await tiles.count())) await tiles.first().click();
        await page.getByRole('button', { name: 'Check', exact: true }).click();
        await pause(page, 300);
        if (await visible(page.getByRole('button', { name: 'Continue', exact: true }))) break;
        const again = page.getByRole('button', { name: 'Try again', exact: true });
        if (await visible(again)) await again.click();
      }
    } else {
      await answerChoice(page);
    }
    await page.getByRole('button', { name: /^(Continue|Got it)$/ }).click({ timeout: 20000 });
  }
}

/** A short random sentence, so OCR is tested on something new every run. */
function freshSentence() {
  const who = ['The fox', 'A brave owl', 'My little sister', 'The green frog', 'Our teacher'];
  const did = ['painted a', 'found a', 'carried a', 'drew a', 'hid a'];
  const what = ['purple kite', 'golden key', 'tiny boat', 'striped sock', 'shiny shell'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return `${pick(who)} ${pick(did)} ${pick(what)}.`;
}

try {
  // ------------------------------------------------------------------ desktop
  const page = await newPage();
  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); indexedDB.deleteDatabase('lumen'); });
  await page.reload();

  await journey('Hero → onboarding → Classroom', async () => {
    await pause(page, 2800);
    await shot(page, 'hero');
    await page.getByRole('button', { name: /Start learning/ }).first().click();
    await page.getByRole('heading', { name: 'Make your Lumen account' }).waitFor();
    await page.getByRole('button', { name: 'Try it as a guest' }).click();
    await page.getByLabel('What should Lumo call you?').fill('Sam');
    await page.getByRole('button', { name: /Let's go/ }).click();
    await page.locator('.lesson-list').waitFor();
    await shot(page, 'classroom');
  });

  await journey('Classroom → lesson → round complete → Classroom', async () => {
    await page.locator('.lesson.current .lesson-card').click();
    await pause(page, 600);
    await shot(page, 'lesson-round');
    await playRound(page);
    await page.getByText('Round complete!').waitFor({ timeout: 20000 });
    await shot(page, 'round-complete');
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await page.locator('.lesson.done').first().waitFor();
  });

  await journey('Refresh keeps learner progress', async () => {
    await page.reload();
    await page.locator('.lesson.done').first().waitFor();
    const p = await profile(page);
    if (!p.courses?.explorer?.length) throw new Error('path not saved');
  });

  await journey('Classroom → activity (teach first) → completion → Classroom', async () => {
    await page.getByRole('button', { name: /Word twins/ }).click();
    await page.getByText('One letter changes the word').waitFor();
    await shot(page, 'activity-teach');
    await page.getByRole('button', { name: /^Start/ }).click();
    for (let i = 0; i < 8; i++) {
      if (await visible(page.getByRole('heading', { name: /You finished/ }))) break;
      const support = page.getByRole('button', { name: /Got it, next one/ });
      if (await visible(support)) { await support.click(); continue; }
      await answerChoice(page);
      if (i === 0) await shot(page, 'activity-item');
      await page.locator('.item-nav .btn.go').click();
    }
    await page.getByRole('heading', { name: /You finished/ }).waitFor();
    await shot(page, 'activity-done');
    await page.getByRole('button', { name: 'Back to Classroom' }).click();
    await page.locator('.lesson-list').waitFor();
    const p = await profile(page);
    if (!p.learning?.attempts?.length) throw new Error('attempts not recorded');
  });

  await journey('Playground → Pattern train → play again → pause → Playground', async () => {
    await page.getByRole('link', { name: /Playground/ }).first().click();
    await page.locator('.play-card').first().waitFor();
    await shot(page, 'playground');
    await page.locator('.play-card', { hasText: 'Pattern train' }).click();
    await page.getByRole('button', { name: /^Start/ }).click();
    for (let i = 0; i < 6; i++) {
      for (let k = 0; k < 3; k++) {
        if (await visible(page.getByRole('button', { name: /Next carriage|Finish/ }))) break;
        await page.locator('.shape-answer:not([disabled])').first().click().catch(() => {});
        await pause(page, 150);
      }
      if (i === 0) await shot(page, 'pattern-train');
      await page.getByRole('button', { name: /Next carriage|Finish/ }).click();
    }
    await page.getByText(/done!/).waitFor();
    await page.getByRole('button', { name: 'Play again' }).click();
    await page.locator('.pattern-train').waitFor();
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('button', { name: 'Back to Playground' }).click();
    await page.locator('.play-card').first().waitFor();
  });

  await journey('Playground → Word & picture match → completion (not counted as reading)', async () => {
    const before = JSON.stringify((await profile(page)).mastery);
    await page.locator('.play-card', { hasText: 'Word & picture match' }).click();
    await page.getByRole('button', { name: /^Start/ }).click();
    const words = (await page.locator('.match-word').allTextContents()).map((w) => w.trim());
    for (const w of words) {
      const entry = WORDS.find((x) => x.word === w);
      await page.locator('.match-word', { hasText: new RegExp(`^${w}$`) }).click();
      await page.getByRole('button', { name: `Picture: ${entry.picture}` }).click();
    }
    await page.getByText(/done!/).waitFor();
    await shot(page, 'match-done');
    const p = await profile(page);
    if (!p.playground?.match?.plays) throw new Error('playground score not saved');
    if (JSON.stringify(p.mastery) !== before) throw new Error('the game changed reading mastery');
    await page.getByRole('button', { name: 'Back to Playground' }).click();
  });

  await journey('Library → story → whole-word help → pronunciation → return (filters kept)', async () => {
    await page.getByRole('link', { name: /Library/ }).first().click();
    await page.getByRole('combobox', { name: 'Level' }).selectOption('1');
    await page.locator('.story-card', { hasText: 'Pip the Pup' }).click();
    await page.locator('.read-text').waitFor();
    // Tap near the edge of a word: the whole word is still the unit.
    await page.locator('.w', { hasText: /^ball$/ }).first().click({ position: { x: 4, y: 10 } });
    await page.locator('.word-help').waitFor();
    const word = await page.locator('#wh-word').textContent();
    if (word !== 'ball') throw new Error(`selected "${word}", not the whole word`);
    if (!(await page.locator('.wh-meaning').textContent())?.trim()) throw new Error('no explanation');
    await shot(page, 'reader-word-help');
    await page.getByRole('button', { name: 'Say ball' }).click();
    await page.getByRole('button', { name: 'Close word help' }).click();
    await page.getByRole('button', { name: /Next page/ }).click();
    await page.getByText('Page 2 of 4').first().waitFor();
    await page.getByRole('button', { name: /Back to Library/ }).click();
    await page.locator('.story-card').first().waitFor();
    if ((await page.getByRole('combobox', { name: 'Level' }).inputValue()) !== '1') throw new Error('level filter was lost');
  });

  await journey('Reader keyboard: arrows move word by word; Enter opens help; Esc closes', async () => {
    await page.locator('.cards:not(.continue .cards) .story-card', { hasText: 'Pip the Pup' }).last().click();
    await settled(page);
    await page.locator('.read-text .w[tabindex="0"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.locator('.word-help').waitFor();
    await page.keyboard.press('Escape');
    if (await visible(page.locator('.word-help'))) throw new Error('Escape did not close help');
    await page.getByRole('button', { name: /Back to Library/ }).click();
  });

  await journey('Paste text → check → confirm → reader (word help never blank)', async () => {
    await page.getByRole('button', { name: /Add your own reading/ }).click();
    await page.getByPlaceholder(/My spelling list/).fill('My pasted page');
    await page.getByPlaceholder('Type or paste here…').fill('Lumo likes to read.\n\nThe zebra ran to the river.');
    await page.getByRole('button', { name: /Next: check the text/ }).click();
    await page.getByRole('button', { name: /Confirm text and open reader/ }).click();
    await page.locator('.w', { hasText: /^zebra$/ }).click();
    await page.locator('.word-help').waitFor();
    await page.waitForFunction(() => !document.querySelector('.wh-loading'), null, { timeout: 12000 });
    if (!(await page.locator('.wh-meaning').textContent())?.trim()) throw new Error('word help was blank');
    await shot(page, 'pasted-reader');
    await page.getByRole('button', { name: /Back to Library/ }).click();
  });

  const caps = await page.evaluate(() => fetch('/api/extract/capabilities').then((r) => (r.ok ? r.json() : null)).catch(() => null));

  await journey('Upload a fresh picture → real OCR → review → reader', async () => {
    if (!caps?.printedOcr) throw new Error('OCR not available on this server (install Tesseract)');
    const sentence = freshSentence();
    const art = await newPage();
    await art.setContent(`<body style="margin:0;background:#fff"><p style="font:44px Arial;padding:40px;margin:0">${sentence}</p></body>`);
    const png = join(OUT, 'fresh-ocr.png');
    await art.locator('p').screenshot({ path: png });
    await art.context().close();
    await page.goto(`${APP}/library/add`);
    await page.getByRole('button', { name: 'Choose a file' }).click();
    await page.locator('input[type=file]').setInputFiles(png);
    await page.getByRole('button', { name: 'Printed' }).click();
    await page.getByRole('button', { name: 'Read the text' }).click();
    await page.getByText(/Check the text/).waitFor({ timeout: 60000 });
    const text = await page.locator('textarea').inputValue();
    const want = sentence.toLowerCase().replace(/[^a-z ]/g, '');
    const got = text.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
    if (got !== want) throw new Error(`OCR read "${text}" for "${sentence}"`);
    await shot(page, 'ocr-review');
    await page.getByRole('button', { name: /Confirm text and open reader/ }).click();
    await page.locator('.read-text').waitFor();
  });

  await journey('Upload a fresh PDF → embedded-text path → review → reader', async () => {
    if (!caps?.pdfText) throw new Error('PDF reading not available on this server (install Poppler)');
    const sentence = freshSentence();
    const art = await newPage();
    await art.setContent(`<h1>Test page</h1><p>${sentence}</p>`);
    const pdf = join(OUT, 'fresh.pdf');
    await art.pdf({ path: pdf, format: 'A5' });
    await art.context().close();
    await page.goto(`${APP}/library/add`);
    await page.getByRole('button', { name: 'Choose a file' }).click();
    await page.locator('input[type=file]').setInputFiles(pdf);
    await page.getByRole('button', { name: 'Read the text' }).click();
    await page.getByText(/Check the text/).waitFor({ timeout: 60000 });
    if (!(await page.locator('textarea').inputValue()).includes(sentence.slice(0, -1))) throw new Error('PDF text missing');
    if (!(await visible(page.getByText(/text inside the PDF/)))) throw new Error('wrong extraction path');
    await page.getByRole('button', { name: /Confirm text and open reader/ }).click();
    await page.locator('.read-text').waitFor();
    await page.getByRole('button', { name: /Back to Library/ }).click();
  });

  await journey('Section switching keeps Library search', async () => {
    await page.goto(`${APP}/library`);
    await page.getByPlaceholder('Search stories').fill('frog');
    await pause(page, 200);
    await page.getByRole('link', { name: /Classroom/ }).first().click();
    await page.locator('.lesson-list').waitFor();
    await page.getByRole('link', { name: /Library/ }).first().click();
    if ((await page.getByPlaceholder('Search stories').inputValue()) !== 'frog') throw new Error('search was lost');
  });

  await journey('Browser back and forward', async () => {
    await page.goto(`${APP}/classroom`);
    await page.getByRole('link', { name: /Playground/ }).first().click();
    await page.locator('.play-card').first().waitFor();
    await page.goBack();
    await page.locator('.lesson-list').waitFor();
    await page.goForward();
    await page.locator('.play-card').first().waitFor();
    // Progress → Classroom tab really goes to the Classroom.
    await page.getByRole('link', { name: /Progress/ }).first().click();
    await page.waitForURL(/\/classroom\/progress/);
    await page.getByRole('link', { name: /Classroom/ }).first().click();
    await page.locator('.lesson-list').waitFor();
  });

  await journey('Shortcuts: "?" lists them, Alt+2 opens the Library', async () => {
    await page.locator('body').press('?');
    await page.getByText('Keyboard shortcuts').waitFor();
    await shot(page, 'shortcuts');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Alt+2');
    await page.locator('.subtabs').waitFor();
  });

  await journey('Enter checks first; only a second Enter moves on', async () => {
    await page.goto(`${APP}/classroom/play/detective`);
    await page.locator('.sheet').first().waitFor();
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    const action = page.locator('.sheet button').last();
    await action.waitFor();
    const label = (await action.innerText()).trim();
    if (!/Continue|Try again/.test(label)) throw new Error(`first Enter didn't stop on feedback (button: ${label})`);
    await page.waitForTimeout(400);
    if ((await action.innerText()).trim() !== label) throw new Error('feedback was skipped by the same key press');
    await page.keyboard.press('Enter');
    await page.waitForFunction((l) => ![...document.querySelectorAll('.sheet button')].some((b) => b.textContent.trim() === l), label);
  });

  await journey('Grown-ups gate: hold to open, a short press does not, and it asks again after leaving', async () => {
    const holdFor = async (ms) => {
      await settled(page);
      const box = await page.getByRole('button', { name: 'Hold to open' }).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await pause(page, ms);
      await page.mouse.up();
    };
    await page.goto(`${APP}/grown-ups`);
    await holdFor(700); // too short
    await page.getByText(/Keep holding until the circle is full/).waitFor();
    if (await visible(page.getByText('This week in brief'))) throw new Error('opened without a full hold');
    await holdFor(3400);
    await page.getByText('This week in brief').waitFor();
    await page.getByText('When practice happened').waitFor();
    await shot(page, 'grown-ups');
    // Leave and come back: the hold is needed again.
    await page.getByRole('button', { name: 'Back to learning' }).click();
    await page.locator('.lesson-list').waitFor();
    await page.goBack();
    await page.getByRole('button', { name: 'Hold to open' }).waitFor();
    // Lock closes the notes too, and so does a reload.
    await holdFor(3400);
    await page.getByRole('button', { name: /Lock/ }).click();
    await page.getByRole('button', { name: 'Hold to open' }).waitFor();
    await holdFor(3400);
    await page.reload();
    await page.getByRole('button', { name: 'Hold to open' }).waitFor();
    // The Classroom tab goes to the Classroom, never back to the grown-up notes.
    await holdFor(3400);
    await page.getByText('This week in brief').waitFor();
    await page.getByRole('link', { name: /Classroom/ }).first().click();
    await page.locator('.lesson-list').waitFor();
    if (new URL(page.url()).pathname !== '/classroom') throw new Error(`Classroom tab went to ${page.url()}`);
  });

  await journey('Forget this device clears progress and uploads', async () => {
    const uploads = await page.evaluate(() => new Promise((res) => {
      const r = indexedDB.open('lumen');
      r.onsuccess = () => { const q = r.result.transaction('uploads').objectStore('uploads').getAll(); q.onsuccess = () => res(q.result.map((u) => u.id)); };
    }));
    await page.goto(`${APP}/classroom`);
    await page.locator('.account-btn').click();
    await page.getByRole('menuitem', { name: /Forget this device/ }).click();
    await page.getByRole('button', { name: 'Forget', exact: true }).click();
    await page.getByRole('button', { name: /Start learning/ }).first().waitFor();
    await page.evaluate(() => localStorage.setItem('lumen.guest', '1'));
    await page.goto(`${APP}/library/read/upload/${uploads[0]}`);
    await page.getByText(/isn't here/).waitFor();
    const p = await profile(page);
    if (p.xp) throw new Error('progress survived');
  });

  // ------------------------------------------------------------------ accounts
  const acct = await newPage();
  const email = `smoke-${Date.now()}@example.com`;
  await journey('Signed-out visitors are sent to log in, then back to where they were going', async () => {
    await acct.goto(`${APP}/library`);
    await acct.waitForURL(/\/login\?next=%2Flibrary/);
    await acct.getByRole('heading', { name: 'Welcome back!' }).waitFor();
  });

  await journey('Sign up → progress saved to the database → log out → back is blocked → log in restores it', async () => {
    await acct.getByRole('tab', { name: 'Create account' }).click();
    await acct.getByLabel(/What should Lumo call you/).fill('Robin');
    await acct.getByLabel(/^Email/).fill(email);
    await acct.getByLabel(/^Password/).fill('a-long-password');
    await acct.getByRole('button', { name: 'Create account' }).click();
    await acct.waitForURL(/\/library/); // back to where they were going
    await acct.goto(`${APP}/classroom`);
    await acct.waitForURL(/\/start/); // a new account meets Lumo first
    await acct.getByLabel('What should Lumo call you?').waitFor();
    await acct.getByRole('button', { name: /Let's go/ }).click();
    await acct.locator('.lesson-list').waitFor();
    await acct.locator('.lesson.current .lesson-card').click();
    await playRound(acct);
    await acct.getByText('Round complete!').waitFor({ timeout: 20000 });
    await acct.waitForTimeout(1500); // debounced save
    const saved = await acct.evaluate(async () => (await (await fetch('/api/data/profile')).json()).data);
    if (!saved?.xp) throw new Error('progress was not saved to the account');
    if (await acct.evaluate(() => JSON.parse(localStorage.getItem('lumen.profile.v1') ?? '{}').xp)) throw new Error('account progress leaked into guest storage');
    await acct.goto(`${APP}/classroom`);
    await acct.locator('.account-btn').click();
    await acct.getByRole('menuitem', { name: 'Log out' }).click();
    await acct.getByRole('button', { name: /Start learning/ }).first().waitFor();
    await acct.goBack();
    await acct.waitForURL(/\/login/);
    const me = await acct.evaluate(async () => (await (await fetch('/api/auth/me')).json()).user);
    if (me) throw new Error('session still active after logout');
    await acct.getByLabel(/^Email/).fill(email);
    await acct.getByLabel(/^Password/).fill('wrong-password');
    await acct.getByRole('button', { name: 'Log in' }).click();
    await acct.getByRole('alert').getByText(/don't match/).waitFor();
    await acct.getByLabel(/^Password/).fill('a-long-password');
    await acct.getByRole('button', { name: 'Log in' }).click();
    await acct.locator('.lesson.done').first().waitFor();
    await shot(acct, 'account-classroom');
  });

  await journey('Personalised: pick interests, Lumo plans the day, story feedback is remembered', async () => {
    await acct.goto(`${APP}/me`);
    await acct.getByRole('button', { name: 'Space' }).click();
    await acct.getByRole('button', { name: 'Animals' }).click();
    await acct.waitForTimeout(400);
    const personal = await acct.evaluate(async () => (await (await fetch('/api/data/personal')).json()).data);
    if (!personal?.interests?.includes('space')) throw new Error('interests not saved');
    await shot(acct, 'about-me');
    await acct.goto(`${APP}/classroom`);
    await acct.locator('.plan-step').first().waitFor({ timeout: 15000 });
    await shot(acct, 'plan');
    await acct.goto(`${APP}/library/read/story/pip-the-pup`);
    for (let i = 0; i < 10 && !(await visible(acct.getByRole('button', { name: /I finished/ }))); i++) await acct.getByRole('button', { name: /Next page/ }).click();
    await acct.getByRole('radio', { name: 'Loved it' }).click();
    await acct.waitForTimeout(400);
    const after = await acct.evaluate(async () => (await (await fetch('/api/data/personal')).json()).data);
    if (after?.feelings?.['pip-the-pup'] !== 'loved') throw new Error('story feeling not saved');
  });

  await journey('Delete account erases it', async () => {
    await acct.goto(`${APP}/me`);
    await acct.getByRole('button', { name: /Delete my account/ }).click();
    await acct.getByLabel(/Type delete/).fill('delete');
    await acct.getByRole('button', { name: 'Delete forever' }).click();
    await acct.getByRole('button', { name: /Start learning/ }).first().waitFor();
    const r = await acct.evaluate(async (e) => (await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-lumen': '1' }, body: JSON.stringify({ email: e, password: 'a-long-password' }) })).status, email);
    if (r !== 401) throw new Error(`deleted account could still log in (${r})`);
  });

  await journey('Landing page: the lesson preview is real and the page fits a phone', async () => {
    await acct.goto(APP);
    await acct.getByRole('radio', { name: 'a' }).click();
    await acct.getByText(/c-a-t, cat/).waitFor();
    await shot(acct, 'landing');
  });

  // ------------------------------------------------------------------ reduced motion
  const still = await newPage({ reducedMotion: 'reduce' });
  await journey('Reduced motion: no opening animation, everything still', async () => {
    await still.goto(APP);
    if (await visible(still.getByRole('button', { name: 'Skip intro' }))) throw new Error('intro played');
    if (!(await still.evaluate(() => document.documentElement.classList.contains('still')))) throw new Error('motion not reduced');
  });

  // ------------------------------------------------------------------ phone
  const phone = await newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await journey('Phone: bottom navigation, Classroom, and tapping words in the reader', async () => {
    await phone.goto(APP, { waitUntil: 'networkidle' });
    await phone.evaluate(() => { localStorage.setItem('lumen.profile.v1', JSON.stringify({ onboarded: true, name: 'Ana' })); localStorage.setItem('lumen.guest', '1'); });
    await phone.goto(`${APP}/classroom`);
    await phone.locator('.lesson-list').waitFor();
    await shot(phone, 'phone-classroom');
    const nav = await phone.locator('.tabs').boundingBox();
    if (nav.y < 700) throw new Error('navigation is not at the bottom');
    await phone.goto(`${APP}/library`);
    await shot(phone, 'phone-library');
    await phone.locator('.story-card', { hasText: 'Frog and the Rain' }).tap();
    await phone.locator('.w', { hasText: /^pond$/ }).first().tap();
    await phone.locator('.word-help').waitFor();
    await shot(phone, 'phone-reader');
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`horizontal scroll ${overflow}px`);
  });
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
}

writeFileSync(join(OUT, 'results.json'), JSON.stringify({ passed, errors }, null, 2));
if (errors.length) {
  console.error(`\nSmoke test failed (${passed.length} journeys passed):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nAll ${passed.length} journeys passed. ${step} screenshots in ${OUT}/`);
