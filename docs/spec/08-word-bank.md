# 08 — Word bank

The full bank is in `assets/words.json`: 32 words across 5 levels, every entry checked by script. Ship it as a static file inside the app. Don't generate game content live with the AI during play (the reasons are at the end of this file).

## Fields

| Field | Type | Used by | Rule |
|---|---|---|---|
| `id` | string | Everything | Unique; usually the word itself |
| `word` | string | Everything | Lowercase unless it needs a capital |
| `level` | 1–5 | Adaptive engine | See level guide below |
| `syllables` | string[] | Hints, Word Builder syllable tiles, Syllable Snap | Joined together, must equal `word` exactly |
| `tags` | string[] (1–4) | Adaptive engine | Exactly one length tag (`short` ≤ 4 letters, `medium` 5–6, `long` ≥ 7); `multi` if and only if 2 or more syllables |
| `picture` | string or null | Word Detective, Word Builder, Sound Match reward | A plain description of the image (e.g. "rain cloud"). Render it as an emoji or simple illustration. `null` for abstract words. |
| `misspellings` | string[] (≥ 3) | Word Detective | Must **not** be real words. The first two should be "obvious" (letters swapped or one letter missing) so level 1 has easy distractors. |
| `soundAlikes` | string[] (≥ 3) | Sound Match | Must **be** real, common words that sound close to the target. Never homophones (sun / son): if they sound identical, the game is unfair. |

## Words by level

| Level | Words | What makes the level |
|---|---|---|
| 1 | cat, bed, dog, sun, pig, ship, fish | 3–4 letters, regular spelling, one sound per letter (plus sh) |
| 2 | hand, frog, star, boat, rain, moon, duck | Blends and vowel teams appear |
| 3 | queen, friend, because, said, house, rabbit, garden | First tricky (irregular) words, first two-syllable words |
| 4 | people, animal, elephant, beautiful, butterfly | Long, multi-syllable, more irregular spelling |
| 5 | thought, different, important, dinosaur, adventure, knowledge | Longest words, silent letters, abstract meanings |

Coverage by tag (so the engine always has material to adapt with):

| Tag | Count |
|---|---|
| confusable | 18 |
| short | 15 |
| multi | 13 |
| long | 10 |
| vowel-team | 7 |
| medium | 7 |
| irregular | 7 |
| digraph | 5 |
| blend | 4 |
| silent | 1 |

`silent` has only one word. Add a few (knight, write, lamb, island) before showing silent letters as a strong pattern in the grown-up view.

## Picture mapping

`picture` is a description, not a file. In a 6-hour build, map each description to one emoji in a small lookup table in the code. That's fast, needs no network, and always loads.

For a more polished look later, swap in simple flat illustrations with the same keys.

Words with `picture: null` show only the Listen button.

## Sentences (for the Sentence Builder stretch game)

Each sentence uses only words from the bank or very common words:

1. The frog can jump.
2. A duck is in the rain.
3. My friend has a red boat.
4. We saw a big elephant.
5. The moon is bright tonight.
6. A butterfly sat in the garden.

## Adding words

1. Write the entry by hand, or use the AI prompt below to draft it.
2. Run the checks (below).
3. Have a person read every misspelling and sound-alike once. Ten seconds per word catches the cases a script can't, like a misspelling that is a real word you didn't think of.

### Checks (run in code at app start, or as a script)

- `syllables.join('') === word`
- Exactly one length tag, matching the letter count
- `multi` present if and only if `syllables.length > 1`
- No misspelling equals the word, and none appears in `soundAlikes`
- At least 3 misspellings and 3 sound-alikes
- At most 4 tags

Words that fail are skipped (and logged in the console), never shown.

### AI drafting prompt (offline use, not during play)

```
You create entries for a children's reading game word bank.
For the word "{word}", return ONLY JSON with these fields:
- syllables: array of syllables that join to exactly the word
- misspellings: 3 NON-words a learning reader might write. The first two should be "obvious": two letters swapped, or one letter missing. The third should involve a common confusion (b/d, p/q, a vowel swap, or a missing silent letter).
- soundAlikes: 3 REAL common words that sound similar but are NOT homophones.
- picture: a short description of a simple picture for the word, or null if abstract.
Do not include tags or level; a person assigns those.
```

## Why content isn't generated live

**Correctness.** A model can produce a misspelling that is actually a real word, or a "sound-alike" that is a homophone. Either one punishes a learner for being right, which is the worst possible error in this app.

**Speed and reliability.** A static bank loads instantly and works offline, with no API latency between items. That matters a great deal during a live demo.

**Quality control.** Every word gets a person's review once, rather than trusting each generated item blind. Generating offline and checking keeps the AI's speed without its risk.
