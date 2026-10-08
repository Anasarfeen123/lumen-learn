// The Library's story bank: a bundled, versioned content model with
// draft/published status. Drafts only appear in development, clearly labelled.
import data from './stories.json';

export type StoryStatus = 'published' | 'draft';

export interface Story {
  id: string;
  version: number;
  status: StoryStatus;
  title: string;
  summary: string;
  level: number;
  topic: string;
  /** Picture description (see data/pictures.ts). */
  cover: string;
  /** Pages of text; blank lines separate paragraphs. */
  pages: string[];
}

export const CONTENT_VERSION: number = data.version;
const ALL = data.stories as Story[];

/** Stories a learner may see: published ones, plus drafts when developing. */
export function listStories(includeDrafts: boolean = import.meta.env.DEV): Story[] {
  return ALL.filter((s) => s.status === 'published' || includeDrafts);
}

export function getStory(id: string, includeDrafts: boolean = import.meta.env.DEV): Story | undefined {
  return listStories(includeDrafts).find((s) => s.id === id);
}

export function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}']+/gu) ?? []).length;
}

/** Rough reading time at a gentle pace (60 words a minute), never less than a minute. */
export function readingMinutes(story: Pick<Story, 'pages'>): number {
  return Math.max(1, Math.round(wordCount(story.pages.join(' ')) / 60));
}

export const TOPICS = [...new Set(ALL.map((s) => s.topic))].sort();
