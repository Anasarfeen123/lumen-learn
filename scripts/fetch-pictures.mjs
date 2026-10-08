// Downloads the Fluent 3D illustration for every word picture into
// public/pictures/ (Microsoft fluentui-emoji, MIT licence). Run once after
// adding words: `npm run pictures`. Existing files are kept.
import { createServer } from 'vite';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/pictures/', import.meta.url));
const REPO = 'microsoft/fluentui-emoji';
mkdirSync(OUT, { recursive: true });

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
let PICTURES, pictureSlug;
try {
  ({ PICTURES, pictureSlug } = await vite.ssrLoadModule('/src/data/pictures.ts'));
} finally {
  await vite.close();
}

// Fluent's file layout is predictable, so no API call (or token) is needed:
//   assets/<Name>/3D/<name>_3d.png, or for skin tones assets/<Name>/Default/3D/<name>_3d_default.png
const raw = (path) => `https://raw.githubusercontent.com/${REPO}/main/${path.split('/').map(encodeURIComponent).join('/')}`;
function candidates(name) {
  const file = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return [`assets/${name}/3D/${file}_3d.png`, `assets/${name}/Default/3D/${file}_3d_default.png`];
}

let fetched = 0;
const missing = [];
for (const [description, info] of Object.entries(PICTURES)) {
  const out = join(OUT, `${pictureSlug(description)}.png`);
  if (existsSync(out)) continue;
  let res = null;
  for (const path of candidates(info.fluent)) {
    res = await fetch(raw(path));
    if (res.ok) break;
  }
  if (!res?.ok) { missing.push(`${description} (${info.fluent})`); continue; }
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  fetched++;
}

writeFileSync(join(OUT, 'NOTICE.md'), `# Word pictures

The pictures in this folder are Fluent Emoji 3D illustrations by Microsoft,
from https://github.com/${REPO}, used under the MIT License:

Copyright (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`);
console.log(`Downloaded ${fetched} pictures into public/pictures/.`);
if (missing.length) {
  console.log(`Missing (the emoji is shown instead): ${missing.join(', ')}`);
  process.exitCode = 1;
}
