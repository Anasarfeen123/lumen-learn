import type { GameId, Tag } from './types';

export const ALL_TAGS: Tag[] = [
  'short', 'medium', 'long', 'multi', 'irregular', 'digraph', 'blend', 'vowel-team', 'confusable', 'silent',
];

export const LENGTH_TAGS: Tag[] = ['short', 'medium', 'long'];

/** Plain names for grown-ups. */
export const PLAIN_NAME: Record<Tag, string> = {
  short: 'Short words',
  medium: 'Medium words',
  long: 'Long words',
  multi: 'Words with more than one beat',
  irregular: "Tricky words that aren't spelled how they sound",
  digraph: 'Letter pairs like sh and ch',
  blend: 'Blends like st and fr',
  'vowel-team': 'Vowel teams like ai and oa',
  confusable: 'Look-alike letters like b and d',
  silent: 'Silent letters',
};

/** Short names used inside Lumo's lines. */
export const SHORT_NAME: Record<Tag, string> = {
  short: 'short words',
  medium: 'medium words',
  long: 'long words',
  multi: 'words with more beats',
  irregular: 'tricky words',
  digraph: "'sh' and 'ch' words",
  blend: 'blends',
  'vowel-team': 'vowel teams',
  confusable: "'b' and 'd' words",
  silent: 'silent letters',
};

/** Which game practises a weak tag best. */
export const GAME_FOR_TAG: Record<Tag, GameId> = {
  confusable: 'detective',
  irregular: 'detective',
  silent: 'detective',
  digraph: 'sound',
  'vowel-team': 'sound',
  blend: 'sound',
  long: 'builder',
  multi: 'builder',
  medium: 'builder',
  short: 'builder',
};

export const SKILLS: { label: string; tags: Tag[] }[] = [
  { label: 'Word recognition', tags: ['irregular', 'confusable', 'silent'] },
  { label: 'Listening for sounds', tags: ['digraph', 'vowel-team', 'blend'] },
  { label: 'Spelling and order', tags: ['short', 'medium', 'long', 'multi'] },
];

export function capitalize(s: string): string {
  const i = s.search(/[a-z]/i);
  return i < 0 ? s : s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1);
}
