// Builds the Library's word-help dictionary: every word in the story bank,
// explained in the sentence where it first appears. Drafted by the AI (the
// same validated explainer the reader uses live), saved as local content so
// the reader needs no network for story words. Resumable; review the output.
//
//   npm run dictionary
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../server/env.mjs';

loadEnv();
const { explainWords } = await import('../server/lumo-api.mjs');

const STORIES = fileURLToPath(new URL('../src/library/stories.json', import.meta.url));
const OUT = fileURLToPath(new URL('../src/library/dictionary.json', import.meta.url));
if (!process.env.GROQ_API_KEY) {
  console.error('GROQ_API_KEY is missing. Add it to .env (see .env.example).');
  process.exit(1);
}

const norm = (w) => w.toLowerCase().replace(/’/g, "'").replace(/'s$/, '');
const dict = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { version: 1, note: 'Drafted by AI from each word\'s sentence in the story bank; review before treating as approved.', entries: {} };

// First sentence each word appears in.
const contexts = new Map();
for (const story of JSON.parse(readFileSync(STORIES, 'utf8')).stories) {
  for (const page of story.pages) {
    for (const sentence of page.replace(/\n+/g, ' ').match(/[^.!?]+[.!?]+["”]?/g) ?? [page]) {
      for (const w of sentence.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? []) {
        const key = norm(w);
        if (!contexts.has(key)) contexts.set(key, { word: w.replace(/['’]s$/, ''), sentence: sentence.trim() });
      }
    }
  }
}

const todo = [...contexts.entries()].filter(([k]) => !dict.entries[k]);
console.log(`${contexts.size} words in the stories; ${todo.length} to explain.`);
const BATCH = 15;
let done = 0;
let failed = 0;
for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  let results;
  try {
    results = await explainWords(batch.map(([, c]) => c), 30000);
  } catch (e) {
    console.log(`  batch failed (${e.message}); waiting 20s`);
    await new Promise((r) => setTimeout(r, 20000));
    i -= BATCH;
    continue;
  }
  batch.forEach(([key], j) => {
    if (results[j]) {
      dict.entries[key] = { ...results[j], source: 'ai' };
      done++;
    } else failed++;
  });
  writeFileSync(OUT, `${JSON.stringify(dict, null, 1)}\n`);
  console.log(`  ${Object.keys(dict.entries).length}/${contexts.size}`);
}
console.log(`Done: ${done} new, ${failed} skipped (failed validation; run again to retry).`);
