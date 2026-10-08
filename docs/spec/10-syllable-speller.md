# 10 — Syllable Speller (Orton-Gillingham style)

The fourth game, added after the original three. It's modelled on a common Orton-Gillingham activity: the teacher says a multisyllabic word slowly, beat by beat ("va… ca… tion"), and the learner spells it one syllable at a time. They pull letters down from an alphabet into syllable boxes, under rows of words from the same family that they've already spelled.

| Skill it practises | Why it matters for dyslexic learners |
|---|---|
| Breaking long words into syllables and spelling each one | Long words overload working memory when spelled letter by letter. Chunking them into beats, with a shared ending as an anchor (-tion, -ture, -ble), turns one hard word into two or three easy ones. It is a core Orton-Gillingham strategy. |

## Screen

- **Alphabet strip** at the top: all 26 lowercase letters plus a delete key. Keys are at least 64 × 64 px.
- **Example rows**: the two most recent finished words of the same family, shown in syllable boxes with the whole word beside them. A round starts with two worked examples; each word the learner finishes becomes the newest example row.
- **Current row**: a Listen button, then one box per syllable. At levels 1–4 the family ending (-tion, -ture, -ble) is pre-filled and tinted sky blue. The active box has a lavender outline.

## Interaction

- **Tap** a letter to add it to the active box, or **drag** it into any open box. Dragging uses pointer events, so it works with a finger on a touchscreen, a mouse or a pen.
- Tap a box to make it active. The delete key (or Backspace) removes the last letter; on an empty box it moves back one box.
- Keyboard: type letters, `→` / `-` moves to the next box, `←` moves back, Space replays the beats, Enter checks.
- **Check** is enabled once every open box has at least one letter.

## Speech

- On each word: "Spell the word one beat at a time" (first word only), then the word, then each syllable slowly (rate 0.7, with pauses), then the word again.
- Speech engines read syllable fragments badly ("ac" as "A C", "tion" as "tee-on"). Each syllable therefore has a spoken form (`tion` → "shun", `ture` → "cher", `ca` → "kay"…), with per-word overrides in `families.json` (`"say"`) where a vowel is reduced, e.g. sig·*nuh*·ture.

## Feedback

| What happens | Result | Lumo |
|---|---|---|
| Every box right on the first check | `first` | Cheers, then says the beats and the word. |
| First wrong check | — | Right boxes lock green; wrong boxes empty and show dots, one per letter needed. "2 of 3 beats are right! Fix the rest." Then only the wrong beats are replayed slowly. |
| Right after that | `hint` | Cheers. |
| Second wrong check | `shown` | The word fills in beat by beat, letter by letter (600 ms per letter), saying each beat. Then the learner taps **Got it**. |

No red, no shaking, no timers, as in every other game.

## Levels

| Level | Given | Example rows |
|---|---|---|
| 1–4 | The family ending | Yes |
| 5 | Nothing | No |

Word difficulty (2 vs 3–4 syllables, blends, vowel teams) comes from each word's `level` in the family data. A round draws words near the learner's level (L and L-1 first), then orders them easiest first so the round warms up.

## Families

`src/data/families.json`: four families of 9–13 words each.

| Family | Ending given | Examples |
|---|---|---|
| `tion` | tion | na·tion, frac·tion, va·ca·tion, re·ac·tion, e·lec·tion, pop·u·la·tion |
| `ture` | ture | na·ture, pic·ture, ad·ven·ture, fur·ni·ture |
| `ble` | ble | ta·ble, bub·ble, pos·si·ble, com·fort·a·ble |
| `closed` | — | sun·set, nap·kin, bas·ket, fan·tas·tic |

A round sticks to one family, so the shared pattern is visible in every row. The next round picks a different family. Weaker families (by tag mastery) are picked more often.

Checks (run in tests and at load; failing words are skipped and logged): syllables join to the word, at least 2 syllables, the last syllable equals the family ending, one correct length tag, `multi` present, at most 4 tags, `say` (if any) has one entry per syllable.

## Adaptive engine

Family words carry the same tags as the main bank, so answers update the same mastery scores. `multi` ("words with more beats") now recommends Syllable Speller. The grown-up view adds a fourth skill bar: **Breaking words into beats**.
