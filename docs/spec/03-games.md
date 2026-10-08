# 03 — Games

All three core games share the same round structure. Each one practises a different part of reading, so together they give the adaptive engine three different views of the same words.

| Game | Skill it practises | Why it matters for dyslexic learners |
|---|---|---|
| Word Detective | Word recognition: knowing what a word should look like | Telling a real spelling from a near miss builds the stored "picture" of a word that fluent readers rely on. |
| Sound Match | Listening: linking a spoken word to its written form | Connecting sounds to letters is the area most dyslexic learners find hardest, so it gets its own practice. |
| Word Builder | Spelling and sequencing: putting letters in order | Building a word letter by letter makes the learner attend to every letter and its position, instead of guessing from the shape. |

## Shared round rules

- **5 items per round.** About 60 to 90 seconds. Short enough to finish, long enough to give the engine 5 data points.
- **The engine picks items** (see `04-adaptive-engine.md`). Never repeat a word within a round.
- **Select, then CHECK.** Tapping a card only selects it (it speaks nothing and judges nothing). The big CHECK button at the bottom submits the answer, and the result arrives in the bottom feedback sheet (`07-design-system.md`). A mis-tap therefore never counts as a mistake. Word Builder enables CHECK once every slot is filled.
- **Every item has up to two tries.**

| What happens | Result recorded | XP | Lumo |
|---|---|---|---|
| Correct on the first try | `first` | 10 | `cheer` + a "Correct, first try" line |
| Miss once, then correct | `hint` | 6 | `thinking` on the miss, then `cheer` |
| Miss twice | `shown` | 2 | `encourage`; the answer is revealed and the learner taps it to continue |

  The learner always taps the correct answer before moving on. Ending every item on a correct action matters more than speed.
- **After each correct answer:**
  - Show the picture and play the word once more ("Ship!").
  - The feedback sheet shows **CONTINUE**. The learner moves on when ready (Enter also works). Nothing advances by itself, so nobody is rushed.
- **The progress bar fills one step per item**, whatever the result. Hinted and shown items still count as progress, never as failure.
- **No timers, ever.**

---

## Game 1: Word Detective

**Prompt:** Lumo says "Find the word that's spelled right." Then it speaks the target word, e.g. "Find: friend".

**Screen:**
- The picture for the word, if it has one (some words, like "because", don't).
- The Listen button.
- 3 or 4 large word cards in Lexend, 40 px or bigger.

**Options:** the correct spelling plus misspellings from the word bank (`misspellings` field).

| Level | Options | Distractor rule |
|---|---|---|
| 1 | 3 | Only "obvious" misspellings: letters swapped or one letter missing. |
| 2 | 3 | Any misspellings from the bank. |
| 3 | 3 | Prefer misspellings that use confusable letters (b/d, p/q, m/w) or vowel swaps. |
| 4 | 4 | As level 3, plus one extra distractor. |
| 5 | 4 | The closest misspellings available, and no picture shown. |

To pick level 1 distractors without hand-tagging each one, prefer misspellings that are anagrams of the word, or that are one letter shorter.

**On the first miss:**
- The chosen card fades to 40% opacity and is disabled. It is not shaken and not colored red.
- In 4-option rounds, one other wrong card is also removed. Either way exactly 2 cards remain: the answer and one distractor. Never remove down to 1 card; that gives the answer away.
- The word is spoken again slowly (rate 0.7), syllable by syllable, using the `syllables` field: "friend" (one syllable); "be... cause".

**On the second miss:** the correct card glows yellow and Lumo says "This one's tricky. Here it is!" The learner taps it.

**Card order is shuffled.** Make sure the correct card isn't in the same position more than twice in a row.

---

## Game 2: Sound Match

**Prompt:** Lumo says "Listen, then tap the word you hear." The target word is spoken automatically after 600 ms and can be replayed as often as the learner wants.

**Screen:**
- A very large Listen button in the center.
- 3 or 4 word cards below it.
- **No picture until the answer is correct.** A picture would let the learner skip the listening, so it appears only as a reward.
- Cards can't be tapped to hear them. If they could, the game would become matching audio to audio, and the skill would disappear.

**Options:** the target plus words from `soundAlikes` (real words that sound close: ship / chip / sheep).

| Level | Options | Rule |
|---|---|---|
| 1 | 3 | Sound-alikes differ in the first sound (ship / chip). |
| 2 | 3 | Any sound-alikes. |
| 3 | 3 | Prefer sound-alikes that differ only in the vowel (ship / sheep). |
| 4–5 | 4 | All sound-alikes, multi-syllable targets allowed. |

**On the first miss:**
- Remove the chosen card (and, in 4-option rounds, one other wrong card), so exactly 2 cards remain.
- Replay the word slowly, with the first sound stretched: speak the first letter group alone, then the whole word ("sh... ship").

**On the second miss:** reveal as in Word Detective.

**If speech isn't supported:** the game card on the Hub shows "Needs a browser that can speak words, such as Chrome or Edge" and can't be opened.

---

## Game 3: Word Builder

**Prompt:** Lumo says "Build the word: rabbit." The Listen button replays it.

**Screen:**
- The picture.
- A row of empty slots, one per tile.
- Below the slots, scrambled tiles. Each tile is at least 64 by 64 px, Lexend 32 px.

**Tiles depend on level:**

| Level | Tiles |
|---|---|
| 1 | Words of 3 to 4 letters, single-letter tiles. Words longer than 5 letters use syllable tiles (but · ter · fly). |
| 2 | Letter tiles for words up to 6 letters; syllable tiles for longer words. |
| 3 | Letter tiles for all words up to 7 letters. |
| 4 | Letter tiles, plus 1 decoy letter (a confusable one: b for d, p for q, extra vowel). |
| 5 | Letter tiles, plus 2 decoys, longer words. |

Syllable tiles exist because asking a struggling reader to order 9 single letters tests working memory, not spelling. Chunks keep the task about the word.

**Interaction:**
- **Tap a tile** to place it in the next empty slot. **Tap a placed tile** to send it back. Dragging is an optional extra, never the only way.
- **When every slot is full, check automatically:**
  - Correct letters in the correct places turn green-tinted and lock.
  - Wrong tiles slide back to the tray, without shaking.
  - Lumo says how many were right: "4 of 6 letters are right! Fix the rest." This partial credit tells the learner exactly where to look.
- **Hint** (after the first wrong check): the tile that belongs in the first unfilled slot glows, and its letter is spoken.
- **Second wrong check:** the word fills itself in slowly, one letter every 300 ms, speaking each letter. Then the learner taps "Got it" to continue.
- **Scoring:** a correct first check = `first`; correct after a hint = `hint`; filled in automatically = `shown`.

**Scrambling:** shuffle until the tile order differs from the answer in at least half the positions. Never present the tiles already in order.

---

## Stretch games (only after the three above are polished)

### Syllable Snap
- A word appears. The learner taps between letters to place a "snap" line splitting it into syllables, then checks.
- Uses the `syllables` field.
- Good for long words, which pairs well with an insight like "Long words are tricky. Let's chop them up!"

### Sentence Builder
- Shows a picture and 4 to 6 word tiles from `08-word-bank.md`'s sentence list. The learner orders them into the sentence, then it's read aloud.
- Same tap-to-place mechanics as Word Builder, with words instead of letters.
