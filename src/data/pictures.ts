// `picture` in the word bank is a description, not a file. Each description
// maps to a Fluent 3D illustration (Microsoft, MIT licence), downloaded once
// by `npm run pictures` into public/pictures/ so it works offline and looks
// the same on every device. The emoji is the fallback if an image is missing.

export interface PictureInfo {
  /** Folder name in microsoft/fluentui-emoji/assets. */
  fluent: string;
  emoji: string;
}

export const PICTURES: Record<string, PictureInfo> = {
  cat: { fluent: 'Cat face', emoji: '🐱' },
  bed: { fluent: 'Bed', emoji: '🛏️' },
  dog: { fluent: 'Dog face', emoji: '🐶' },
  sun: { fluent: 'Sun', emoji: '☀️' },
  pig: { fluent: 'Pig face', emoji: '🐷' },
  ship: { fluent: 'Ship', emoji: '🚢' },
  fish: { fluent: 'Fish', emoji: '🐟' },
  hand: { fluent: 'Raised hand', emoji: '✋' },
  frog: { fluent: 'Frog', emoji: '🐸' },
  star: { fluent: 'Star', emoji: '⭐' },
  boat: { fluent: 'Sailboat', emoji: '⛵' },
  'rain cloud': { fluent: 'Cloud with rain', emoji: '🌧️' },
  moon: { fluent: 'Crescent moon', emoji: '🌙' },
  duck: { fluent: 'Duck', emoji: '🦆' },
  crown: { fluent: 'Crown', emoji: '👑' },
  'two people waving': { fluent: 'People hugging', emoji: '🫂' },
  'speech bubble': { fluent: 'Speech balloon', emoji: '💬' },
  house: { fluent: 'House', emoji: '🏠' },
  rabbit: { fluent: 'Rabbit face', emoji: '🐰' },
  'flowers in a garden': { fluent: 'Tulip', emoji: '🌷' },
  'group of people': { fluent: 'Busts in silhouette', emoji: '👥' },
  lion: { fluent: 'Lion', emoji: '🦁' },
  elephant: { fluent: 'Elephant', emoji: '🐘' },
  rainbow: { fluent: 'Rainbow', emoji: '🌈' },
  butterfly: { fluent: 'Butterfly', emoji: '🦋' },
  'thought bubble': { fluent: 'Thought balloon', emoji: '💭' },
  dinosaur: { fluent: 'Sauropod', emoji: '🦕' },
  'treasure map': { fluent: 'World map', emoji: '🗺️' },
  'stack of books': { fluent: 'Books', emoji: '📚' },
  'top hat': { fluent: 'Top hat', emoji: '🎩' },
  bag: { fluent: 'Backpack', emoji: '🎒' },
  cup: { fluent: 'Hot beverage', emoji: '☕' },
  bus: { fluent: 'Bus', emoji: '🚌' },
  box: { fluent: 'Package', emoji: '📦' },
  fox: { fluent: 'Fox', emoji: '🦊' },
  hen: { fluent: 'Chicken', emoji: '🐔' },
  map: { fluent: 'World map', emoji: '🗺️' },
  pen: { fluent: 'Pen', emoji: '🖊️' },
  'spider web': { fluent: 'Spider web', emoji: '🕸️' },
  bug: { fluent: 'Bug', emoji: '🐛' },
  socks: { fluent: 'Socks', emoji: '🧦' },
  bell: { fluent: 'Bell', emoji: '🔔' },
  egg: { fluent: 'Egg', emoji: '🥚' },
  cake: { fluent: 'Birthday cake', emoji: '🎂' },
  tree: { fluent: 'Deciduous tree', emoji: '🌳' },
  train: { fluent: 'Locomotive', emoji: '🚂' },
  snake: { fluent: 'Snake', emoji: '🐍' },
  clock: { fluent: 'Alarm clock', emoji: '⏰' },
  chair: { fluent: 'Chair', emoji: '🪑' },
  sheep: { fluent: 'Ewe', emoji: '🐑' },
  whale: { fluent: 'Spouting whale', emoji: '🐳' },
  drum: { fluent: 'Drum', emoji: '🥁' },
  crab: { fluent: 'Crab', emoji: '🦀' },
  'glass of milk': { fluent: 'Glass of milk', emoji: '🥛' },
  coat: { fluent: 'Coat', emoji: '🧥' },
  shell: { fluent: 'Spiral shell', emoji: '🐚' },
  flag: { fluent: 'Triangular flag', emoji: '🚩' },
  bread: { fluent: 'Bread', emoji: '🍞' },
  chick: { fluent: 'Baby chick', emoji: '🐤' },
  'water drop': { fluent: 'Droplet', emoji: '💧' },
  monkey: { fluent: 'Monkey face', emoji: '🐵' },
  pencil: { fluent: 'Pencil', emoji: '✏️' },
  tiger: { fluent: 'Tiger face', emoji: '🐯' },
  pizza: { fluent: 'Pizza', emoji: '🍕' },
  carrot: { fluent: 'Carrot', emoji: '🥕' },
  rocket: { fluent: 'Rocket', emoji: '🚀' },
  apple: { fluent: 'Red apple', emoji: '🍎' },
  dragon: { fluent: 'Dragon', emoji: '🐉' },
  school: { fluent: 'School', emoji: '🏫' },
  island: { fluent: 'Desert island', emoji: '🏝️' },
  'writing hand': { fluent: 'Writing hand', emoji: '✍️' },
  lamb: { fluent: 'Ewe', emoji: '🐑' },
  knife: { fluent: 'Kitchen knife', emoji: '🔪' },
  robot: { fluent: 'Robot', emoji: '🤖' },
  laptop: { fluent: 'Laptop', emoji: '💻' },
  octopus: { fluent: 'Octopus', emoji: '🐙' },
  kangaroo: { fluent: 'Kangaroo', emoji: '🦘' },
  hospital: { fluent: 'Hospital', emoji: '🏥' },
  tomato: { fluent: 'Tomato', emoji: '🍅' },
  potato: { fluent: 'Potato', emoji: '🥔' },
  volcano: { fluent: 'Volcano', emoji: '🌋' },
  giraffe: { fluent: 'Giraffe', emoji: '🦒' },
  sandwich: { fluent: 'Sandwich', emoji: '🥪' },
  penguin: { fluent: 'Penguin', emoji: '🐧' },
  strawberry: { fluent: 'Strawberry', emoji: '🍓' },
  telephone: { fluent: 'Telephone', emoji: '☎️' },
  spaghetti: { fluent: 'Spaghetti', emoji: '🍝' },
  calendar: { fluent: 'Calendar', emoji: '📅' },
  microscope: { fluent: 'Microscope', emoji: '🔬' },
};

/** File name for a picture description in public/pictures/. */
export function pictureSlug(description: string): string {
  return description.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export interface Picture {
  src: string;
  emoji: string;
  alt: string;
}

export function pictureFor(description: string | null): Picture | null {
  if (!description) return null;
  const info = PICTURES[description];
  if (!info) return null;
  return { src: `${import.meta.env.BASE_URL}pictures/${pictureSlug(description)}.png`, emoji: info.emoji, alt: description };
}
