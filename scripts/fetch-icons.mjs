// Turns the word-help emojis into Fluent 3D illustrations (Microsoft, MIT
// licence), and fetches the badge artwork. Writes public/pictures/icons/ and
// src/library/emojiIcons.json. Emojis with no sensible illustration (arrows,
// symbols) get none: the reader shows no picture rather than an emoji.
//   npm run icons
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/pictures/icons/', import.meta.url));
const DICT = fileURLToPath(new URL('../src/library/dictionary.json', import.meta.url));
const MAP = fileURLToPath(new URL('../src/library/emojiIcons.json', import.meta.url));
const REPO = 'microsoft/fluentui-emoji';
mkdirSync(OUT, { recursive: true });

// Unicode names that differ from Fluent's folder names.
const ALIAS = {
  'black sun with rays': 'Sun', 'white medium star': 'Star', 'earth globe europe-africa': 'Globe showing Europe-Africa',
  'new moon symbol': 'New moon', 'wind blowing face': 'Wind face', 'wrapped present': 'Wrapped gift', runner: 'Person running',
  swimmer: 'Person swimming', 'weight lifter': 'Person lifting weights', 'snow capped mountain': 'Snow-capped mountain',
  'house buildings': 'Houses', 'house building': 'House', 'frog face': 'Frog', 'waving hand sign': 'Waving hand',
  'thumbs up sign': 'Thumbs up', 'man and woman holding hands': 'Woman and man holding hands', 'older woman': 'Old woman',
  'electric light bulb': 'Light bulb', 'splashing sweat symbol': 'Sweat droplets', 'dash symbol': 'Dashing away',
  'electric torch': 'Flashlight', 'large blue circle': 'Blue circle', 'lower left ballpoint pen': 'Pen', 'lower left crayon': 'Crayon',
  'speaking head in silhouette': 'Speaking head', 'face with no good gesture': 'Person gesturing no',
  'person raising both hands in celebration': 'Raising hands', 'person with folded hands': 'Folded hands', pedestrian: 'Person walking',
  'digit three': 'Keycap 3', 'medium white circle': 'White circle', 'black question mark ornament': 'White question mark',
  'smiling face with open mouth': 'Grinning face with big eyes', 'white smiling face': 'Smiling face', 'heavy black heart': 'Red heart',
  'cloud with rain': 'Cloud with rain', 'spouting whale': 'Spouting whale', 'sailboat': 'Sailboat',
};

/** Badge artwork, by badge id. */
export const BADGE_ART = {
  'first-lesson': 'Seedling', explorer: 'Compass', builder: 'Building construction', sound: 'Headphone', 'reading-star': 'Glowing star',
  'game-champ': 'Trophy', streak7: 'Fire', confident: 'Sports medal', fixer: 'Wrench', glow: 'Light bulb', bookworm: 'Books', speller: 'Crown',
};

const raw = (path) => `https://raw.githubusercontent.com/${REPO}/main/${path.split('/').map(encodeURIComponent).join('/')}`;
async function fetchFluent(name, out) {
  if (existsSync(out)) return true;
  const file = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  for (const path of [`assets/${name}/3D/${file}_3d.png`, `assets/${name}/Default/3D/${file}_3d_default.png`]) {
    const res = await fetch(raw(path));
    if (res.ok) {
      writeFileSync(out, Buffer.from(await res.arrayBuffer()));
      return true;
    }
  }
  return false;
}


const dict = JSON.parse(readFileSync(DICT, 'utf8')).entries;
const names = JSON.parse(readFileSync(new URL('./emoji-names.json', import.meta.url), 'utf8'));
const map = {};
let got = 0;
const missing = [];
for (const emoji of new Set(Object.values(dict).map((e) => e.emoji).filter(Boolean))) {
  const key = [...emoji.replace(/️/g, '')].map((c) => c.codePointAt(0).toString(16)).join('-');
  const uname = names[emoji.replace(/️/g, '')];
  const fluent = uname && (ALIAS[uname] ?? uname[0].toUpperCase() + uname.slice(1));
  if (fluent && await fetchFluent(fluent, join(OUT, `${key}.png`))) {
    map[emoji] = `icons/${key}.png`;
    got++;
  } else missing.push(emoji);
}
for (const [id, name] of Object.entries(BADGE_ART)) {
  if (!(await fetchFluent(name, join(OUT, `badge-${id}.png`)))) missing.push(`badge ${id} (${name})`);
}
writeFileSync(MAP, `${JSON.stringify(map, null, 1)}\n`);
console.log(`${got} word-help icons; missing (shown without a picture): ${missing.join(' ') || 'none'}`);
