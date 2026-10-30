# Catchphrase

A daily office game with two slot machines. Each day every player in the league spins one phrase to **say in a meeting** ("tickety-boo", "let's timebox it") and one refined word to **use in an email** ("notwithstanding", "commensurate", "apposite"), shown with an example sentence. Use them, tick them off, and win points.

## Rules

- One spin per player per machine per day. The reels won't re-roll: spinning again replays the same phrase.
- One skip per player per machine per day: swap the phrase for a fresh spin. You can't go back to the skipped phrase, and you can't skip after claiming the point.
- No two players get the same phrase on the same machine on the same day, and a player won't see a repeat for 60 days.
- Each phrase used earns **1 point**, so up to 2 points per player per day. Past days are locked.
- The league table ranks by total points and shows streaks plus the last 7 days.

## Running it

It's a static site with no build step. Open `index.html`, or publish it with GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / root**.

## Where the scores live

The league is saved in the browser's `localStorage`. To keep score from another device, use **Share & back up**: copy the league link (it carries the whole league in the URL) or download/restore a JSON backup. The simplest setup is one scorekeeper running the league on a shared screen at stand-up.

## Adding phrases

Edit `phrases.js`. Give each new entry a fresh `id` and never reuse or renumber existing ids, since saved history refers to them. Add `use: "email"` (plus an `eg` example sentence) to put a phrase on the email machine; everything else goes on the meeting machine. To take one out of rotation, add `retired: true` rather than deleting it.
