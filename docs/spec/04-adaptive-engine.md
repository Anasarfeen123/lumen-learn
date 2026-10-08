# 04 — Adaptive engine

## The idea in one paragraph

Every word in the bank carries **tags** describing what makes it hard (long, look-alike letters, vowel team, tricky spelling, and so on). Every answer updates a **mastery score per tag**. The engine uses those scores for two things: to choose the next words (leaning toward weak tags without drowning the learner in them), and to change each game's **level**. When something meaningful changes, Lumo says what it noticed in one sentence. All of this is plain code, so it is instant, predictable and easy to explain to judges.

## Why the AI doesn't pick difficulty

It's tempting to "let the LLM adapt", but that loses on every axis that matters here:

- **Latency.** An API call between items breaks the rhythm of a 60-second game.
- **Reliability.** A model may invent a misspelling that is actually a real word, or mark a right answer wrong.
- **Explainability.** "Mastery for look-alike letters dropped to 0.38 over 6 answers" is a sentence a parent or judge can check. "The model decided" isn't.

The language model's job is **language**: phrasing insights warmly and writing the grown-up summary. Say this split out loud in the pitch. It shows judges you thought about where AI belongs.

## Tags

Each word has 1 to 4 tags. These plain names are what learners and grown-ups see.

| Tag | Plain name (grown-up view) | Short name (Lumo's lines) | Meaning |
|---|---|---|---|
| `short` | Short words | short words | 3 to 4 letters |
| `medium` | Medium words | medium words | 5 to 6 letters |
| `long` | Long words | long words | 7 or more letters |
| `multi` | Words with more than one beat | words with more beats | 2 or more syllables |
| `irregular` | Tricky words that aren't spelled how they sound | tricky words | e.g. said, friend, because |
| `digraph` | Letter pairs like sh, ch, th, ph | 'sh' and 'ch' words | Two letters, one sound |
| `blend` | Blends like st, fr, gr | blends | Two sounds said quickly together |
| `vowel-team` | Vowel teams like ai, oa, ee, ou | vowel teams | Two vowels making one sound |
| `confusable` | Look-alike letters like b/d and p/q | 'b' and 'd' words | Contains b, d, p, q, m, w, n or u in a way that commonly gets flipped |
| `silent` | Silent letters | silent letters | e.g. the k in knowledge |

## State

Stored in the profile (`01-product-spec.md`):

- `mastery[tag] = { m, n }`, where `m` is 0 to 1 (starts at 0.5 when first seen) and `n` is the number of answers involving that tag.
- `gameLevels[game]`: an integer 1 to 5, starting at 1.
- `recentWords`: the last 8 word ids served, so nothing repeats too soon.
- `sessionStart[tag]`: a snapshot of `m` when the app opened, used to detect improvement.

## 1. Updating mastery after every answer

```
score = 1.0 if result == "first"
        0.5 if result == "hint"
        0.0 if result == "shown"

for each tag on the word:
    m = m + 0.25 * (score - m)      # exponential moving average
    n = n + 1
```

**Why a moving average:** recent answers count most, so the score reflects how the learner is doing *now*. One bad answer moves it a little, not catastrophically. With a rate of 0.25, about four consistent answers move the score most of the way, which is fast enough to show change during a 3-minute demo.

**Response time is never part of the score.** Slow and correct is still correct.

## 2. Changing the level (after each round)

Count the first-try correct answers in the 5-item round:

| First-try correct | Change |
|---|---|
| 4 or 5 | Level up by 1 (max 5) |
| 2 or 3 | Stay |
| 0 or 1 | Level down by 1 (min 1) |

This aims for a success rate of roughly 60 to 80%: hard enough to learn from, easy enough to stay motivating.

**Rescue rule within a round:** if two items in a row end as `shown`, the next item is drawn from one level lower, without changing the stored level. That stops a bad streak from spiraling.

## 3. Choosing words for a round

```
eligible(word, game):
    detective needs >= 2 misspellings
    sound     needs >= 2 soundAlikes
    builder   accepts any word

pool = eligible words where level in {L, L-1}
       minus recentWords, minus words already in this round

weight(word) =
    (word.level == L ? 3 : 1)
    * (1 + 2 * weakness(word))          # weak tags are picked more often

weakness(word) = average over word.tags of (1 - m[tag])   # unseen tags count as m = 0.5
```

**Round composition** (this order is deliberate):

| Item | How it's chosen | Why |
|---|---|---|
| 1 | A "warm-up": the eligible word at level L or L-1 with the **highest** average mastery | Every round starts with a likely success, without dropping back to baby words |
| 2–4 | Weighted random from the pool | Most practice targets weak tags |
| 5 | Another warm-up word | Every round ends on a likely success |

**Exploration:** each of items 2 to 4 has a 15% chance of being picked uniformly at random. Without this, a tag that starts weak may never be retested enough to show improvement.

## 4. "Lumo noticed": producing one insight per round

After each round, look only at tags with `n >= 3` and pick **one** message in this priority order:

| Priority | Condition | Template |
|---|---|---|
| 1 | The game's level went up | "You're doing great with {strongest short name}. Let's try {next challenge}!" |
| 2 | A tag's `m` rose by 0.15 or more since `sessionStart` | "{Short name} are getting easier. I can tell!" |
| 3 | Weakest tag has `m <= 0.45` | "{Short name} are tricky. Let's practise a few more." |
| 4 | Strongest tag has `m >= 0.75` | "You're great at {short name} now!" |
| 5 | Nothing qualifies | "Great practice! Let's keep going." |

`{next challenge}` comes from the level the game just moved to: level 2–3 → "longer words", level 4 → "tricky words", level 5 → "the longest words".

**Recommended next game.** If the level went up this round, "Next" replays the **same game** at its new level, so the learner (and the judges) see the change straight away. Otherwise, map the weakest tag to the game that practises it best, so the "Next" button follows the insight:

| Weakest tag | Recommend |
|---|---|
| `confusable`, `irregular`, `silent` | Word Detective |
| `digraph`, `vowel-team`, `blend` | Sound Match |
| `long`, `multi`, `medium`, `short` | Word Builder |

### Optional: let the AI rephrase insights

Templates are reliable and already warm. If you want AI phrasing, keep the template as the fallback and only accept output that passes validation:

```
System: You write one short, warm sentence for a children's reading game mascot named Lumo.
Rules: at most 14 words. Simple words a 7-year-old can read. Encouraging. No exclamation overload (max one).
Never use: wrong, bad, fail, easy, dyslexia, disorder, test, score, problem.
Do not mention the child's name.

User: Rewrite this message in Lumo's voice, keeping its meaning exactly:
"{template sentence}"
Context (do not repeat numbers): {"tag":"vowel-team","change":"+0.18","level":"2->3"}
```

Validate: 14 words or fewer, no banned word, no digits. Any failure or a response over 2.5 seconds → use the template. Show the template immediately and swap in the AI line only if it arrives in time, so the screen never waits.

## Reference implementation (plain JavaScript)

```js
const RATE = 0.25;
const SCORE = { first: 1, hint: 0.5, shown: 0 };

function updateMastery(profile, word, result) {
  for (const tag of word.tags) {
    const t = profile.mastery[tag] || { m: 0.5, n: 0 };
    t.m = t.m + RATE * (SCORE[result] - t.m);
    t.n += 1;
    profile.mastery[tag] = t;
  }
}

function weakness(profile, word) {
  const ms = word.tags.map((tag) => (profile.mastery[tag] ? profile.mastery[tag].m : 0.5));
  return 1 - ms.reduce((a, b) => a + b, 0) / ms.length;
}

function eligible(word, game) {
  if (game === 'detective') return (word.misspellings || []).length >= 2;
  if (game === 'sound') return (word.soundAlikes || []).length >= 2;
  return true;
}

function weightedPick(items, weightFn) {
  const total = items.reduce((s, it) => s + weightFn(it), 0);
  let r = Math.random() * total;
  for (const it of items) { r -= weightFn(it); if (r <= 0) return it; }
  return items[items.length - 1];
}

function pickRound(profile, bank, game) {
  const L = profile.gameLevels[game] || 1;
  const used = new Set(profile.recentWords);
  const round = [];
  const pool = () => bank.filter((w) =>
    eligible(w, game) && (w.level === L || w.level === L - 1) &&
    !used.has(w.id) && !round.includes(w));

  const warmUp = () => {
    const easy = bank.filter((w) => eligible(w, game) && w.level <= L && w.level >= L - 1 && !used.has(w.id) && !round.includes(w));
    easy.sort((a, b) => weakness(profile, a) - weakness(profile, b));
    return easy[0];
  };

  round.push(warmUp());
  for (let i = 0; i < 3; i++) {
    const p = pool();
    if (!p.length) break;
    round.push(Math.random() < 0.15
      ? p[Math.floor(Math.random() * p.length)]
      : weightedPick(p, (w) => (w.level === L ? 3 : 1) * (1 + 2 * weakness(profile, w))));
  }
  round.push(warmUp());
  return round.filter(Boolean);
}

function levelAfterRound(level, results) {
  const firsts = results.filter((r) => r === 'first').length;
  if (firsts >= 4) return Math.min(5, level + 1);
  if (firsts <= 1) return Math.max(1, level - 1);
  return level;
}
```

The pool can run dry for a game at a high level if the bank is small. In that case `pickRound` returns fewer items, so the round ends early rather than repeating words. With the 32-word bank in `08-word-bank.md` this won't happen in a demo, but add words before going wider.

## Demo script for adaptation

To show adaptation live in about 2 minutes:

1. Load the demo profile (Shift + D on the Hub), which sets Word Builder to level 2 with strong `short` mastery.
2. Play one Word Builder round of short words (hand, frog, boat...) and get 4 or 5 right first try.
3. Round Complete shows the level-up insight ("You're doing great with short words. Let's try longer words!").
4. Press **Next**. The same game reopens at level 3, with visibly longer words such as rabbit, garden and friend.
