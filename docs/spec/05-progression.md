# 05 — Progression and rewards

Rewards in Lumen pay for **effort and practice**, not for being right. A learner who struggles through a whole round must still leave with something, or they won't come back.

## XP

| Event | XP |
|---|---|
| Item correct, first try | 10 |
| Item correct after a hint | 6 |
| Item answered after the reveal (`shown`) | 2 |
| Finishing a round | +10 bonus |
| First round of the day | +5 bonus |

A full round earns between 20 (all revealed) and 60 (all first try) XP.

On Round Complete, XP counts up from 0 to the round total over about 1 second, then flies into the Hub's XP bar.

## Stars (per round)

| First-try correct in the round | Stars |
|---|---|
| 4–5 | 3 |
| 2–3 | 2 |
| 0–1 | 1 |

There is no 0-star result. Each game card on the Hub shows the learner's **best** star count for that game.

## Glow stages (Lumo's growth)

Total XP moves Lumo through five stages. Each stage makes Lumo visibly brighter (halo sizes in `02-mascot-lumo.md`) and unlocks one item.

| Stage | Total XP | Unlocks |
|---|---|---|
| Spark | 0 | Gold glow (default) |
| Glow | 100 | Leaf cap (hat), Mint glow |
| Shine | 300 | Star crown (hat), Sky glow |
| Bright | 600 | Explorer hat, Rose glow |
| Beacon | 1000 | Orbiting sparkles around Lumo |

The thresholds are tuned so a demo profile can cross a stage during judging: a fresh learner reaches Glow after 2 to 4 rounds. Load the demo profile at 280 XP so the next good round triggers the Shine glow-up on stage.

The Hub's XP bar shows progress to the **next** stage only ("Shine · 280 / 300"). It never shows a running total that makes the next step feel far away.

## Glow-up moment

When a round pushes XP over a threshold:

1. Round Complete finishes its XP count-up.
2. The Glow-up modal opens. Lumo plays `glow-up` with the `wow` expression and says "Whoa! I'm glowing brighter! Thank you, {name}!"
3. The new item appears with an **Equip** button and a **Later** button.
4. A soft three-note rising chime plays (see `07-design-system.md`).

## Lumo's closet

- A grid of all hats and glow colors.
- Locked items appear as soft grey silhouettes with "Unlocks at {stage}".
- Tapping an unlocked item equips it, with a live preview on a large Lumo at the top.
- One hat and one glow color are equipped at a time. "No hat" is always an option.

## Daily streak (gentle)

- Count the days on which at least one round was finished.
- **The streak never resets with a message.** If the learner misses days, the number simply starts again quietly. Lumo only ever mentions streaks positively ("3 days in a row! I love it.").
- No streak freezes, no notifications, no guilt. Those mechanics work by creating anxiety, which is the opposite of this app's purpose.

## What is deliberately left out

- **No leaderboards.** Comparing with others punishes the learners who most need practice.
- **No lives or hearts** that run out after mistakes.
- **No penalties** for skipping or quitting a round.
- **No in-app currency or shop.** Unlocks come only from practice.
