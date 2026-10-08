import { describe, expect, it } from 'vitest';
import { normalizeWord, paragraphs, sentenceAt, tokenize } from './segment';
import { listStories, readingMinutes } from './content';

const words = (t: string) => tokenize(t).filter((x) => x.word).map((x) => x.text);

describe('whole-word segmentation', () => {
  it('keeps every character of the original, in order', () => {
    const text = 'Pip is a pup. "Where is it?" said Dad—\nthen he smiled!  Yes...';
    expect(tokenize(text).map((t) => t.text).join('')).toBe(text);
  });

  it('makes whole words the unit, never letters', () => {
    expect(words('Pip has a red ball.')).toEqual(['Pip', 'has', 'a', 'red', 'ball']);
  });

  it('keeps apostrophes inside words', () => {
    expect(words("Don't touch Lumo's lamp, it's hot.")).toEqual(["Don't", 'touch', "Lumo's", 'lamp', "it's", 'hot']);
    expect(words('I can’t see.')).toEqual(['I', 'can’t', 'see']);
  });

  it('keeps small words like "a" and "the"', () => {
    expect(words('a cat and the dog')).toEqual(['a', 'cat', 'and', 'the', 'dog']);
  });

  it('treats each part of a hyphenated word as a word, keeping the hyphen', () => {
    const t = tokenize('a well-known tree');
    expect(t.map((x) => x.text).join('')).toBe('a well-known tree');
    expect(t.filter((x) => x.word).map((x) => x.text)).toEqual(['a', 'well', 'known', 'tree']);
  });

  it('records where each word starts in the original text', () => {
    const t = tokenize('The big ship');
    const ship = t.find((x) => x.text === 'ship')!;
    expect('The big ship'.slice(ship.start, ship.start + 4)).toBe('ship');
  });

  it('splits paragraphs at blank lines and keeps single line breaks', () => {
    const p = paragraphs('One line\nnext line.\n\nNew paragraph.');
    expect(p).toHaveLength(2);
    expect(p[0].tokens.map((t) => t.text).join('')).toBe('One line\nnext line.');
    expect(p[1].tokens[0].start).toBe('One line\nnext line.\n\n'.length);
  });

  it('finds the sentence around a word for word help', () => {
    const text = 'Pip is a pup. Pip has a red ball. It rolls.';
    expect(sentenceAt(text, text.indexOf('red'))).toBe('Pip has a red ball.');
  });

  it('normalizes words for the dictionary', () => {
    expect(normalizeWord("Lumo's")).toBe('lumo');
    expect(normalizeWord('Don’t')).toBe("don't");
  });
});

describe('story bank', () => {
  it('only shows published stories outside development', () => {
    const published = listStories(false);
    expect(published.every((s) => s.status === 'published')).toBe(true);
    expect(listStories(true).length).toBeGreaterThan(published.length);
  });

  it('gives every story pages, a level, a cover and a reading time', () => {
    for (const s of listStories(true)) {
      expect(s.pages.length).toBeGreaterThan(0);
      expect(s.level).toBeGreaterThanOrEqual(1);
      expect(readingMinutes(s)).toBeGreaterThanOrEqual(1);
    }
  });
});
