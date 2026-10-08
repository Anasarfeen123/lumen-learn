# 01 — Product specification

## Audience

- **Primary:** learners aged roughly 7 to 14 who find reading and spelling hard, including those with dyslexia.
- **Secondary:** parents and teachers who want to know what to practise next.
- **Also works for:** early readers and English learners. The design choices that help dyslexic learners (spoken instructions, big type, no time pressure) help them too.

## Screens

There are 8 screens. Every screen except the grown-up view has Lumo visible somewhere on it.

### 1. Welcome (first visit only)

- Lumo floats in, glowing, and says: "Hi! I'm Lumo. I love words. Want to play?"
- A text field asks: "What should I call you?" The field is optional, with a "Skip" button. Without a name, Lumo says "friend".
- Below it, a choice of Lumo's glow color: Gold (default), Mint, Sky or Rose.
- A big button labeled **Let's go**.
- Shown once. After that, the app opens on the Hub.

### 2. Hub (home)

- Top bar:
  - Lumen logo on the left.
  - XP bar with Lumo's glow stage name on the right, e.g. "Glow · 140 / 300".
  - Settings (gear icon) and Grown-ups (small text link).
- Center left: a large Lumo with a speech bubble that greets the learner by name and suggests a game.
- A **"Lumo noticed"** card showing the latest insight, e.g. "Words with 'ea' are getting easier!"
- **Lumo's path:** a Duolingo-style winding path of round level nodes. The next node gently bounces with Lumo beside it, finished nodes show their stars, and every 5th node is a glow chest. Tapping the next node starts the recommended game. Full spec in `07-design-system.md`.
- Below the path, under "Free play", three large game cards, each showing:
  - an icon and the game name
  - a one-line description
  - the learner's stars for that game
  - a "Recommended" ribbon on the game the adaptive engine picks
- Small link at the bottom: "Lumo's closet" (unlockables).

### 3. Game screen (shared layout for all games)

- **Top row:**
  - Close button (X icon, "Back to hub"). Asks for confirmation only if the round is over half done.
  - A thick rounded progress bar for the 5-item round, plus an XP chip on the right.
  - The game name.
- **Lumo**, small, in the bottom-left corner with a speech bubble. This is where all feedback appears.
- **Center:** the prompt area (picture and/or listen button), then the answer area.
- **Big round Listen button** that replays the current spoken prompt.
- Each game's specifics are in `03-games.md`.

### 4. Round complete

- Lumo cheers.
- 1 to 3 stars. A finished round always earns at least 1 star.
- XP counts up.
- The **"Lumo noticed..."** insight line.
- Buttons:
  - **Next:** goes to the recommended game. Primary button.
  - **Play again**
  - **Hub**

### 5. Glow-up (modal)

- Appears when XP crosses a glow-stage threshold.
- Lumo grows brighter.
- Shows "Lumo reached **Shine**!" and the item just unlocked.
- Has an **Equip** button.

### 6. Lumo's closet

- A grid of unlockables: hats and glow colors.
- Locked items show the stage needed ("Unlocks at Shine").
- Tapping an unlocked item equips it, with a live preview on Lumo.

### 7. Grown-up view

- Behind a press-and-hold gate.
- Full detail is in `06-grown-up-view.md`.

### 8. Settings

| Setting | Options | Default |
|---|---|---|
| Text size | Normal, Large, Extra large | Large |
| Font | Lexend, OpenDyslexic, Atkinson Hyperlegible | Lexend |
| Background | Cream, Soft blue, Soft green, Dark | Cream |
| Voice speed | Slow, Normal | Slow (0.85x) |
| Voice | Dropdown of English voices; prefer on-device voices | First on-device English voice |
| Sound effects | On, Off | On |
| Motion | Full, Reduced | Follows the system setting |
| Reset progress | Button, with a confirmation step | — |

## Navigation map

```
Welcome (first run) -> Hub
Hub -> Game (any of 3) -> Round complete -> [Next game | Play again | Hub]
Round complete -> Glow-up modal (when a stage is reached) -> back to Round complete
Hub -> Lumo's closet -> Hub
Hub -> Settings -> Hub
Hub -> Grown-ups (hold to open) -> Grown-up view -> Hub
```

## Data and storage

There is no backend account. Everything is saved under one browser local-storage key, `lumen.profile.v1`, as JSON:

```json
{
  "name": "Maya",
  "createdAt": "2026-10-08T10:00:00Z",
  "xp": 140,
  "glowColor": "gold",
  "equipped": { "hat": "leaf-cap" },
  "unlocked": ["leaf-cap", "mint"],
  "settings": { "size": "large", "font": "lexend", "theme": "cream", "voiceRate": 0.85, "voiceName": null, "sfx": true, "motion": "system" },
  "gameLevels": { "detective": 2, "sound": 1, "builder": 2 },
  "mastery": { "short": { "m": 0.82, "n": 14 }, "long": { "m": 0.41, "n": 6 } },
  "recentWords": ["ship", "rain", "boat"],
  "history": [
    { "t": "2026-10-08T10:04:11Z", "game": "detective", "word": "because", "level": 2, "result": "hint", "tags": ["irregular", "multi"] }
  ],
  "insights": ["You're doing great with short words. Let's try longer ones!"],
  "streak": { "days": 3, "lastDay": "2026-10-08" },
  "stars": { "detective": 2, "sound": 3, "builder": 1 }
}
```

Storage rules:

- `history` is capped at the most recent 300 entries.
- `result` is one of `first` (correct on the first try), `hint` (correct after a hint), or `shown` (the answer was revealed).
- Wrap every local-storage read and write in try/catch. If storage is unavailable (for example, a private window), the app runs from memory and Settings shows "Progress won't be saved in this browser."
- **Demo safety:** a hidden keyboard shortcut (Shift + D on the Hub) loads a prepared demo profile. That way the progression and insights screens look lived-in during judging.

## Speech

- Use the browser Web Speech API (`speechSynthesis`). It's free and has no network dependency.
- Load voices through `getVoices()` and also the `voiceschanged` event, because voices load asynchronously in Chrome.
- Default rate is 0.85. Word prompts are spoken at 0.8 so each sound is clear.
- Call `speechSynthesis.cancel()` before every new utterance, so rapid taps never queue up speech.
- If speech isn't supported, show a banner: "Your browser can't speak words aloud. Try Chrome or Edge." Sound Match is then disabled with that explanation.
- The first speech must follow a user tap, because browsers block audio before any interaction. That's another reason the Welcome screen leads with a "Let's go" button.

## Privacy line (shown in Settings and on the grown-up view)

"Lumen keeps progress in this browser only. Nothing about your child is sent anywhere, except anonymous practice stats used to write Lumo's tips."

Make sure this line stays true:

- Only send the AI aggregate numbers and tags.
- Never send the learner's name.
- Never send free text the learner typed.
