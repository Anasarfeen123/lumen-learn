import { describe, expect, it } from 'vitest';
import { rulePlan, validPlan, validStory } from './personal-api.mjs';

const candidates = [
  { id: 'practice', label: 'Practise mistakes', kind: 'practice' },
  { id: 'game:detective', label: 'Word Detective', kind: 'game', skill: 'confusable' },
  { id: 'game:sound', label: 'Sound Match', kind: 'game', skill: 'digraph' },
  { id: 'story:pip-the-pup', label: 'Pip the Pup', kind: 'story', topic: 'animals' },
  { id: 'story:moon', label: 'Moon trip', kind: 'story', topic: 'space' },
];

describe('rule plan', () => {
  it('revisits mistakes, practises the weakest skill, and picks a story on a favourite topic', () => {
    const p = rulePlan({ candidates, weak: ['digraph'], interests: ['space'], mistakes: ['ship'] });
    expect(p.steps.map((s) => s.id)).toEqual(['practice', 'game:sound', 'story:moon']);
    expect(p.source).toBe('rules');
    expect(validPlan(p, candidates)).toBe(true);
  });
});

describe('AI plan checks', () => {
  const ok = { greeting: 'Hi! Let us start with a story you will like.', steps: [{ id: 'story:moon', why: 'You like space.' }, { id: 'game:sound', why: 'Gentle practice for letter pairs.' }] };
  it('accepts a plan that only uses offered ids', () => expect(validPlan(ok, candidates)).toBe(true));
  it('rejects invented ids, repeats, numbers and unkind words', () => {
    expect(validPlan({ ...ok, steps: [{ id: 'game:made-up', why: 'x' }, ok.steps[1]] }, candidates)).toBe(false);
    expect(validPlan({ ...ok, steps: [ok.steps[0], ok.steps[0]] }, candidates)).toBe(false);
    expect(validPlan({ ...ok, greeting: 'You got 3 wrong yesterday.' }, candidates)).toBe(false);
    expect(validPlan({ ...ok, greeting: 'This is hard because of your dyslexia.' }, candidates)).toBe(false);
  });
});

describe('story checks', () => {
  const text = 'Sam has a ship. The ship is red. Sam and Pip sail on the sea. A fish swims by the ship. The sun is hot. Pip naps in the shade. They sail home to rest.';
  it('accepts a short, kind story that uses the focus words', () => {
    const r = validStory({ title: 'The Red Ship', text }, { words: ['ship', 'fish', 'shade'], level: 2 });
    expect(r.ok).toBe(true);
    expect(r.used).toEqual(['ship', 'fish', 'shade']);
  });
  it('rejects stories that skip the words, run long, or turn scary', () => {
    expect(validStory({ title: 'Boat', text: text.replace(/ship|fish|shade/g, 'boat') }, { words: ['ship', 'fish', 'shade'], level: 2 }).ok).toBe(false);
    expect(validStory({ title: 'Ship', text: `${text} Then a scary monster came out of the dark sea and it was very very loud and big.` }, { words: ['ship'], level: 1 }).ok).toBe(false);
    expect(validStory({ title: 'Ship', text: 'The ship. 5 fish.' }, { words: [], level: 2 }).ok).toBe(false);
  });
});
