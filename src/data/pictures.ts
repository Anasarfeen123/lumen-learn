// `picture` in the word bank is a description, not a file. Each one maps to an
// emoji: no network, always loads. Swap in flat illustrations with the same keys later.
export const PICTURES: Record<string, string> = {
  cat: '🐱',
  bed: '🛏️',
  dog: '🐶',
  sun: '☀️',
  pig: '🐷',
  ship: '🚢',
  fish: '🐟',
  hand: '✋',
  frog: '🐸',
  star: '⭐',
  boat: '⛵',
  'rain cloud': '🌧️',
  moon: '🌙',
  duck: '🦆',
  crown: '👑',
  'two people waving': '👋',
  'speech bubble': '💬',
  house: '🏠',
  rabbit: '🐰',
  'flowers in a garden': '🌷',
  'group of people': '👨‍👩‍👧‍👦',
  lion: '🦁',
  elephant: '🐘',
  rainbow: '🌈',
  butterfly: '🦋',
  'thought bubble': '💭',
  dinosaur: '🦕',
  'treasure map': '🗺️',
  'stack of books': '📚',
};

export function pictureFor(description: string | null): string | null {
  return description ? PICTURES[description] ?? null : null;
}
