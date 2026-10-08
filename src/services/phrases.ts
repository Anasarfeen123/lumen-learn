// Every fixed thing Lumo can say, in the exact form the app speaks it, so a
// prebuilt voice pack (npm run voices) can play it instantly. Lines are
// generated through the same helpers the screens use: speech bubbles are split
// the same way and the learner's name is removed the same way.
import { LINES, GAME_INTRO, toBubbles } from '../data/lines';
import { BANK } from '../engine/wordbank';
import { FAMILIES, spokenSyllables } from '../engine/speller';
import { ALL_TAGS, SHORT_NAME, capitalize } from '../engine/tags';
import { nextChallenge } from '../engine/adaptive';
import { GAME_NAME } from '../engine/report';
import { GAMES } from '../engine/types';
import { sayableSound } from '../engine/items';
import { phraseKey, withoutPrivateWords, type SpeechStyle } from './speech';

export { phraseKey };

export interface Phrase {
  text: string;
  style: SpeechStyle;
}

/** A sample name: anything Lumo says with a name is spoken with the name left out. */
const NAME = 'Maya';

/** How a line is actually voiced: bubbles of ≤12 words, without the learner's name. */
function voiced(text: string): string[] {
  return toBubbles(text).map((b) => withoutPrivateWords(b, [NAME])).filter(Boolean);
}

/** Lines that may contain {name}: with a name (removed) and without one ("friend"). */
function withNames(template: string): string[] {
  return [...voiced(template.replaceAll('{name}', NAME)), ...voiced(template.replaceAll('{name}', 'friend'))];
}

export function lumoLines(): string[] {
  const out: string[] = [];
  for (const group of Object.values(LINES)) for (const l of group) out.push(...withNames(l));
  out.push(...Object.values(GAME_INTRO));

  // Hub greetings.
  for (const g of GAMES) {
    const tail = `I picked ${GAME_NAME[g]} for you.`;
    out.push(...voiced(`Hi! ${tail}`), ...voiced(`Hi, ${NAME}! ${tail}`));
    for (const l of LINES.hubReturning) out.push(...withNames(`${l} ${tail}`));
  }

  // Insights, every template.
  for (const t of ALL_TAGS) {
    const s = SHORT_NAME[t];
    for (const L of [2, 3, 4, 5]) out.push(`You're doing great with ${s}. Let's try ${nextChallenge(L)}!`);
    out.push(`${capitalize(s)} are getting easier. I can tell!`, `${capitalize(s)} are tricky. Let's practise a few more.`, `You're great at ${s} now!`);
  }
  for (const L of [2, 3, 4, 5]) out.push(`You're doing great with these words. Let's try ${nextChallenge(L)}!`);
  out.push("Great practice! Let's keep going.");

  // Partial credit and other fixed prompts.
  for (let total = 2; total <= 9; total++) {
    for (let n = 1; n < total; n++) {
      out.push(`${n} of ${total} letters are right! Fix the rest.`, `${n} of ${total} pieces are right! Fix the rest.`);
      if (total <= 4) out.push(`${n} of ${total} beats are right! Fix the rest.`);
    }
  }
  out.push(
    'Find:', 'Build the word.', 'Spell the word one beat at a time.', 'You built it!', 'Now you know it!',
    "This one's tricky. Watch the beats.", "This one's tricky. Here it is!", 'A glow chest! Here is some extra glow.',
    "Hi! I'm Lumo. Let's light up some words.", "Hi! I'm Lumo. I love words. Want to play?",
  );
  return out.flatMap((l) => voiced(l));
}

/** Words, syllables, letters and sounds, in the styles the games use. */
export function wordPhrases(): Phrase[] {
  const out: Phrase[] = [];
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  for (const w of BANK) {
    out.push({ text: w.word, style: 'word' });
    // Detective hint: syllables slowly. Builder (low levels): syllable tiles said as words.
    for (const s of w.syllables) out.push({ text: s, style: 'slow' }, { text: s, style: 'word' });
  }
  for (const f of FAMILIES) {
    for (const w of f.words) {
      out.push({ text: w.word, style: 'word' });
      for (const s of spokenSyllables(w)) out.push({ text: s, style: 'slow' });
    }
  }
  for (const l of letters) out.push({ text: l, style: 'word' }, { text: sayableSound(l), style: 'slow' });
  for (const d of ['sh', 'ch', 'th', 'ph', 'wh', 'kn', 'qu', 'ck']) out.push({ text: sayableSound(d), style: 'slow' });
  return out;
}

/** The whole voice pack, de-duplicated. */
export function voicePackPhrases(): Phrase[] {
  const all: Phrase[] = [...lumoLines().map((text) => ({ text, style: 'lumo' as const })), ...wordPhrases()];
  const seen = new Set<string>();
  return all.filter((p) => {
    const k = phraseKey(p.text, p.style);
    if (seen.has(k) || !p.text.trim()) return false;
    seen.add(k);
    return true;
  });
}
