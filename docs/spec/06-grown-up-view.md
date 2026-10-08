# 06 — Grown-up view (parents and teachers)

The grown-up view answers three questions in plain language:

1. What is getting easier?
2. What is still tricky?
3. What should we practise next?

It is the most persuasive screen for judges, because it shows the adaptive data turning into useful advice.

## The gate

- On the Hub, a small "Grown-ups" link opens a panel: "Press and hold for 3 seconds."
- A ring fills around the button as it's held. Releasing early resets the ring.
- This isn't security. It just keeps a young learner from wandering in by accident, without needing accounts. Say so if anyone asks.

## Layout (one scrolling page, no Lumo animation)

### 1. Header
- "{Name}'s practice". Use "Your learner's practice" if no name was given.
- Two quick numbers:
  - Minutes practised this week
  - Rounds finished this week

### 2. AI summary paragraph

Three or four sentences written by the language model from the stats JSON, shown in a soft card titled **"This week in brief"**. For example:

> Maya practised for 24 minutes across 9 rounds this week. She is reading short words and words with 'sh' and 'ch' confidently. Look-alike letters, especially b and d, are still tricky. A few minutes of Word Detective will help most.

### 3. Getting stronger
- Tags whose mastery rose by 0.10 or more this week, with `n >= 5`.
- Each row shows the plain tag name, a filled bar for the current `m`, and a small upward arrow.

### 4. Still tricky
- Up to 3 tags with the lowest `m`, again with `n >= 5`.
- Each shows its bar plus an example word the learner missed ("e.g. because").

### 5. Suggested practice
- One concrete suggestion, built from the weakest tag using the same tag-to-game map as `04-adaptive-engine.md`.
- For example: "Try 3 minutes of Word Detective. It focuses on look-alike letters."
- A **Start this game** button that hands the device back to the learner.

### 6. Skill overview
Three bars, one per game skill, each the average mastery of the tags that game practises most:

| Skill (bar label) | Average of tags |
|---|---|
| Word recognition | `irregular`, `confusable`, `silent` |
| Listening for sounds | `digraph`, `vowel-team`, `blend` |
| Spelling and order | `short`, `medium`, `long`, `multi` |

Bars show words, not percentages: "Getting started" (below 0.4), "Growing" (0.4–0.7), "Confident" (above 0.7). Percentages invite the "73%, is that bad?" reaction the design is trying to avoid.

### 7. Footer note (always shown)

> Lumen is a practice game, not a test or a diagnosis. If you have concerns about reading, talk to your child's teacher or a specialist.

### 8. Privacy line
The privacy line from `01-product-spec.md`, plus a "Reset progress" button with a confirmation step.

## Rules

- Hide any section whose data has `n < 5`, and show "Lumo needs a few more rounds to spot patterns here." Five answers is the minimum before a pattern means anything. Claims made on less are noise dressed up as insight.
- No grades, no percentages, no comparisons with other children or "expected for age".

## AI summary prompt

Send only aggregates. Never send the learner's name: insert it into the text afterwards by replacing `{name}`.

```
System: You write a short weekly summary for a parent or teacher about a child's practice in a reading game.
Rules:
- 3 or 4 sentences, plain English, warm and specific.
- Start with what went well. Then one thing that is still tricky. End with one practical suggestion that names a game.
- Use "{name}" for the child and "she/he/they" only if pronoun is given; otherwise keep using "{name}".
- Never use: dyslexia, disorder, diagnosis, behind, below average, fail, struggle, score, percent.
- Only state facts present in the data. Do not invent numbers.

User: {stats JSON}
```

Example stats JSON:

```json
{
  "pronoun": null,
  "minutesThisWeek": 24,
  "roundsThisWeek": 9,
  "games": { "detective": 4, "sound": 3, "builder": 2 },
  "stronger": [{ "tag": "short", "plain": "short words" }, { "tag": "digraph", "plain": "letter pairs like sh and ch" }],
  "tricky": [{ "tag": "confusable", "plain": "look-alike letters like b and d", "example": "because" }],
  "suggestedGame": "Word Detective"
}
```

**Validate the reply:**
- 5 sentences or fewer
- no banned words
- every number in the reply appears in the JSON

If validation fails or the call takes over 4 seconds, use this template instead:

> {name} practised for {minutes} minutes across {rounds} rounds this week. {stronger[0].plain} are going well. {tricky[0].plain} are still tricky. Try a few minutes of {suggestedGame}.
