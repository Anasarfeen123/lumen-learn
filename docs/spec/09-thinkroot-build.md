# 09 — Building it in ThinkRoot

ThinkRoot builds from natural-language prompts, so the strategy is:

1. One strong master prompt for the skeleton.
2. Then one follow-up prompt per feature.
3. Check each feature works before moving on.

Don't paste all nine reference files at once. The generator tends to build everything shallowly when it gets too much in one go.

## Master prompt (paste first)

```
Build a web app called "Lumen" — a playful, adaptive reading game for learners with dyslexia (ages ~7–14), enjoyable for everyone. Tagline: "Learn differently." No sign-in: save all progress as JSON in browser localStorage under key "lumen.profile.v1" (wrap storage in try/catch).

MASCOT: "Lumo", a round, cute firefly: warm cream-yellow body (#FFEBB2), navy-purple cape (#3A347E) with a yellow star clasp (#FFD27A), lavender wings (#D4CCF7), two navy (#2B2C5E) antennae with glowing yellow tips, big dark eyes with a white shine, blush-pink cheeks, a small open smile. Draw Lumo as an inline SVG component with expressions: happy, cheer, thinking, encourage, wow. Lumo appears on every screen with a speech bubble; every line Lumo says is also spoken aloud using the browser speechSynthesis API (rate 0.85, prefer on-device English voices, cancel any speech before starting new speech). Lumo floats gently (disable all motion if prefers-reduced-motion).

SCREENS
1. Welcome (first visit): Lumo says "Hi! I'm Lumo. I love words. Want to play?" Optional name field with Skip, choose Lumo's glow color (gold, mint, sky, rose), big "Let's go" button.
2. Hub: Lumo greeting by name, an XP bar showing progress to the next glow stage, a "Lumo noticed" card with the latest insight, three big game cards (Word Detective, Sound Match, Word Builder) each with best stars and a "Recommended" ribbon on one, links to Settings and "Grown-ups".
3. Game screen (shared): close button, 5 progress dots, big round Listen button that replays the spoken prompt, Lumo small in the bottom-left corner with a speech bubble for all feedback.
4. Round complete: 1–3 stars (never 0), XP count-up, Lumo's insight sentence, buttons Next (recommended game), Play again, Hub.
5. Settings: text size, font (Lexend / OpenDyslexic / Atkinson Hyperlegible), background (cream / soft blue / soft green / dark), voice speed, sound effects on/off, motion full/reduced, reset progress.

STYLE: Duolingo-like energy on a calm, dyslexia-friendly base. Chunky "3D" buttons and answer cards with a darker 5px bottom border that press down 4px when tapped; bold flat colors, no gradients. Warm cream background #F6EFDF (never pure white), cards #FBF6EA, text #1F2933, primary #3346A8 (bottom edge #24337F), Lumo glow #FFE08A, CHECK/CONTINUE buttons green #2E8B57 (edge #1F6B40), TRY AGAIN amber #F2B632 with dark text (edge #C98F12). NO RED ANYWHERE. Lexend 600–700 for all learning text (40–56px on answer cards) and headings, Atkinson Hyperlegible for small interface text. Radius 16–20px, answer cards and tiles at least 64x64px, generous spacing, no italics, left-aligned text.
Games use select-then-CHECK: tapping a card only selects it, a big CHECK button submits, and a feedback sheet slides up from the bottom (green "Nice!" with CONTINUE, or amber "Almost!" with a hint and TRY AGAIN), with Lumo on the sheet. Lesson screens have a thick rounded progress bar at the top. The Hub shows "Lumo's path": a winding vertical path of round chunky level nodes (next node bounces, Lumo stands beside it, finished nodes show stars), with the three game cards below as "Free play". No hearts, no lives, no leaderboards.
CRAYON SKETCHBOOK LOOK (overrides everything else about style): cream paper #FBF6EC with a dotted grid and faint grain; every card, button and tile has a 2.5px ink (#2B2C5E) outline using the hand-drawn border-radius "255px 16px 225px 16px / 16px 225px 16px 255px" and is tilted 1-2 degrees; fills use crayon hatching (repeating-linear-gradient at -38deg in firefly yellow, lavender, sky, blush, leaf green); buttons have a solid offset shadow 5px 6px 0 #2B2C5E; doodled stars, clouds, hearts, squiggle underlines and sticky notes with tape. Fonts: Gaegu 700 for titles, Patrick Hand for buttons and notes, Lexend for every learning word (never hand-drawn), Atkinson Hyperlegible for grown-up text. Use the transparent Lumo PNGs from assets/lumo (pose-float, pose-wave, pose-read, pose-point, pose-think, pose-cheer, pose-fly, pose-sit, pose-sleep, lumo-hero, wordmark): show pose-point with every hint, pose-cheer on correct answers, pose-read when a word is revealed, pose-fly on the map path.
OLDER PASTEL NOTES (ignore where they conflict with the crayon look): soft pastel style matching the Lumo character sheet. Background warm cream #FAF5EC with a few large solid pastel circles (lavender #EEE9FC, yellow #FFF1CC, sky #E4EEF9, blush #FCE6EA) kept away from text. Text and primary buttons indigo navy #2B2C5E (button bottom edge #17183A). Fredoka 700 for the "lumen" wordmark, headings and buttons; Lexend for every learning word; Atkinson Hyperlegible for small interface text. Small yellow four-point sparkles. On the Welcome screen, a few chunky pastel letter tiles (b, d, a, q) float gently near a large Lumo, tilted no more than 12 degrees. Lumo's path on the Hub is a dotted flight trail: yellow dots behind the learner, lavender dots ahead.

RULES: no timers, no "wrong"; a mistake gets "Almost!" and a hint. Every instruction is spoken. Max 12 words per Lumo line.

Start with the Welcome screen, the Hub, Lumo, Settings, and localStorage. I will add the games next.
```

## Follow-up prompts (one at a time, in this order)

**1. Word bank**
```
Add a static word bank file with this exact JSON (do not change it). Use it for all games:
[paste the contents of assets/words.json]
Map each "picture" description to a single emoji in a lookup table; words with picture null show no picture.
```

**2. Word Detective**
```
Build the Word Detective game. A round has 5 words. Lumo says "Find the word that's spelled right," then speaks the target word. Show the word's picture and 3 large word cards: the correct spelling plus 2 entries from its "misspellings" list, shuffled.
First miss: the tapped card fades to 40% and is disabled (with 4 options, also remove one other wrong card; exactly 2 cards must remain), Lumo shows the "thinking" face and says an "Almost!" line, and the word is spoken slowly, syllable by syllable (use the "syllables" field).
Second miss: the correct card glows yellow, Lumo says "This one's tricky. Here it is!", and the learner taps it.
On correct: green tint, the green "Nice!" feedback sheet slides up with Lumo cheering, the word plays again, and CONTINUE moves to the next word.
Record each item's result as "first", "hint" or "shown". Never use red.
```

**3. Sound Match**
```
Build Sound Match with the same round rules. Lumo says "Listen, then tap the word you hear," then speaks the target word automatically. Show a very large Listen button and 3 word cards: the target plus 2 words from "soundAlikes". Cards cannot be tapped to hear them. Do not show the picture until the answer is correct. Hint on first miss: remove the tapped card (with 4 options, also one other wrong card) so exactly 2 cards remain, then speak the word slowly. If speechSynthesis is not available, disable this game with a friendly message.
```

**4. Word Builder**
```
Build Word Builder. Lumo says "Build the word: {word}" and speaks it. Show the picture, a row of empty slots, and scrambled letter tiles (at least 64px, Lexend). At level 1–2, words longer than 5 letters (level 1) or 6 letters (level 2) use syllable tiles from the "syllables" field instead of single letters. Tap a tile to place it in the next slot; tap a placed tile to send it back. When all slots are full, check: correct tiles lock with a green tint, wrong ones slide back, and Lumo says "{n} of {total} letters are right! Fix the rest." Hint after the first wrong check: the tile for the first empty slot glows and its letter is spoken. After a second wrong check, fill the word in slowly letter by letter, then show a "Got it" button.
```

**5. Adaptive engine**
```
Add an adaptive engine in plain JavaScript (no AI calls for this part):
- Each word has tags. Keep mastery per tag: m starts at 0.5. After each answer, for each of the word's tags: m = m + 0.25 * (score - m), where score is 1 for "first", 0.5 for "hint", 0 for "shown". Also count n.
- Each game has a level from 1 to 5 (start 1). After a round: 4–5 first-try correct means level up, 0–1 means level down, otherwise stay.
- Choosing a round's 5 words for a game at level L: item 1 and item 5 are warm-ups (eligible words at level L or L-1 with the highest average tag mastery); items 2–4 are weighted random from words at level L (weight 3) or L-1 (weight 1), multiplied by (1 + 2 * weakness), where weakness = average of (1 - m) over the word's tags. 15% of the time pick uniformly at random instead. Never repeat words from the last 8 served.
- After each round, produce one "Lumo noticed" sentence (only use tags with n >= 3), in this priority: level went up -> "You're doing great with {strongest tag}. Let's try longer words!"; a tag improved by 0.15+ this session -> "{tag} are getting easier. I can tell!"; weakest tag m <= 0.45 -> "{tag} are tricky. Let's practise a few more."; strongest tag m >= 0.75 -> "You're great at {tag} now!"; otherwise "Great practice! Let's keep going."
- Recommended next game: if the level went up, the same game; otherwise based on the weakest tag (confusable/irregular/silent -> Word Detective; digraph/vowel-team/blend -> Sound Match; length tags -> Word Builder).
Tag display names: short words, medium words, long words, words with more beats, tricky words, 'sh' and 'ch' words, blends, vowel teams, 'b' and 'd' words, silent letters.
```

**6. Progression**
```
Add XP and glow stages. XP: +10 first try, +6 after hint, +2 after reveal, +10 for finishing a round. Stars per round: 4–5 first-try = 3 stars, 2–3 = 2, 0–1 = 1. Glow stages by total XP: Spark 0, Glow 100, Shine 300, Bright 600, Beacon 1000. Lumo's halo grows brighter at each stage. Crossing a stage opens a "Glow-up" modal: Lumo shows the "wow" face and says "Whoa! I'm glowing brighter!", and unlocks an item (Glow: leaf cap + mint glow; Shine: star crown + sky glow; Bright: explorer hat + rose glow; Beacon: sparkles). Add "Lumo's closet" to equip unlocked hats and glow colors. Add soft sound effects with the Web Audio API (rising two-note chime on correct, a soft low note on "Almost", a three-note fanfare on round complete), respecting the sound setting.
```

**7. Grown-up view**
```
Add a "Grown-ups" screen behind a press-and-hold (3 seconds) button with a filling ring. Show: minutes and rounds this week; "Getting stronger" (tags whose mastery rose 0.10+, with n >= 5); "Still tricky" (up to 3 lowest tags with n >= 5, each with an example missed word); "Suggested practice" with a Start button for the recommended game; three skill bars labeled "Getting started" / "Growing" / "Confident" (no percentages): Word recognition (irregular, confusable, silent), Listening for sounds (digraph, vowel-team, blend), Spelling and order (length tags). Add a short AI-written "This week in brief" paragraph generated from these aggregate stats only (never the child's name), with a template fallback. Footer: "Lumen is a practice game, not a test or a diagnosis."
```

**8. Demo profile**
```
Add a hidden shortcut: pressing Shift+D on the Hub loads a demo profile: name "Maya", 280 XP (Glow stage), Word Builder at level 2 and the other games at level 2, mastery: short 0.85 (n 14), digraph 0.78 (n 8), vowel-team 0.55 (n 6), confusable 0.38 (n 9), long 0.42 (n 5), irregular 0.44 (n 6), blend 0.7 (n 5), plus about 40 history entries spread over the last 5 days, and the insight "'b' and 'd' words are tricky. Let's practise a few more."
```

## Hour-by-hour plan (6 hours)

| Time | Goal | Done when |
|---|---|---|
| 0:00–0:45 | Master prompt: Welcome, Hub, Lumo, Settings | Lumo speaks and the profile survives a refresh |
| 0:45–1:00 | Word bank | Words load; pictures show |
| 1:00–2:15 | Word Detective, polished end to end | A full round plays with hints, reveal, and round complete |
| 2:15–3:00 | Sound Match | Plays a full round on the demo laptop's browser |
| 3:00–4:00 | Word Builder | Tiles, checks, partial credit, syllable tiles |
| 4:00–4:45 | Adaptive engine + insights | A strong round levels up and "Next" shows longer words |
| 4:45–5:15 | Progression, glow-up, sounds | Crossing 300 XP triggers the Shine glow-up |
| 5:15–5:35 | Grown-up view + demo profile | Shift+D fills every screen with believable data |
| 5:35–6:00 | Freeze features. Rehearse the demo twice. | Two clean run-throughs |

If you are behind at 3:00, cut Sound Match to a basic version and protect the adaptive engine. Adaptation is the story. A third game is a bonus.

## Demo script (about 3 minutes)

1. **The problem (15 s).** "Reading practice usually means tests, red crosses and timers. For a dyslexic learner, that teaches them they're bad at reading before it teaches them to read."
2. **Meet Lumo (20 s).** Open the app with the demo profile. Lumo greets Maya by name, and the speech bubble is read aloud.
3. **Play Word Builder (40 s).** Build hand, frog, boat. Make one deliberate mistake: show "3 of 4 letters are right!", the glowing hint tile, and no red anywhere.
4. **The adaptation moment (30 s).** Round complete shows "You're doing great with short words. Let's try longer words!" Press Next: rabbit and garden appear. "Nothing was scripted there. The engine tracks mastery per word feature and moved her up a level."
5. **Glow-up (15 s).** XP crosses 300, Lumo grows brighter and unlocks the star crown.
6. **Grown-up view (40 s).** Hold to open. Show the AI summary, "Still tricky: look-alike letters like b and d", and "Try Word Detective". "The AI writes the words for parents. The decisions are transparent code they can trust."
7. **Close (20 s).** "Lumen: designed for dyslexic learners, enjoyable for everyone. Practice that feels like play, and adapts like a tutor."

## Questions judges are likely to ask

**"Where's the AI?"**
In two places, each chosen on purpose:
- The adaptive engine models the learner's mastery per word feature. It's deterministic, so it's instant and explainable.
- The language model turns those stats into warm, plain-language guidance for learners and parents.

We kept the language model away from marking answers, because a wrong mark is the one error we can't afford.

**"Does this treat dyslexia?"**
No. It's practice that's designed around how dyslexic learners experience reading: spoken instructions, no time pressure, big clear type, and hints instead of failure. It doesn't diagnose or treat anything, and the grown-up view says so.

**"Why these three games?"**
Each one practises a different link between how a word looks, how it sounds and how it's spelled. That also gives the engine three views of the same word features.

**"What would you build next?"**
- More words, reviewed by a literacy specialist.
- Syllable Snap and Sentence Builder.
- A teacher view covering a whole class.
- Testing with real learners to tune the level thresholds.
