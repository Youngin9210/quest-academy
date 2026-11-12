# Grown-ups page redesign

Date: 2026-11-12. Approved in chat.

## Goal
A parent opening the Grown-ups page can see at a glance, for each child: did she practice this week, what is she stuck on, how far along is she in each subject, and what did she do recently. Details are one tap away. Family/account settings stop crowding the top.

## 1. Activity log (data)
- `p.log`: array of `{ t, k, id, s, r, n, sec }`, newest last, capped at 500.
  - `t` timestamp (ms), `k` kind: `mission` | `quest` | `journal` | `typing` | `game`, `id` mission/lesson id, `s` subject id,
    `r` first-try right (or WPM for typing, score for game), `n` question count (or accuracy % for typing), `sec` seconds spent, capped at 1200.
- Written when a mission, quest, journal entry, typing lesson or Word Blaster game finishes.
- Time = finish time minus start time of that activity, capped at 20 minutes.
- Sync: `mergePlayer` unions both copies by `t + k + id`, sorts by `t`, keeps the last 500.
- Practice days before the log existed come from `questLog`, journal dates, typing run dates and `lastDay`.

## 2. Overview (`showParents`)
- One summary card per player, in a responsive grid (2 columns when wide, 1 when narrow).
- Card: avatar, name, grade (+ per-subject levels), streak; last 7 days as day dots; "N missions · about M min this week" (from the log); top 3 "Stuck on" items; one mastery bar per subject at her level; last 3 log entries; "See details →".
- Below: "Family settings" section with the sync card, and "How it works" folded in a `<details>`.

## 3. Detail page (`showParentDetail(p)`)
- Back to overview.
- Last 14 days: day dots with per-day activity count and minutes.
- Subjects: one `<details>` per subject, missions listed with plays, first-try accuracy and a mastery bar.
- Stuck on: full tricky list grouped by subject; common math mistakes; trickiest typing keys.
- Activity: last 14 days of log entries grouped by day.
- Journal: newest first, 5 at a time with "Show more".
- Settings: grade/levels/settings button and delete player (existing behavior).

## Out of scope
Charts over months, editing rewards, exporting data.
