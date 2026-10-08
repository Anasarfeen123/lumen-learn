# 02 — Lumo, the mascot

## Who Lumo is

Lumo is a small, round firefly whose belly glows. Lumo lives inside Lumen and gets brighter as the learner practises, which is the visual metaphor for the whole product: reading lights up bit by bit.

| Trait | How it shows |
|---|---|
| Warm | Always on the learner's side. Celebrates effort, not only results. |
| Curious | Loves odd words. "Ooh, 'knowledge' has a silent k. Sneaky!" |
| Patient | Never hurries the learner. Never sighs, never says "come on". |
| A little silly | Light jokes about words, never about the learner. |
| Honest | Doesn't pretend a wrong answer was right. Says "Almost" and helps. |

**What Lumo never does:**
- uses sarcasm
- says "wrong", "bad", "fail" or "easy" (calling something easy makes a struggling learner feel worse)
- compares the learner with other people
- mentions dyslexia
- uses guilt ("You haven't played in 3 days!")

## Artwork and poses (current)

Lumo is drawn in crayon. The team's brand sheet supplies 9 poses, cut out as transparent PNGs in `assets/lumo/`.

| Pose | File | Use it when |
|---|---|---|
| Floating | pose-float.png | Default, Hub, idle |
| Waving | pose-wave.png | Welcome, saying hello |
| Reading | pose-read.png | A word is revealed, the learner is focused |
| Pointing | pose-point.png | Giving a hint |
| Thinking | pose-think.png | Curious, a tricky word |
| Cheering | pose-cheer.png | Correct answer, round complete |
| Flying | pose-fly.png / lumo-hero.png | On the map path, moving on, large hero spots |
| Sitting | pose-sit.png | Resting, grown-up view |
| Sleeping | pose-sleep.png | No input for 60 seconds |

The live vector Lumo on the canvas (`Lumo.dc.html`, with `art` set to false) covers what the PNGs can't:
- expression changes
- glow stages
- hats
- dark scenes

## Visual design (earlier vector reference)

- **Body:** a round warm cream-yellow body (#FFEBB2 with a #F0CF7A outline) and small feet.
- **Cape:** a navy-purple cape (#3A347E) fastened with a yellow star clasp (#FFD27A).
- **Wings:** lavender (#D4CCF7).
- **Antennae:** two navy (#2B2C5E) antennae with glowing round tips.
- **Face:** big dark eyes with a white shine, blush-pink cheeks (#F9B4C0), and a small open smile with a pink tongue.
- **Personality tags from the sheet:** Friendly, Encouraging, Curious, Playful, Supportive.
- **Glow color:** the learner's choice (firefly yellow, mint, sky, blush). It tints the antenna tips and the halo.
- **Accessories** (unlocked by glow stage): explorer hat, scholar glasses, star crown.
- **Expressions in the build:** happy, cheer, thinking (with "?"), encourage (wink), surprised (with "!"), oops (worried, small sweat drop), sleepy (with "z").

The canonical drawing is the `Lumo.dc.html` component on the design canvas. Copy its SVG into the app as a component with `expr`, `size`, `glow`, `stage` and `hat` props. The older indigo-body SVG below is kept only as a structural reference for how expressions swap eyes and mouths. **Use the canvas version for the look.**

```html
<svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="Lumo the firefly">
  <!-- halo: size and opacity grow with glow stage -->
  <circle class="lumo-halo" cx="80" cy="90" r="66" fill="var(--glow, #FFE08A)" opacity="0.30"/>
  <!-- wings -->
  <ellipse cx="40" cy="74" rx="17" ry="27" fill="#E3E7F7" opacity="0.9" transform="rotate(-24 40 74)"/>
  <ellipse cx="120" cy="74" rx="17" ry="27" fill="#E3E7F7" opacity="0.9" transform="rotate(24 120 74)"/>
  <!-- antennae -->
  <path d="M66 54 Q60 32 48 26" stroke="#1F2933" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M94 54 Q100 32 112 26" stroke="#1F2933" stroke-width="4" fill="none" stroke-linecap="round"/>
  <circle cx="47" cy="25" r="7" fill="var(--glow, #FFE08A)"/>
  <circle cx="113" cy="25" r="7" fill="var(--glow, #FFE08A)"/>
  <!-- body and glowing belly -->
  <ellipse cx="80" cy="94" rx="45" ry="43" fill="#3346A8"/>
  <ellipse cx="80" cy="108" rx="28" ry="23" fill="var(--glow, #FFE08A)"/>
  <!-- cheeks -->
  <circle cx="54" cy="98" r="5.5" fill="#F5A26B" opacity="0.75"/>
  <circle cx="106" cy="98" r="5.5" fill="#F5A26B" opacity="0.75"/>
  <!-- EYES and MOUTH: swapped per expression (see table) -->
  <g class="lumo-eyes">
    <ellipse cx="66" cy="82" rx="8.5" ry="10.5" fill="#FFFFFF"/><circle cx="67" cy="84" r="5" fill="#1F2933"/>
    <ellipse cx="94" cy="82" rx="8.5" ry="10.5" fill="#FFFFFF"/><circle cx="95" cy="84" r="5" fill="#1F2933"/>
  </g>
  <path class="lumo-mouth" d="M71 99 Q80 108 89 99" stroke="#1F2933" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <!-- optional hat slot: draw equipped hat in a <g> positioned around (80, 50) -->
</svg>
```

Colors for the four glow choices: gold `#FFE08A`, mint `#9FE3C1`, sky `#A9D4FF`, rose `#FFB8C8`.

### Expressions

| Expression | When | Eyes | Mouth |
|---|---|---|---|
| `happy` | Default, idle, hub | Default ovals with pupils | `M71 99 Q80 108 89 99` (smile) |
| `cheer` | Correct answer, round complete | Happy arcs: `M59 84 Q66 76 73 84` and `M87 84 Q94 76 101 84`, stroke #1F2933 width 3.5, no fill | Open grin, filled #1F2933: `M69 97 Q80 114 91 97 Z` |
| `thinking` | After a miss, while a hint shows | Pupils shifted up-right: pupil centers (69, 80) and (97, 80) | Small side smile: `M74 101 Q81 104 88 99` |
| `encourage` | Second miss, answer being shown | Default eyes | Soft smile, wider: `M68 99 Q80 106 92 99` |
| `wow` | Glow-up, new unlock | Bigger whites (rx 10, ry 12) | Small "o": circle cx 80 cy 102 r 5, fill #1F2933 |
| `sleepy` | Learner idle for 60 seconds | Closed lines: `M59 84 Q66 88 73 84` and `M87 84 Q94 88 101 84` | Small smile |

### Animation

All animation is CSS on the SVG wrapper. Under `prefers-reduced-motion: reduce` (or the Motion setting set to Reduced), only the expression swap happens. Nothing moves.

| Name | What it does | Duration |
|---|---|---|
| `float` | translateY 0 to -6px and back, ease-in-out, infinite | 3.2 s |
| `glow-pulse` | Halo opacity 0.25 to 0.45 and back, infinite | 2.4 s |
| `cheer-hop` | translateY -18px with a slight scale 1.08, then settle | 0.5 s, once |
| `wiggle` | rotate -4deg to 4deg twice (used for "thinking") | 0.6 s, once |
| `glow-up` | Halo scale 1 to 1.6 and back, belly brightens | 1.2 s, once |

### Growth stages (see `05-progression.md`)

The halo grows with the glow stage, so progress is visible without reading any numbers:

| Stage | Halo radius | Halo opacity |
|---|---|---|
| Spark | 54 | 0.18 |
| Glow | 60 | 0.26 |
| Shine | 66 | 0.32 |
| Bright | 72 | 0.40 |
| Beacon | 78 | 0.48, plus small orbiting sparkles |

## How Lumo speaks

- **The speech bubble and the voice match exactly.** Every line is shown and spoken.
- **Maximum 12 words per line.** If you need more, use two separate bubbles, the second appearing after the first finishes speaking.
- **Every line is in plain words**, with no idioms that rely on spelling jokes the learner can't decode.
- **The learner's name** appears at most once per screen.
- **Lines rotate.** Pick at random from the list for each event, but never the same line twice in a row.

## Line library

Use these as written; add more in the same voice. `{name}` is the learner's name or "friend".

### Welcome and hub
- Hi, {name}! Ready to play with words?
- Welcome back, {name}! I missed you.
- Let's light up some words today!
- I picked a game I think you'll like.

### Starting a game
- Word Detective: Find the word that's spelled right.
- Sound Match: Listen, then tap the word you hear.
- Word Builder: Put the letters in order to build the word.

### Correct, first try
- Yes! You got it!
- Brilliant reading!
- That's the one!
- You spotted it!
- Look at that, perfect!

### Correct after a hint
- You did it! Hints are there to help.
- Got it! Great thinking.
- Yes! You worked that out.

### First miss (show hint)
- Almost! Let's look again.
- So close! Here's a clue.
- Nearly! Try listening one more time.
- Good try! Let's look at it another way.

### Second miss (answer shown)
- This one's tricky. Here it is!
- Let's learn this one together. Tap it!
- Tricky word! You'll see it again soon.

### Streaks within a round (3 first-try correct in a row)
- You're on a roll!
- Three in a row! You're glowing!

### Round complete
- What a round! Look how bright I'm getting.
- You worked really hard. I'm proud of you!
- Round done! Want to keep going?

### Glow-up
- Whoa! I'm glowing brighter! Thank you, {name}!
- I reached {stage}! You unlocked something new.

### "Lumo noticed" insights (templates; see `04-adaptive-engine.md`)
- You're doing great with short words. Let's try longer ones!
- You're great at words with 'sh' and 'ch' now!
- 'b' and 'd' words are tricky. Let's practise a few more.
- Long words are getting easier. I can tell!

### Coming back after a break
- You're back! Let's warm up with a fun one.

Never mention how long the learner was away.

### Idle (60 seconds, no input)
- Take your time. I'll be right here.
