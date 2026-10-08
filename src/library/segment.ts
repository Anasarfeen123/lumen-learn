// Whole-word segmentation for the reader. Every displayed word is one
// interactive unit; spaces, punctuation and line breaks are kept exactly as
// written. Uses Intl.Segmenter (word granularity), so "don't" and "Lumo's"
// stay one word, and the text is never split into letters.

export interface Token {
  text: string;
  /** True for a word (selectable); false for spaces, punctuation and line breaks. */
  word: boolean;
  /** Index into the original string. */
  start: number;
}

export interface Paragraph {
  /** Tokens of the paragraph, including single line breaks as "\n" tokens. */
  tokens: Token[];
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
  ? new Intl.Segmenter('en', { granularity: 'word' })
  : null;

/** Fallback for very old browsers: words are runs of letters, digits and inner apostrophes. */
function fallbackSegments(text: string): { segment: string; index: number; isWordLike: boolean }[] {
  const out: { segment: string; index: number; isWordLike: boolean }[] = [];
  const re = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|[^\p{L}\p{N}]+/gu;
  for (const m of text.matchAll(re)) out.push({ segment: m[0], index: m.index ?? 0, isWordLike: /[\p{L}\p{N}]/u.test(m[0]) });
  return out;
}

export function tokenize(text: string, offset = 0): Token[] {
  const parts = segmenter ? [...segmenter.segment(text)].map((s) => ({ segment: s.segment, index: s.index, isWordLike: Boolean(s.isWordLike) })) : fallbackSegments(text);
  return parts.map((p) => ({ text: p.segment, word: p.isWordLike, start: p.index + offset }));
}

/** Splits text into paragraphs at blank lines; single line breaks stay inside the paragraph. */
export function paragraphs(text: string): Paragraph[] {
  const out: Paragraph[] = [];
  const re = /\n[ \t]*\n+/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const chunk = text.slice(last, m.index);
    if (chunk.trim()) out.push({ tokens: tokenize(chunk, last) });
    last = (m.index ?? 0) + m[0].length;
  }
  const tail = text.slice(last);
  if (tail.trim()) out.push({ tokens: tokenize(tail, last) });
  return out;
}

/** The sentence around a character position, for word help in context. */
export function sentenceAt(text: string, index: number): string {
  const before = text.slice(0, index);
  const startMatch = before.match(/[.!?]["”']?\s+(?=[^.!?]*$)/);
  const start = startMatch ? (startMatch.index ?? 0) + startMatch[0].length : before.lastIndexOf('\n\n') + 1;
  const rest = text.slice(index);
  const endMatch = rest.match(/[.!?]["”']?(?=\s|$)/);
  const end = endMatch ? index + (endMatch.index ?? 0) + endMatch[0].length : text.length;
  return text.slice(Math.max(0, start), end).replace(/\s+/g, ' ').trim();
}

/** A word as a dictionary key: lowercase, curly apostrophes straightened, possessive 's removed. */
export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/’/g, "'").replace(/'s$/, '');
}
