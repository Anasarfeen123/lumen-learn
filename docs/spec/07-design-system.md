# 07 — Design system

## Visual direction: Duolingo energy, dyslexia-friendly calm

The reference is **Duolingo**: a mascot-led game with chunky, tactile buttons, bold flat color, a clear learning path, and instant, joyful feedback. Lumen takes that energy and adjusts the parts that work against dyslexic readers.

| Take from Duolingo | Change for Lumen | Why |
|---|---|---|
| Chunky "3D" buttons with a darker bottom edge that press down | Keep exactly | Big, obvious, satisfying targets |
| Bold flat colors, thick rounded shapes, no gradients | Keep, but on a cream base instead of pure white | White glare makes text harder for many dyslexic readers |
| A winding learning path of round level nodes on the home screen | Keep as "Lumo's path" (see Hub below) | Shows progress without numbers |
| Feedback sheet that slides up from the bottom after each answer | Keep, but green for correct and **warm amber** for "Almost", never red | Red means failure |
| Progress bar across the top of a lesson | Keep (replaces the 5 dots) | Clear and familiar |
| Hearts / lives, streak-loss pressure, leaderboards | **Drop** | They punish mistakes and absence |
| Heavy, tightly spaced rounded display font | Lexend 600–700 with normal spacing | Same friendliness, far more legible |

Overall feel: **bright, chunky and playful in the chrome; calm and spacious around the words.** The game wraps the reading; it never crowds it.

## Current look: crayon sketchbook (supersedes everything below where they differ)

The team's brand sheets set the final direction. The interface is a **crayon sketchbook**: hand-drawn and warm on the outside, crystal clear where the child reads.

**Paper:**
- Cream #FBF6EC with a dotted grid: `radial-gradient(#E3D6BC 1.3px, transparent 1.5px)`, 24px apart.
- A faint grain overlay: an SVG `feTurbulence` rect, blended with multiply, at about 16% alpha.

**Outlines:**
- 2.5px ink (#2B2C5E) with the hand-drawn border-radius trick:
  - `255px 16px 225px 16px / 16px 225px 16px 255px`
  - mirrored variant: `16px 225px 16px 255px / 255px 16px 225px 16px`
- Alternate the two variants, and tilt cards by about 1 to 2 degrees, so nothing looks machine-made.

**Fills:** crayon hatching, made with two-tone `repeating-linear-gradient(-38deg, …)` in the pastel crayons:
- firefly yellow #FFBE46
- lavender #8E80E3
- sky #78AFE6
- blush #F28CA0
- leaf #2E8B57

**Buttons:**
- Ink outline, a solid offset shadow `5px 6px 0 #2B2C5E`, and Patrick Hand at 28 to 32px.
- Primary is firefly yellow. CHECK and CONTINUE are leaf green. Secondary is white.

**Doodles:**
- Stars, sparkles, hearts, clouds, lollipop trees, arrows, squiggle underlines and a lightbulb.
- Draw them as SVG with a wobble filter: `feTurbulence baseFrequency 0.04` plus `feDisplacementMap scale 3`.
- Sticky notes with tape strips hold tips and stats.

**Fonts:**
- Gaegu 700 for titles and Lumo's big lines.
- Patrick Hand for buttons, notes and labels.
- **Lexend for every word the child reads.**
- Atkinson Hyperlegible for grown-up text.

Learning words are never hand-drawn: decoration can wobble, reading text cannot.

**Lumo artwork:** transparent cutouts from the brand sheets are in `assets/lumo/`.
- Files: `logo-primary.png`, `wordmark.png`, `lumo-hero.png` (large flying Lumo), and `pose-*.png` for float, wave, read, point, think, cheer, fly, sit and sleep.
- **Resolution:** the poses are about 140px, cut from 1536px sheets, so use them at 160px or less. Use `lumo-hero.png` for anything big.
- **Before launch:** export each pose from the original artwork at 512px or larger.
- **Dark backgrounds:** the cutouts were keyed against cream, so the pale wings break up on dark scenes. The canvas uses the vector Lumo there.

**Night mode:** use look B, "chalkboard night", from the Looks board:
- slate #25304A with a faint dot grid
- chalk-white sketch outlines
- Lumo's glow as the light source

The Glow-up screen is built this way.

## Previous look: soft pastel (kept for reference)

After review, the team chose a softer look built from the Lumo character sheet. The full-strength letter jumble looked messy on screen, so it was retired.

| Token | Hex | Use |
|---|---|---|
| Indigo navy | #2B2C5E | Text, primary buttons (bottom edge #17183A), unit banners |
| Firefly yellow | #FFD27A | Lumo's glow, XP, stars, sparkles |
| Warm cream | #FAF5EC | App background |
| Lavender | #B9A9F0, soft #ECE7FC | Insight cards, selected answer card (border #8E80E3) |
| Sky blue | #A9D4FF, soft #E4EEF9 | Pills, decorative blobs |
| Blush pink | #F9C7CF, soft #FCE6EA | Pills, decorative blobs |
| Correct green | #2E8B57 (edge #1F6B40), soft #E3F1E8 | CHECK, CONTINUE, correct states |
| Almost amber | #F2B632 (edge #C98F12), soft #FFF4D6 | TRY AGAIN, hint sheets |

**Fonts:**
- **Fredoka 700:** wordmark, headings, buttons. It's the rounded voice of the "Lumo" logotype.
- **Lexend:** every learning word.
- **Atkinson Hyperlegible:** small interface text.

**Decoration:**
- Large soft pastel circles in the background (solid, no gradients), kept away from text.
- Small yellow four-point sparkles.
- A dotted flight trail: Lumo's path on the Hub is drawn with yellow dots behind the learner and lavender dots ahead.

**The letter motif now lives in chunky pastel letter tiles.** A few tiles (b, d, a, q: the commonly confused letters) float gently near Lumo on the Welcome screen, tilted at most 12°. The idea is the same (letters you will master), with none of the visual noise. Word Builder tiles use the same tile style.

The section below is kept for history and should not be built as written.

## Signature motif: from jumble to clarity (retired, see update above)

The second reference is the "Dyslexia Unveiled" typographic series. These are black-and-white collages of overlapping letters in mixed typefaces: serif and sans, upper and lower case, huge and tiny, rotated at every angle.
- They pile up along the edges of a page.
- They swirl in clusters, or trail along a winding path.
- The center is always left open and empty.

It is a picture of how text can feel to a dyslexic reader. Lumen uses it as a story: **letters start jumbled, and practice sorts them out.** The game's progress is literally the letters settling into order.

### How the motif looks

- **Letters:** mixed faces (Georgia or a serif like Playfair Display for the heavy shapes, Lexend for the light ones), sizes from 10 px to 160 px, rotated randomly within ±60°, heavy overlap.
- **Color:** ink (#1F2933) only, at 6–14% opacity on cream for backgrounds. Up to 100% only in one hero moment (Welcome). The chunky Duolingo colors are kept for things you can tap. The motif is always monochrome and decorative, so the two never compete.
- **Composition:** dense at the edges and corners, thinning toward the middle, with the center empty, exactly like the references. **Never place motif letters behind or near reading text.** The empty middle is where the learning happens.
- **Build it in code, not as an image:** absolutely positioned `<span>` letters generated from a fixed seed. The layout is identical on every load, and it stays crisp at any size. Mark the container `aria-hidden="true"` so screen readers skip it.

### Where it appears

| Place | Treatment |
|---|---|
| Welcome screen | The hero moment. A full-strength jumble frames the screen like the first reference (a rectangle of piled letters with an open center). When the learner presses **Let's go**, the letters tumble inward and settle into the word **Lumen**, then Lumo flies out of the "u". |
| Hub background | Faint jumble piled in the bottom corners (like the second reference), at 6–8% opacity. It gets **tidier as the glow stage rises**: at Spark the letters are heavily rotated and overlapping; at Beacon they sit upright in loose rows. Progress becomes visible in the room itself. |
| Lumo's path | Draw the path like the third reference: a winding trail of scattered letters linking the level nodes. Behind the learner, the trail letters are upright and evenly spaced. Ahead, they are rotated and jumbled. |
| Word Builder tiles | Before the round starts, the tiles fall into the tray rotated and overlapping (a small jumble), then straighten into their tray positions. On a correct answer, the letters snap upright into the slots: jumble to word, in miniature. |
| Round complete | A few letters from the round's words drift down and land in a neat row behind the stars. |
| Grown-up view and Settings | No motif. These screens stay quiet. |

### Motion rules for the motif

- Settling animations last 600–900 ms with a slight overshoot ease, and each letter starts with a random 0–200 ms delay so the pile feels organic.
- After settling, background letters are **still**. No idle drifting near text: constant motion in the reader's side vision is exactly what makes reading harder.
- Under reduced motion, show only the settled end state.

### Generating the jumble (reference)

```js
// Deterministic pseudo-random so the layout is identical on every load
function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

function jumble({ count = 90, seed = 7, tidiness = 0, area = 'frame' }) {
  const r = seeded(seed);
  const letters = 'abcdefghijklmnopqrstuvwxyzABDEGHKMNPQRWZ';
  const faces = ["Georgia, serif", "'Lexend', sans-serif"];
  return Array.from({ length: count }, () => {
    // 'frame': stay in the outer 18% band on any side; center stays empty
    let x = r() * 100, y = r() * 100;
    if (area === 'frame') {
      const side = Math.floor(r() * 4);
      const band = r() * 18;
      if (side === 0) y = band; else if (side === 1) y = 100 - band;
      else if (side === 2) x = band; else x = 100 - band;
    }
    const big = r() < 0.25;
    return {
      ch: letters[Math.floor(r() * letters.length)],
      left: x + '%', top: y + '%',
      size: big ? 80 + r() * 80 : 10 + r() * 40,              // px
      rotate: (r() * 120 - 60) * (1 - tidiness),              // tidiness 0..1 straightens letters
      face: faces[Math.floor(r() * faces.length)],
      opacity: 0.06 + r() * 0.08,
    };
  });
}
// tidiness for the Hub = glowStageIndex / 4  (Spark 0 ... Beacon 1)
```

### Signature components

**Chunky button (primary, secondary, answer cards):**
- background: the color
- `border-bottom: 5px solid` a shade about 20% darker
- radius: 16 px
- Lexend 700, uppercase only for short labels like CHECK and CONTINUE
- On press: move down 4 px and set the bottom border to 1 px, so it looks physically pushed.
- Disabled: #E6DECB with text #8A826F, no bottom edge.

**Answer card (unselected → selected):**
- Unselected: background `--surface-raised`, 2 px border `--line`, 4 px bottom border `--line-dark` (#D3C5A6).
- Selected (before checking): border and bottom border `--primary-mid` (#6A7FE0), background `--primary-soft`.

**Check flow:** the learner selects a card, then presses a big **CHECK** button at the bottom. This is Duolingo's pattern, and it suits dyslexic learners well: a mis-tap costs nothing, because nothing is judged until they choose to check.

**Feedback sheet** (slides up over the bottom 30% of the screen):

| | Correct | Almost |
|---|---|---|
| Background | `--success-soft` | `--try-soft` |
| Heading | "Nice!" or Lumo's line | "Almost!" + hint text |
| Lumo | Cheering, on the left | Thinking, on the left |
| Button | **CONTINUE** (green chunky) | **TRY AGAIN** (amber chunky) |

**Lumo's path (Hub):**
- A vertical winding path of round chunky nodes (72 px), one per round.
- Each node is colored by its game.
- Finished nodes show their stars. The next node bounces gently, with Lumo standing beside it.
- Locked nodes are flat grey.
- Every 5 nodes there is a "glow chest" node, which opens the glow-up.
- The three game cards stay below the path as "Free play".

**Lesson top bar:**
- Close (X) on the left.
- A thick 16 px rounded progress bar filling with `--success`.
- XP chip on the right.

The look is **warm, bright and calm**: a storybook feel without baby colors. Big friendly shapes, one strong accent, a yellow glow that ties everything to Lumo, and lots of space around every word.

## Color tokens

| Token | Hex | Use |
|---|---|---|
| `--bg` | #F6EFDF | App background (cream) |
| `--surface` | #FBF6EA | Cards, game boards |
| `--surface-raised` | #FFFDF7 | Answer cards, tiles |
| `--ink` | #1F2933 | All text |
| `--ink-muted` | #4A5462 | Secondary text (meets contrast on cream) |
| `--line` | #E3D8C1 | Borders |
| `--primary` | #3346A8 | Main buttons, Lumo's body, focus rings |
| `--primary-soft` | #E3E7F7 | Soft fills, selected states |
| `--glow` | #FFE08A | Lumo's glow, highlights, the "this one" reveal |
| `--success` | #23603F | Correct text and icons |
| `--success-soft` | #E3F1E8 | Correct card background |
| `--try` | #9A6A00 | "Almost" text (warm amber, never red) |
| `--try-soft` | #FFF4D6 | Hint card background |
| `--primary-dark` | #24337F | Bottom edge of primary chunky buttons |
| `--primary-mid` | #6A7FE0 | Selected answer card border |
| `--line-dark` | #D3C5A6 | Bottom edge of unselected cards and tiles |
| `--go` | #2E8B57 | CONTINUE / CHECK button fill (white Lexend 700, 18 px+) |
| `--go-dark` | #1F6B40 | Its bottom edge |
| `--amber` | #F2B632 | TRY AGAIN button fill (ink text, not white) |
| `--amber-dark` | #C98F12 | Its bottom edge |

Per-game accents are used on game cards and that game's screen header only:

| Game | Accent | Soft |
|---|---|---|
| Word Detective | #3346A8 (indigo) | #E3E7F7 |
| Sound Match | #C2571F (warm orange) | #FBE6D8 |
| Word Builder | #23603F (green) | #E3F1E8 |

**There is no red anywhere.** Red reads as "wrong" so strongly that even a red-tinted border undoes the "Almost!" message.

Dark theme (Settings): bg #15181D, surface #1E2228, ink #E8E4DA, primary #9DB0FF, glow #E8C25A. Never pure black or pure white.

## Typography

| Role | Font | Size | Notes |
|---|---|---|---|
| Learning words (cards, tiles, prompts) | Lexend 500 | 40–56 px | Letter spacing 0.04em. The most important text in the app. |
| Headings | Lexend 600 | 24–40 px | |
| Lumo's speech bubble | Lexend 500 | 22 px | Line height 1.5, max 12 words |
| Interface text | Atkinson Hyperlegible 400/700 | 16–18 px | Buttons, settings, grown-up view |
| Labels | Atkinson Hyperlegible 700 | 13 px | Uppercase allowed only for short labels |

The "Text size" setting multiplies the learning-word and bubble sizes by 1.0, 1.2 or 1.4. Interface text grows by half as much, so the layout survives.

Learning words are always lowercase unless the word itself needs a capital. Mixed case changes word shape, and word shape is part of what's being practised.

## Shapes and spacing

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64.
- Radius: 12 for buttons, 20 for answer cards and tiles, 28 for large boards and modals, round for Lumo and the Listen button.
- Answer cards: min height 88 px, padding 20 px 28 px, 2 px border in `--line`, soft shadow.
- Letter tiles: 68 by 68 px (minimum 64), radius 18, background `--surface-raised`, a 4 px bottom border one shade darker to make them feel pressable.
- Slots in Word Builder: same size as tiles, dashed 2 px border, filled background on `--surface`.
- The Listen button: 88 px circle in the game's accent, white speaker icon, with a soft pulsing ring while speaking.

## Feedback states

| State | Card or tile | Lumo | Sound |
|---|---|---|---|
| Idle | `--surface-raised`, `--line` border | `happy`, floating | — |
| Pressed | Moves down 2 px, border `--primary` | — | Soft tick |
| Correct | `--success-soft` fill, `--success` border and check icon, scale 1.04 pop | `cheer` + hop | Rising two-note chime |
| Almost (first miss) | Fades to 40% and disables; no shake, no color | `thinking` + wiggle | One soft low note |
| Reveal (second miss) | Correct card gets `--glow` fill and a pulsing glow ring | `encourage` | — |
| Round complete | — | `cheer` | Three-note chime |

## Motion

| Animation | Duration | Easing |
|---|---|---|
| Card or tile press | 80 ms | ease-out |
| Correct pop | 250 ms | cubic-bezier(0.34, 1.56, 0.64, 1) (slight overshoot) |
| Card fade on miss | 300 ms | ease |
| Tile flying to slot | 220 ms | ease-out |
| Screen change | 250 ms cross-fade | ease |
| XP count-up | 1000 ms | ease-out |

**Reduced motion:**
- Every movement becomes an instant state change. Colors and icons still change, so feedback is never lost.
- Lumo stops floating and only swaps expressions.
- Decide with the CSS media query `prefers-reduced-motion`, overridden by the in-app Motion setting.

## Sound effects (no audio files needed)

Synthesize the sounds with the Web Audio API so there are no assets to host and nothing to fail loading:

```js
let ctx;
function tone(freq, start, dur, vol = 0.12) {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.05);
}

const sfx = {
  tick:    () => tone(880, 0, 0.05, 0.05),
  correct: () => { tone(523.25, 0, 0.14); tone(659.25, 0.12, 0.22); },          // C5 then E5
  almost:  () => tone(293.66, 0, 0.25, 0.08),                                   // soft D4
  fanfare: () => { tone(523.25, 0, 0.15); tone(659.25, 0.14, 0.15); tone(783.99, 0.28, 0.35); },
};
// Only call these when the Sound effects setting is on, and only after a user tap.
```

Keep effects quiet (gain 0.05–0.12). They must never drown out the spoken word.

## Icons

- Simple rounded line icons with a 2 px stroke: speaker, close, gear, star, check, lightbulb (hint), arrow.
- No emoji in the interface chrome. Pictures for words may be emoji or simple illustrations (see `08-word-bank.md`).

## Accessibility checklist

- Text contrast is at least 4.5:1 on every surface (`--ink-muted` on `--surface` is the tightest pair; check it after any color change).
- Visible 3 px focus ring in `--primary` on every interactive element.
- Full keyboard play:
  - number keys 1 to 4 pick answer cards
  - letters type into Word Builder slots
  - Space replays the word
  - Escape returns to the hub
- Every icon-only button has an `aria-label`.
- Correct or almost results are announced through an `aria-live="polite"` region, using the same words Lumo says.
- Touch targets at least 64 px in games and 44 px elsewhere.
