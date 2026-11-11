---
name: Quest Academy
description: A cozy, game-like learning clubhouse for 2nd–5th graders, re-skinned by four worlds.
colors:
  space-night: "#0b1033"
  space-violet: "#2a1559"
  space-ink: "#f4f1ff"
  space-muted: "#b9b3e6"
  space-gold: "#ffcb47"
  space-cyan: "#6ee7ff"
  ocean-deep: "#04324f"
  ocean-lagoon: "#0a8ca6"
  ocean-ink: "#f0fbff"
  ocean-muted: "#b5e3ef"
  ocean-sun: "#ffd166"
  ocean-seafoam: "#7af5d6"
  pets-cream: "#fff3e0"
  pets-peach: "#ffd8c2"
  pets-cocoa: "#4a2c1d"
  pets-muted: "#8a6450"
  pets-coral: "#ff8a5b"
  pets-teal: "#4bb3a6"
  bakery-strawberry-milk: "#ffe4f1"
  bakery-lavender: "#e7dcff"
  bakery-plum: "#4b2245"
  bakery-muted: "#8b6086"
  bakery-frosting: "#ff5fa2"
  bakery-grape: "#8f6bff"
  good-mint: "#5ef0a0"
  bad-rose: "#ff7a8a"
  good-leaf: "#2fa86a"
  bad-cherry: "#e0475a"
typography:
  display:
    fontFamily: "Fredoka, ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif"
    fontSize: "clamp(2rem, 6vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(1.4rem, 4vw, 1.9rem)"
    fontWeight: 600
    lineHeight: 1.15
  question:
    fontFamily: "Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 11vw, 4.4rem)"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: "10px"
  md: "16px"
  lg: "22px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.space-gold}"
    textColor: "{colors.space-violet}"
    rounded: "{rounded.pill}"
    padding: "14px 26px"
    typography: "{typography.label}"
  button-ghost:
    textColor: "{colors.space-ink}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
  card:
    rounded: "{rounded.lg}"
    padding: "20px"
  answer-tile:
    rounded: "{rounded.lg}"
    padding: "18px 10px"
    typography: "{typography.headline}"
  subject-tab:
    rounded: "{rounded.pill}"
    padding: "10px 18px"
---

# Design System: Quest Academy

## Overview

**Creative North Star: "The Adventure Clubhouse"**

Quest Academy is a cozy home base that each child decorates by picking a world. The clubhouse itself never changes: same rooms (players, subjects, missions, questions, results, grown-ups page), same chunky rounded type, same soft cards and pill buttons. The world changes the wallpaper, the vocabulary and the treasure: Space is a deep violet night with gold, Ocean a teal lagoon with sunshine yellow, Pet Rescue a warm cream and coral room, Magic Bakery strawberry milk and frosting pink.

It is friendly without being babyish. The older sister should feel this is a real game, not a toddler app, so type is confident and the layout is calm and orderly. Components are **soft and calm**: generous rounding, gentle depth, little bounce. Motion is ambient and slow (twinkling stars, rising bubbles) and switches off under reduced motion. Rewards (confetti, the prize pop, cheers) are the only loud moments, and they are short.

**Key Characteristics:**
- One clubhouse, four wallpapers: every theme is a set of CSS variables on `body[data-theme]`; components only read variables.
- Chunky rounded type (Fredoka) everywhere; big numerals for math.
- Translucent cards over a two-stop gradient sky, with a faint themed particle field behind.
- Large, forgiving touch targets for iPad; full keyboard support for PC.
- Calm by default; celebration is brief and earned.

## Colors

Each world is a dark or light gradient sky, one ink, one muted ink, a warm primary accent and a cool secondary accent, plus shared good/bad feedback colors.

### Primary
- **Space Gold** (space-gold), **Ocean Sun** (ocean-sun), **Pet Coral** (pets-coral), **Bakery Frosting** (bakery-frosting): the `--accent` of each world. Primary buttons, the selected subject tab's border, the "Try me!" tag's outline, the answer box underline, the current typing letter, the toast. Text on it uses `--accent-ink`.

### Secondary
- **Space Cyan**, **Ocean Seafoam**, **Pet Teal**, **Bakery Grape**: the `--accent2`. Progress-bar gradient end, second dot color in math visuals, area rectangles.

### Neutral
- **Sky stops** (`--bg1` → `--bg2`): the full-page 160° gradient. Space and Ocean are dark; Pets and Bakery are light.
- **Ink** (`--ink`) and **Muted ink** (`--muted`): body text and secondary text. Muted must still pass 4.5:1 on the sky and on cards.
- **Card** (`--card`, translucent white) and **Card border** (`--card-border`): every surface sits on these.

### Feedback
- **Good** (good-mint on dark worlds, good-leaf on light) and **Bad** (bad-rose on dark, bad-cherry on light): fills for correct/incorrect states and tricky-fact chips.

### Text-safe variants
- `--good-ink`, `--bad-ink` and `--accent-text` carry the same meanings as text (feedback lines, answer box, mastery bars, spelling input). On dark worlds they equal the fills; on Pets and Bakery they are deeper shades that pass 4.5:1. `--on-bad` is the text color on a `--bad` fill.
- On Pets and Bakery, `--accent-ink` is the world's dark ink, so buttons keep their bright coral/pink with readable dark labels.

**The Text Is Not a Fill Rule.** Never set text in `--good`, `--bad` or `--accent`; use the `-ink`/`-text` variant.

**The Variables Only Rule.** Components never hard-code a world color. A new color is added to all four `body[data-theme]` blocks or not at all.

**The Accent Is a Reward Rule.** The accent marks the one thing to press or the thing you just earned. If three things on a screen are accent-filled, two of them are wrong.

## Typography

**Display / Body Font:** Fredoka (with ui-rounded, Arial Rounded MT Bold, system-ui)

**Character:** One rounded family, weights 400–700, carries everything from the giant math numerals to table labels. It reads friendly at large sizes and stays clear at small ones.

### Hierarchy
- **Display** (700, clamp 2–3rem, 1.15): screen titles (Mission Control, Dive Station).
- **Headline** (600, clamp 1.4–1.9rem): card and section titles, wordy questions.
- **Question** (700, clamp 2.6–4.4rem, tabular numerals): math problems and the answer box.
- **Body** (500, 1.2–1.25rem, 1.4–1.5): passages, fact cards, hints. Passages cap around 65ch.
- **Label** (600, 1–1.15rem): buttons, tabs, chips, form labels.

**The Big Enough Rule.** Nothing a child must read is under 1rem; nothing they must tap is under 44px.

## Layout

A single centered column, max 900px, 16px side gutter (plus safe-area insets). Screens stack vertically with 16px rhythm. Grids use `auto-fill` with a min track (missions 200px, profiles 170px, collectibles 110px, fact cards 220px) so they reflow from phone to desktop without breakpoints. Play screens center the question, then the input (number pad max 380px, answer choices 2-up max 520px). The subject tabs scroll horizontally on narrow screens.

## Elevation & Depth

Depth comes from translucency and a backdrop blur, not from shadows. Cards are flat translucent panels with a 2px border. Pressable things (buttons, pad keys, answer choices, tiles) carry a soft bottom edge that compresses on press, so they read as touchable.

**The Soft Press Rule.** Pressable depth is `--press` (a 3px edge plus a soft 14px blur) that flattens to `--press-active` on `:active`. Keep it subtle; it signals "tap me", it does not shout.

**The Focus Rule.** Keyboard focus is a 3px `--ink` outline with a 3px offset on every control, so it shows in all four worlds.

## Shapes

Generously rounded everywhere: pills (999px) for buttons, tabs and chips; 22px for cards, mission tiles and answer choices; 16–18px for inputs, picks and passage panels; 10px for small inner boxes (place-value cells, keys). Dashed borders mean "empty slot / add something" (new player, sentence builder, missing-number slot, recovery box).

## Components

### Buttons
- **Shape:** full pill (999px).
- **Primary:** accent background, accent-ink text, 600 weight, ~1.2rem, soft bottom edge.
- **Ghost / small:** translucent card fill with a 2px card border; used for Back, Grown-ups, settings and secondary actions.
- **Focus:** a visible accent focus ring for keyboard users.

### Chips
- Pill, translucent card fill, 600 weight. Show points, streak and the sound toggle in the top bar.

### Cards / Containers
- 22px radius, translucent card fill, 2px card border, backdrop blur, 20px padding.

### Inputs / Fields
- 16px radius, 2px card border, translucent fill, 1.4rem text. Spelling input is centered, 2rem, and turns good/bad colored after checking.

### Navigation
- **Subject tabs:** one row. On phones, pills (icon + label) that scroll sideways with a fade at the right edge; from 700px up, six equal tiles with the icon above the label. The selected tab gets an accent border and a light accent tint, not a full accent fill, so the Daily Quest "Go" stays the one accent button.
- **Home footer:** "Switch player" and "Grown-ups" ghost buttons at the bottom of every player's home, so a grown-up can always reach the locked page.
- **Getting-started checklist:** on the "Who's playing" screen until the lock, a player and a first Grown-ups visit are done; only the next step's button is accent-filled. The same guidance lives under Grown-ups → How it works.
- **Top bar:** player button (avatar, name, gear) on the left; points, streak and sound chips on the right.

### Mission tile (signature)
- Card-styled button: big emoji icon, mission name (700), one-line description (muted), mastery label and a slim good-colored progress bar pinned to the bottom. The least-practiced mission gets an outlined "Try me!" tag (accent border, accent-text label).

### Number pad and answer choices (signature)
- 3-column pad of big numeral keys with a soft press edge; the Go key is the only accent-filled key. Multiple choice is a 2-up grid of large tiles that turn good-colored when right and fade with a strike-through when wrong.

## Do's and Don'ts

### Do:
- **Do** read every color from the theme variables, and check new UI in all four worlds (two dark, two light).
- **Do** keep tap targets at least 44px and math numerals big and tabular.
- **Do** keep motion slow and ambient, and honor `prefers-reduced-motion`.
- **Do** keep depth soft: translucent cards and short press edges.

### Don't:
- **Don't** add synthetic text-to-speech or robotic voices; read-aloud and spelling use what exists.
- **Don't** make it feel babyish: no clip-art clutter, no bouncing everything, no tiny-kid baby talk.
- **Don't** let the ambient particles sit on top of, or compete with, text.
- **Don't** fill more than one primary action per screen with the accent.
