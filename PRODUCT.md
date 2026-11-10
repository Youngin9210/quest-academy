# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: two sisters in 2nd–5th grade**, one younger and one older. They mostly play **on their own**, choosing a subject and working through missions without a parent beside them. They play on iPads (Safari, added to the home screen, touch only) and on gaming PCs (big screens, real keyboard and mouse).
- **Secondary: the parent**, on the locked grown-ups page. They set each child's grade and per-subject level, read accuracy, mastery, "needs practice" items, common math mistakes and journal entries, and manage the family account (password/PIN, invites, sync).

## Product Purpose

Quest Academy is a family-built learning game that gives targeted practice on what school is covering right now: math, reading, writing, science, social studies and typing. Success is a child sitting down alone, finding the subject that matches this week's homework, and getting real practice done, with missed items coming back until they stick. For the parent, success is seeing at a glance what each child has mastered and what still needs work.

## Positioning

Made by a parent for two specific kids, not a mass-market app: no ads, no store, no accounts beyond the family. Per-subject grade levels (e.g. 3rd grade overall, 4th grade math), math wrong-answer choices that are real common mistakes with an explanation of that mistake, spaced repetition of missed questions, and one shared progress (points, streak, collectibles) across every subject.

## Operating Context

- Independent play: the child reads the screen herself; hints help without giving away the answer, and the answer only shows after a second miss.
- iPad: home-screen web app (full screen, offline-capable, `localStorage`); touch targets, number pad input, read-aloud button.
- Gaming PC: large monitor, physical keyboard; typing lessons and the Word Blaster game expect a real keyboard.
- Grown-ups page locked with the family password, or a PIN on devices not signed in; grade and level changes need it.
- Family sync through a small PHP API on learn.kmydev.com; works offline per device.

## Capabilities and Constraints

- Four themed worlds, chosen per player and switchable any time: Space Explorers, Ocean Adventure, Pet Rescue, Magic Bakery. A theme changes only words, colors and collectibles; the content is shared.
- Subjects: Math (2nd–3rd and 4th–5th generators, number pad and multiple choice), Reading (word sounds, word power, story and nonfiction passages), Writing (spelling with real recorded voices, fix-it, sentence building, grammar, journal), Typing (row lessons with finger guide, falling-words game), Science and Social Studies (fact cards then questions).
- Plain HTML/CSS/JS, no build step. Static files plus `api/` PHP for sync.
- **No synthetic text-to-speech additions**: the family dislikes robotic voices. Spelling audio uses real human recordings.

## Brand Commitments

- Name: Quest Academy. Each world has its own vocabulary (Explorer/Diver/Rescuer/Baker, stars/pearls/hearts, sidekick characters).
- Voice: warm, encouraging, playful theme puns in cheers; never scolding.
- Must not feel babyish to the older (4th–5th grade) sister while staying friendly for the younger one.

## Evidence on Hand

- Real content: question banks in `subjects/`, math generators in `app.js`, world copy in `themes.js`, recorded spelling words in `audio/` (Wikimedia Commons, credited in `audio/CREDITS.md`).
- No testimonials, ratings or outside users; do not invent any.

## Product Principles

1. **Practice first.** Getting to the right homework-matching subject and answering questions is the core loop; chrome stays out of the way.
2. **Built for playing alone.** Every screen must be readable and operable by a child without help; recovery from mistakes is gentle and clear.
3. **Grows with the kid.** The same app should feel right to a 2nd grader and not childish to a 5th grader.
4. **Calm motivation.** Rewards (points, streaks, collectibles) encourage without noise, flashing, or overstimulation.
5. **Parents see the truth.** The grown-ups page is plain, honest and quick to scan.

## Accessibility & Inclusion

- Calm by default: no flashing, restrained motion, respect `prefers-reduced-motion`.
- Large touch targets for iPad; full keyboard operation on PC.
- Readable text sizes for early readers; read-aloud available on passages, questions and fact cards.
