// Courses and units. A course is a focus (a bit of everything, sounds,
// spelling, spotting tricky spellings) made of themed units; every unit
// follows the same rhythm of rounds, a mistake review, a chest, a mixed round
// and a milestone. The adaptive engine still picks the words.
import { UNIT_PATTERN, UNIT_SIZE, mistakeCount, type Mistakes, type NodeKind } from './practice';
import type { GameId } from './types';

export type CourseId = 'explorer' | 'sounds' | 'spelling' | 'look';

export interface Unit {
  title: string;
  about: string;
  scenery: 'meadow' | 'seaside' | 'forest' | 'mountains' | 'space';
  color: string;
}

export interface Course {
  id: CourseId;
  title: string;
  about: string;
  games: GameId[];
  hatch: string;
  units: Unit[];
}

const SCENERY: Unit['scenery'][] = ['meadow', 'seaside', 'forest', 'mountains', 'space'];
const COLORS = ['#2b2c5e', '#2d5a8a', '#23603f', '#6a3f8f', '#1f2a44'];

function units(list: [string, string][]): Unit[] {
  return list.map(([title, about], i) => ({ title, about, scenery: SCENERY[i % SCENERY.length], color: COLORS[i % COLORS.length] }));
}

export const COURSES: Course[] = [
  {
    id: 'explorer',
    title: 'Word Explorer',
    about: 'A bit of everything: spot, hear, build and spell.',
    games: ['detective', 'sound', 'builder', 'speller'],
    hatch: 'hatch-yellow',
    units: units([
      ['First words', 'Short words you hear every day.'],
      ['Longer words', 'Blends and letter teams join in.'],
      ['Tricky words', "Words that aren't spelled how they sound."],
      ['Big words', 'Three beats and more.'],
      ['Word explorer', 'The longest words in Lumen.'],
    ]),
  },
  {
    id: 'sounds',
    title: 'Sound Lab',
    about: 'Hear the sounds inside words.',
    games: ['sound', 'detective'],
    hatch: 'hatch-blush',
    units: units([
      ['First sounds', 'Listen for the very first sound.'],
      ['Sound pairs', 'sh, ch and th: two letters, one sound.'],
      ['Vowel teams', 'ai, oa and ee working together.'],
      ['Sound twins', 'Words that sound nearly the same.'],
      ['Sound master', 'Long words, every sound.'],
    ]),
  },
  {
    id: 'spelling',
    title: 'Spelling Studio',
    about: 'Build words letter by letter and beat by beat.',
    games: ['builder', 'speller'],
    hatch: 'hatch-leaf',
    units: units([
      ['Short words', 'Three and four letters, in order.'],
      ['Blends', 'st, fr, cl: slide the sounds together.'],
      ['Beats', 'Chop words into syllables.'],
      ['Word endings', '-tion, -ture and -ble.'],
      ['Long words', 'Big words, one beat at a time.'],
    ]),
  },
  {
    id: 'look',
    title: 'Look Closely',
    about: 'Spot the right spelling, every time.',
    games: ['detective', 'builder'],
    hatch: 'hatch-lav',
    units: units([
      ['b and d', 'Look-alike letters, side by side.'],
      ['Missing letters', 'Find the word with every letter.'],
      ['Tricky words', 'said, friend, because.'],
      ['Silent letters', 'The k in knife, the b in lamb.'],
      ['Detective pro', 'The closest misspellings.'],
    ]),
  },
];

export const COURSE_BY_ID = new Map(COURSES.map((c) => [c.id, c]));

export function courseOf(id: string | undefined): Course {
  return COURSE_BY_ID.get(id as CourseId) ?? COURSES[0];
}

/** Units go on forever: after the last one, its theme repeats as "Word explorer 2", and so on. */
export function unitAt(course: Course, index: number): Unit & { number: number } {
  const base = course.units[Math.min(index, course.units.length - 1)];
  const extra = index - (course.units.length - 1);
  return { ...base, title: extra > 0 ? `${base.title} ${extra + 1}` : base.title, number: index + 1 };
}

export interface PathSlot {
  index: number;
  kind: NodeKind;
  /** The game for a round node: the course's games take turns, so every unit has variety. */
  game?: GameId;
}

/** The node at this path position, and which game a round node plays. */
export function slotAt(course: Course, index: number, mistakes: Mistakes, available: GameId[]): PathSlot {
  let kind = UNIT_PATTERN[index % UNIT_SIZE];
  if (kind === 'review' && mistakeCount(mistakes) < 2) kind = 'mixed';
  if (kind !== 'round') return { index, kind };
  const games = course.games.filter((g) => available.includes(g));
  const pool = games.length ? games : available;
  // Count round nodes so far, so the games alternate along the path.
  const unit = Math.floor(index / UNIT_SIZE);
  const roundsBefore = unit * UNIT_PATTERN.filter((k) => k === 'round').length +
    UNIT_PATTERN.slice(0, index % UNIT_SIZE).filter((k) => k === 'round').length;
  return { index, kind, game: pool[roundsBefore % pool.length] };
}
