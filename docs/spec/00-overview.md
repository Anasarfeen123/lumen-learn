---
name: lumen-learning-game
description: Build, extend or pitch Lumen, an adaptive literacy game for dyslexic learners guided by the mascot Lumo. Use when designing screens, writing game logic, adding words, writing Lumo's lines, or prompting ThinkRoot to build any part of the app.
---

# Lumen: Learn differently

Lumen is a playful, adaptive literacy game designed for learners with dyslexia and enjoyable for everyone. A small glowing firefly called **Lumo** guides the learner through short games (30 to 90 seconds each). Lumen watches which kinds of words are tricky, adjusts what comes next, and explains its reasoning in plain language to the learner and to a parent or teacher.

**Positioning line:** *Designed for dyslexic learners. Enjoyable for everyone.*

**Look:** a crayon sketchbook with Duolingo's game energy:
- dotted cream paper and wobbly ink outlines
- crayon-hatched fills, doodles and taped sticky notes
- Lumo, a cream-yellow firefly with a navy cape, drawn in crayon in 9 poses (transparent PNGs in `assets/lumo/`)
- Lexend for every word the child reads; the decoration wobbles, the words never do

Details are in `references/07-design-system.md` ("Current look") and `references/02-mascot-lumo.md`.

**What Lumen is not:** a dyslexia test, a diagnosis, or a treatment. It is practice. Never claim it "fixes" or "cures" anything, in the app or in the pitch.

## The core loop

```
Hub (Lumo greets) -> pick a game -> 5-item round -> feedback on every item
   -> round complete (stars, XP, "Lumo noticed...") -> next game adapts -> Hub
```

The demo moment is the last arrow. Lumo says what it noticed ("You're doing great with short words. Let's try longer ones!"), and the next round visibly uses longer words. That is what makes the AI claim believable.

## Files in this skill

Read only the files the current task needs.

| File | Read it when you are... |
|---|---|
| `references/01-product-spec.md` | Building screens, navigation, data storage, or anything app-wide |
| `references/02-mascot-lumo.md` | Drawing Lumo, animating it, or writing anything Lumo says |
| `references/03-games.md` | Building or changing Word Detective, Sound Match, Word Builder, or the stretch games |
| `references/04-adaptive-engine.md` | Writing difficulty, word selection, mastery tracking, or "Lumo noticed" insights |
| `references/05-progression.md` | Building XP, stars, glow stages, unlockables, or streaks |
| `references/06-grown-up-view.md` | Building the parent and teacher summary |
| `references/07-design-system.md` | Styling anything: colors, type, tiles, feedback, motion, sound |
| `references/08-word-bank.md` | Adding or editing words, misspellings, sound-alikes, or pictures |
| `references/09-thinkroot-build.md` | Prompting ThinkRoot, planning the 6 hours, or rehearsing the demo |

## Non-negotiable rules

These apply to every screen and every line of copy. Each one exists because breaking it hurts the learners this app is for.

1. **No red crosses, no "Wrong", no buzzers.** Mistakes get "Almost!" plus a hint. Dyslexic learners often arrive with years of being marked wrong. The game has to feel safe before it can teach.
2. **No timers or countdowns.** Speed pressure measures anxiety, not reading. Response time may only ever make the game *easier*, never cost points.
3. **Every instruction is spoken aloud**, and every screen has a replay button. A literacy game that needs reading to understand the rules locks out the people it is for.
4. **One instruction at a time.** Short sentences. Never more than about 12 words in a Lumo speech bubble.
5. **Big targets.** Answer cards and letter tiles are at least 64 by 64 px. Tap to place, not drag-only.
6. **Lexend for all learning text**, left aligned, generous spacing, no italics, cream background rather than pure white.
7. **Respect reduced motion.** Every animation has a still alternative.
8. **Difficulty decisions are deterministic code. The AI only writes words.** The language model phrases Lumo's insights and the grown-up summary. It never decides levels or marks answers, because that must be instant, testable and explainable.
9. **No sign-in.** The profile lives in the browser's local storage. A grown-up gate (press and hold) protects the summary screen.
10. **Never diagnose.** No copy may say or imply the learner has, or does not have, dyslexia.

## Scope for a 6-hour build

Build **three excellent games** (Word Detective, Sound Match, Word Builder), plus Lumo, progression, adaptation and a simple grown-up view. Three polished games beat eight rough ones. Syllable Snap and Sentence Builder are documented as stretch goals only.
