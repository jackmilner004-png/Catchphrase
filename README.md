# Catchphrase

A daily office game. Each player in the league pulls a slot-machine lever and gets their own piece of corporate jargon, fancy vocabulary or proper posh for the day ("the latter", "for all intents and purposes", "tickety-boo"). Work it into a meeting, tick it off, and win a point.

## Rules

- One spin per player per day. The reel won't re-roll: spinning again replays the same phrase.
- One skip per player per day: swap your phrase for a fresh spin. You can't go back to the skipped phrase, and you can't skip after claiming the point.
- No two players get the same phrase on the same day, and a player won't see a repeat for 60 days.
- Saying it in a meeting earns **1 point**. One point per player per day; past days are locked.
- The league table ranks by total points and shows streaks plus the last 7 days.

## Running it

It's a static site with no build step. Open `index.html`, or publish it with GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / root**.

## Where the scores live

The league is saved in the browser's `localStorage`. To keep score from another device, use **Share & back up**: copy the league link (it carries the whole league in the URL) or download/restore a JSON backup. The simplest setup is one scorekeeper running the league on a shared screen at stand-up.

## Adding phrases

Edit `phrases.js`. Give each new entry a fresh `id` and never reuse or renumber existing ids, since saved history refers to them.
