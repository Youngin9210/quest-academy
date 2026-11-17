# First-run experience — design

Date: 2026-11-17. Status: approved in conversation, pending spec review.

## Goal

A parent who has never seen Quest Academy (usually arriving through an invite link) should understand in a few seconds what it is, get their family set up in a short guided flow, and hand the iPad to their kids. Kids playing for the first time should get a short, friendly welcome. The kids' "Who's playing?" screen should be for kids only.

Today the first screen mixes a 4-step grown-up checklist, a "New player" button, a Grown-ups button and a sync hint on the kids' picker; the invite flow ends on that same cluttered screen.

## Who sees what

| Situation | First screen |
|---|---|
| Opens an invite link (`#invite=…`) | Welcome → guided family setup |
| No players on this device, not signed in, no invite | Welcome with **Set up our family** as the main action (open sign-up, no invite needed) |
| Signed in, no players yet (e.g. closed the app mid-setup) | Guided setup resumes at **Add your kids** |
| Players exist | **Who's playing?** (kids only) |
| A player opens the app for the first time (new player, no progress) | Kid welcome (world, avatar, 3-card tour), then her home screen |

Existing families and players see none of the new first-run screens: the kid welcome only runs for players with no progress, and the grown-up flow only runs when there are no players.

## Part 1: grown-ups

All setup screens share one layout: a card (max ~560px) centered horizontally and vertically in the viewport on tall screens (scrolls normally on short ones), a step indicator ("Step 2 of 4") where it applies, one primary button, and at most one secondary text link. Copy is short and plain. The space theme is used throughout setup (as the current profiles and Grown-ups screens do).

### Welcome
- A wordmark (a small drawn star mark above the title "Quest Academy"; no emojis on grown-up setup screens), and one line: "Practice that matches what your kids are learning in school: math, reading, writing, science, social studies and typing."
- Three short points, each with a drawn line icon (target, loop arrow, bar chart; inline SVG in the theme accent):
  - Set to each child's grade (2nd–5th), subject by subject.
  - Missed questions come back until they stick.
  - You see what each child has mastered.
- With or without an invite: primary **Set up our family**; secondary "Already have a family account? Sign in". Without an invite the family is created by open sign-up (capped per IP on the server).
- Without a sync server (the GitHub Pages copy): one **Get started** button, the local-only path.

### Step 1 of 4: Create your family
- Family name, password, password again (signup call; sends `invite` only when there is one).
- Without an invite, a small link at the bottom: "Rather not make an account? Use on this device only" (see Local-only setup).
- Errors show inline under the form (not only a toast).

### Step 2 of 4: Recovery code
- The existing recovery code screen, restyled to the shared layout. Primary: **I wrote it down**.

### Step 3 of 4: Add your kids
- A small form: first name and grade (2nd–5th as chips). **Add** puts the child in a list below (name, grade, remove ✕).
- At least one child is needed before **Next**.
- Children are created as real players with a placeholder world (`space`) and avatar, plus a flag that the child still picks her own world and avatar (`p.pickLook = true`). They sync like any player.

### Step 4 of 4: Add to Home Screen (iPad/iPhone only)
- Shown only on touch devices not already running from the Home Screen; otherwise skipped (the step count adjusts).
- Two simple pictures: Safari's Share button, then "Add to Home Screen". One line why: it runs full screen, works offline and keeps progress safe.
- Primary **Done**; secondary "Skip for now".

### All set
- A drawn check mark (no emoji), "You're all set! Hand the iPad to Mia and Ava." (the kids' names, joined naturally).
- One line for signed-in families: "On other devices, open learn.kmydev.com and sign in with your family name."
- Primary **Go to Who's playing**.

### Local-only setup ("Use on this device only")
- Steps: **Make a grown-up PIN** (existing PIN creation) → **Add your kids** → **Add to Home Screen** (when it applies) → **All set**. Step indicator counts these.

### Sign in (from Welcome)
- The existing sign-in form in the shared layout. After signing in: players synced down → Who's playing; no players yet → Add your kids.

### Who's playing? (kids only)
- A smaller title ("Who's playing?"), the kid cards (avatar, name, world), and a small "👪 Grown-ups" link at the bottom.
- Removed from this screen: the setup checklist card, the "New player" card and the sync hint line.

### Grown-ups page
- New **Add a child** button above the children's cards: opens the same name + grade form as setup (one child at a time) and creates a player with `pickLook = true`.
- The "How it works" section stays. The old setup checklist code is removed (its steps now live in the guided flow).

## Part 2: kids, first time

Runs when a player is opened from Who's playing and either `p.pickLook` is true or she has no progress yet and hasn't seen the welcome (`!p.introSeen` and no `stats`, `log` or `missions` entries). Existing players with progress never see it.

1. **Pick your world** — "Hi Mia! Pick your world." Four big world cards (icon, name, a one-line flavor). Choosing one applies its theme immediately.
2. **Pick your look** — that world's avatars as big buttons. **Next**.
3. **Tour** — three cards, one at a time, each with a large picture built from the app's own UI pieces (not screenshots) and one short line:
   - "Pick a subject, then a mission." (picture: subject tabs + a mission card)
   - "Today's Quest is a mix from every subject. A new one every day!" (picture: the quest card)
   - "Master questions to hatch your egg!" (picture: an egg with a progress bar)
   Buttons: **Next** (last card: **Let's go!**) and a small **Skip**.
4. Her home screen, as today (the egg card waits at the top).

Saving: `p.theme`, `p.avatar` are set after steps 1–2 (`pickLook` cleared); `p.introSeen = true` after the tour (or Skip). Both sync.

No read-aloud on the tour: the device voice is synthetic and the family prefers real voices, so lines are kept very short and the pictures carry the meaning.

## Behavior details
- The invite hash is removed from the URL once the family is created, so a reload doesn't restart setup.
- Back buttons: each setup step can go back one step, except after the family is created (no going back to Create).
- Progress through setup is not stored separately; the routing table above decides where to resume.
- A grown-up can still edit a player's name, grade, levels, world and avatar from the player's settings as today.

## Out of scope
- Reworking the Grown-ups page beyond the Add a child button and removing the old checklist.
- Read-aloud for the tour.

## Testing
- Each routing case in the table, in the browser preview, with seeded localStorage states: invite hash, empty unsigned device, signed-in with no players, players present.
- Invite flow end to end against the live API is not available locally; test the screens with the sync calls stubbed, and the real flow once deployed with a fresh test invite (the parent creates one).
- Kid welcome: new player with `pickLook`; new player without progress; existing player with progress (must not see it); Skip.
- Phone and iPad widths; all four themes for the kid welcome; no console errors.
- Existing family data unaffected: their Who's playing screen shows only the kid cards and the Grown-ups link.
