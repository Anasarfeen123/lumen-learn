export type GameId = 'detective' | 'sound' | 'builder' | 'speller';
export const GAMES: GameId[] = ['detective', 'sound', 'builder', 'speller'];

export type Tag =
  | 'short'
  | 'medium'
  | 'long'
  | 'multi'
  | 'irregular'
  | 'digraph'
  | 'blend'
  | 'vowel-team'
  | 'confusable'
  | 'silent';

export type Result = 'first' | 'hint' | 'shown';

export interface Word {
  id: string;
  word: string;
  level: number;
  syllables: string[];
  tags: Tag[];
  picture: string | null;
  misspellings: string[];
  soundAlikes: string[];
  /** Syllable Speller word family (-tion, -ture...), for family words only. */
  family?: string;
}

export interface TagMastery {
  m: number;
  n: number;
}

export type Mastery = Partial<Record<Tag, TagMastery>>;
