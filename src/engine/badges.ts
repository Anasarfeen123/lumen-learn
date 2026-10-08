// Achievements: badges and milestones that celebrate taking part and progress.
// None of them depend on speed, and none can be lost.
import type { Profile } from '../state/profile';
import { stageIndex } from './progression';
import { band } from './report';

export interface Badge {
  id: string;
  title: string;
  how: string;
  earned: (p: Profile, ctx: BadgeContext) => boolean;
}

export interface BadgeContext {
  storiesFinished: number;
}

const rounds = (p: Profile) => p.rounds.length;
const plays = (p: Profile) => Object.entries(p.playground).filter(([k]) => !k.includes('-')).reduce((s, [, v]) => s + v.plays, 0);
const lessons = (p: Profile) => Object.values(p.courses).reduce((s, path) => s + (path?.filter((n) => n.kind !== 'chest').length ?? 0), 0);

export const BADGES: Badge[] = [
  { id: 'first-lesson', title: 'First lesson', how: 'Finish your first lesson.', earned: (p) => rounds(p) >= 1 },
  { id: 'explorer', title: 'Explorer', how: 'Visit the Classroom, Library and Playground.', earned: (p, c) => rounds(p) >= 1 && plays(p) >= 1 && c.storiesFinished >= 1 },
  { id: 'builder', title: 'Word Builder', how: 'Get 2 stars in Word Builder.', earned: (p) => (p.stars.builder ?? 0) >= 2 },
  { id: 'sound', title: 'Sound Pro', how: 'Get 3 stars in Sound Match.', earned: (p) => (p.stars.sound ?? 0) >= 3 },
  { id: 'reading-star', title: 'Reading Star', how: 'Read a whole story.', earned: (_, c) => c.storiesFinished >= 1 },
  { id: 'game-champ', title: 'Game Champ', how: 'Play 5 Playground games.', earned: (p) => plays(p) >= 5 },
  { id: 'streak7', title: '7-day streak', how: 'Practise on 7 days in a row.', earned: (p) => p.streak.days >= 7 },
  { id: 'confident', title: 'Confident learner', how: 'Become confident in any skill.', earned: (p) => Object.values(p.mastery).some((m) => (m?.n ?? 0) >= 5 && band(m!.m) === 'Confident') },
  { id: 'fixer', title: 'Mistake fixer', how: 'Fix a tricky word in Practice mistakes.', earned: (p) => p.mistakesFixed >= 1 },
  { id: 'glow', title: 'Glowing', how: 'Help Lumo reach Shine.', earned: (p) => stageIndex(p.xp) >= 2 },
  { id: 'bookworm', title: 'Bookworm', how: 'Read 3 whole stories.', earned: (_, c) => c.storiesFinished >= 3 },
  { id: 'speller', title: 'Syllable speller', how: 'Get 2 stars in Syllable Speller.', earned: (p) => (p.stars.speller ?? 0) >= 2 },
];

export interface Milestone { title: string; value: number; target: number }

export function milestones(p: Profile, ctx: BadgeContext): Milestone[] {
  return [
    { title: 'Complete 5 lessons', value: Math.min(5, lessons(p)), target: 5 },
    { title: 'Play 3 games', value: Math.min(3, plays(p)), target: 3 },
    { title: 'Read your first story', value: Math.min(1, ctx.storiesFinished), target: 1 },
    { title: 'Learn 50 words', value: Math.min(50, p.wordsLearned), target: 50 },
  ];
}

export function earnedBadges(p: Profile, ctx: BadgeContext): string[] {
  return BADGES.filter((b) => b.earned(p, ctx)).map((b) => b.id);
}
