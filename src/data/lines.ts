// Lumo's line library (references/02-mascot-lumo.md). Every line is shown and
// spoken, is at most 12 words, and never says wrong, bad, fail or easy.

export const LINES = {
  hub: ['Hi, {name}! Ready to play with words?', "Let's light up some words today!", "I picked a game I think you'll like."],
  hubReturning: ['Welcome back, {name}! I missed you.', "You're back! Let's warm up with a fun one."],
  first: ['Yes! You got it!', 'Brilliant reading!', "That's the one!", 'You spotted it!', 'Look at that, perfect!'],
  afterHint: ['You did it! Hints are there to help.', 'Got it! Great thinking.', 'Yes! You worked that out.'],
  miss: ["Almost! Let's look again.", "So close! Here's a clue.", 'Nearly! Try listening one more time.', "Good try! Let's look at it another way."],
  reveal: ["This one's tricky. Here it is!", "Let's learn this one together. Tap it!", "Tricky word! You'll see it again soon."],
  streak: ["You're on a roll!", "Three in a row! You're glowing!"],
  roundDone: ["What a round! Look how bright I'm getting.", "You worked really hard. I'm proud of you!", 'Round done! Want to keep going?'],
  glowUp: ["Whoa! I'm glowing brighter! Thank you, {name}!"],
  idle: ["Take your time. I'll be right here."],
} as const;

export type LineKey = keyof typeof LINES;

const lastUsed = new Map<LineKey, string>();

/** Random line for an event, never the same one twice in a row. */
export function line(key: LineKey, name = '', rng: () => number = Math.random): string {
  const options = LINES[key];
  const prev = lastUsed.get(key);
  const pool = options.length > 1 ? options.filter((l) => l !== prev) : options;
  const pick = pool[Math.floor(rng() * pool.length)];
  lastUsed.set(key, pick);
  return fill(pick, name);
}

export function fill(text: string, name: string): string {
  return text.replaceAll('{name}', name || 'friend');
}

export const GAME_INTRO = {
  detective: "Find the word that's spelled right.",
  sound: 'Listen, then tap the word you hear.',
  builder: 'Put the letters in order to build the word.',
  speller: 'Spell the word one beat at a time.',
} as const;

/** Split anything longer than 12 words into separate bubbles, at sentence breaks. */
export function toBubbles(text: string, maxWords = 12): string[] {
  if (text.split(/\s+/).length <= maxWords) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text];
  const out: string[] = [];
  for (const s of sentences) {
    const last = out.at(-1);
    if (last && `${last} ${s}`.split(/\s+/).length <= maxWords) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
  }
  return out;
}
