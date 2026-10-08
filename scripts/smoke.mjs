// End-to-end smoke test: plays through every screen in a real browser and
// saves screenshots. It finds each round's words from the saved profile
// (recentWords), so the app needs no test-only hooks.
//
//   npm run dev                       # in one terminal
//   npm run smoke -- [url] [out-dir]  # defaults: http://localhost:5173 ./smoke-shots
//
// Uses the system Chrome/Chromium (set CHROME_PATH to override).
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP_URL = process.argv[2] || 'http://localhost:5173';
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
let step = 0;

async function newPage(viewport) {
  const page = await browser.newPage({ viewport });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return page;
}
const shot = async (page, name) => page.screenshot({ path: join(OUT, `${String(++step).padStart(2, '0')}-${name}.png`) });
const profile = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('lumen.profile.v1')));
const pause = (page, ms = 250) => page.waitForTimeout(ms);
const press = (page, label) => page.getByRole('button', { name: label, exact: true }).click();

async function currentWord(page, index, roundSize = 5) {
  const p = await profile(page);
  const id = p.recentWords[p.recentWords.length - roundSize + index];
  return WORDS.find((w) => w.id === id) ?? FAMILY_WORDS.find((w) => w.id === id);
}

/** Build the current Word Builder word; optionally make one mistake first. */
async function buildWord(page, word, { mistake = false } = {}) {
  const tiles = await page.locator('.tray .tile').allTextContents();
  const units = tiles.some((t) => t.length > 1) ? word.syllables : word.word.split('');
  const order = mistake ? [...units].reverse() : units;
  for (const u of order) {
    await page.locator('.tray .tile', { hasText: new RegExp(`^${u}$`) }).first().click();
  }
  await press(page, 'Check');
  await pause(page);
}

async function playBuilderRound(page, { mistakeOn = -1, shots = false } = {}) {
  for (let i = 0; i < 5; i++) {
    await page.locator('.slots').waitFor();
    if (i === 0) await pause(page, 300);
    const word = await currentWord(page, i);
    if (i === 0 && shots) await shot(page, 'builder-item');
    if (i === mistakeOn) {
      await buildWord(page, word, { mistake: true });
      if (shots) await shot(page, 'builder-partial-credit');
      await press(page, 'Try again');
      const rest = await page.locator('.slot:not(.locked)').count();
      // Fill the remaining slots in order.
      const units = (await page.locator('.tray .tile').allTextContents()).some((t) => t.length > 1) ? word.syllables : word.word.split('');
      const slotTexts = await page.locator('.slot').allTextContents();
      for (let s = 0; s < units.length; s++) {
        if (slotTexts[s]) continue;
        await page.locator('.tray .tile', { hasText: new RegExp(`^${units[s]}$`) }).first().click();
      }
      if (rest) await press(page, 'Check');
    } else {
      await buildWord(page, word);
    }
    if (i === 0 && shots) await shot(page, 'builder-correct');
    await press(page, 'Continue');
  }
}

/** Syllable Speller: drag the first letter of each round in like the video, type the rest. */
async function playSpellerRound(page, { shots = false } = {}) {
  for (let i = 0; i < 5; i++) {
    await page.locator('.speller-row.current').waitFor();
    // The round's words are saved just after it renders; wait for them.
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('lumen.profile.v1')).recentWords.at(-1).includes(':'));
    const word = await currentWord(page, i);
    if (i === 0 && shots) await shot(page, 'speller-item');
    const boxes = page.locator('.speller-row.current [data-box]:not(:disabled)');
    const n = await boxes.count();
    const openIdx = [];
    for (let b = 0; b < n; b++) openIdx.push(Number(await boxes.nth(b).getAttribute('data-box')));
    for (const [k, idx] of openIdx.entries()) {
      const syllable = word.syllables[idx];
      const box = page.locator(`.speller-row.current [data-box="${idx}"]`);
      let letters = syllable;
      if (k === 0) {
        // Drag-and-drop with the pointer, as on a touchscreen.
        const from = await page.getByRole('button', { name: `Letter ${syllable[0]}`, exact: true }).boundingBox();
        const to = await box.boundingBox();
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(from.x + 40, from.y + 60, { steps: 4 });
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
        if (i === 0 && shots) await shot(page, 'speller-drag');
        await page.mouse.up();
        letters = syllable.slice(1);
      } else {
        await box.click();
      }
      for (const ch of letters) await page.getByRole('button', { name: `Letter ${ch}`, exact: true }).click();
    }
    await press(page, 'Check');
    await pause(page);
    if (i === 0 && shots) await shot(page, 'speller-correct');
    await press(page, 'Continue');
  }
}

async function playChoiceRound(page, { revealOn = -1, shotName = '' } = {}) {
  for (let i = 0; i < 5; i++) {
    await page.locator('.answers').waitFor();
    if (i === 0) await pause(page, 300);
    const word = await currentWord(page, i);
    if (i === 0 && shotName) await shot(page, `${shotName}-item`);
    if (i === revealOn) {
      for (let miss = 0; miss < 2; miss++) {
        await page.locator('.answer:not(.removed):not(:disabled)', { hasNotText: new RegExp(`^\\d?${word.word}$`) }).first().click();
        await press(page, 'Check');
        await pause(page);
        if (miss === 0) {
          if (shotName) await shot(page, `${shotName}-almost`);
          await press(page, 'Try again');
        }
      }
      if (shotName) await shot(page, `${shotName}-reveal`);
      await page.locator('.answer.reveal').click();
    } else {
      await page.locator('.answer', { hasText: new RegExp(`^\\d${word.word}$`) }).click();
      await press(page, 'Check');
    }
    await press(page, 'Continue');
  }
}

try {
  const page = await newPage({ width: 1280, height: 860 });
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await pause(page, 400);
  await shot(page, 'welcome');

  await page.getByLabel('What should Lumo call you?').fill('Sam');
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.locator('.unit-banner').waitFor();
  await shot(page, 'hub-fresh');

  // A fresh learner plays one Word Detective round, missing twice on item 1.
  await page.locator('.game-card', { hasText: 'Word Detective' }).click();
  await playChoiceRound(page, { revealOn: 1, shotName: 'detective' });
  await page.getByText('Round complete!').waitFor();
  await shot(page, 'complete-fresh');
  await page.getByRole('button', { name: 'Map', exact: true }).click();

  // Demo profile, then the scripted adaptation moment.
  await page.keyboard.press('Shift+D');
  await pause(page, 400);
  await shot(page, 'hub-demo');
  await page.locator('.game-card', { hasText: 'Word Builder' }).click();
  await playBuilderRound(page, { mistakeOn: 1, shots: true });
  await page.getByText('Round complete!').waitFor();
  await pause(page, 600);
  await shot(page, 'complete-level-up');
  await page.locator('.night').waitFor({ timeout: 4000 });
  await pause(page, 400);
  await shot(page, 'glow-up');
  await page.getByRole('button', { name: 'Put them on!' }).click();
  await page.getByRole('button', { name: /Next: longer words/ }).click();
  await page.locator('.slots').waitFor();
  const next = await Promise.all([0, 1, 2, 3, 4].map((i) => currentWord(page, i)));
  console.log(`After level-up, Word Builder serves: ${next.map((w) => `${w.word} (L${w.level})`).join(', ')}`);
  await shot(page, 'builder-level-3');
  await page.getByRole('button', { name: 'Back to the map' }).click();

  // Syllable Speller (Orton-Gillingham style).
  await page.locator('.game-card', { hasText: 'Syllable Speller' }).click();
  await playSpellerRound(page, { shots: true });
  await page.getByText('Round complete!').waitFor();
  await shot(page, 'speller-complete');
  await page.getByRole('button', { name: 'Map', exact: true }).click();

  // Sound Match.
  await page.locator('.game-card', { hasText: 'Sound Match' }).click();
  await page.locator('.answers').waitFor();
  await shot(page, 'sound-item');
  await page.keyboard.press('Escape');

  // Grown-ups: press and hold.
  await page.getByRole('button', { name: 'for grown-ups' }).click();
  const hold = page.getByRole('button', { name: 'Hold to open' });
  const box = await hold.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await pause(page, 3300);
  await page.mouse.up();
  await page.getByText('This week in brief').waitFor();
  await shot(page, 'grown-up');
  await page.getByRole('button', { name: /Back to/ }).click();

  await page.getByRole('button', { name: 'Lumo\'s closet' }).click();
  await shot(page, 'closet');
  await page.getByRole('button', { name: 'Back to the map' }).click();

  await page.getByRole('button', { name: 'Settings' }).click();
  await shot(page, 'settings');
  await page.getByRole('group', { name: 'Background' }).getByRole('button', { name: 'Dark' }).click();
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await pause(page, 300);
  await shot(page, 'hub-dark');

  // Phone width: no horizontal scroll.
  const phone = await newPage({ width: 390, height: 844 });
  await phone.goto(APP_URL);
  await phone.evaluate(() => localStorage.clear());
  await phone.reload();
  await pause(phone, 400);
  await shot(phone, 'phone-welcome');
  await phone.getByRole('button', { name: /Let's go/ }).click();
  await phone.keyboard.press('Shift+D');
  await pause(phone, 300);
  await shot(phone, 'phone-hub');
  await phone.locator('.game-card', { hasText: 'Word Detective' }).click();
  await phone.locator('.answers').waitFor();
  await shot(phone, 'phone-detective');
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) errors.push(`Horizontal scroll at phone width: ${overflow}px`);

  // "No red anywhere": scan computed colors on every element.
  const reds = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      for (const prop of ['color', 'backgroundColor', 'borderTopColor']) {
        const m = cs[prop].match(/rgba?\((\d+), (\d+), (\d+)/);
        if (m) {
          const [r, g, b] = m.slice(1).map(Number);
          if (r > 180 && g < 90 && b < 90) out.push(`${el.tagName}.${el.className} ${prop}`);
        }
      }
    }
    return out;
  });
  if (reds.length) errors.push(`Red found: ${reds.slice(0, 5).join(', ')}`);
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
}

if (errors.length) {
  console.error(`Smoke test failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Smoke test passed. ${step} screenshots in ${OUT}/`);
