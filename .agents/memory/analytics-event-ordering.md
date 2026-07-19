---
name: Analytics event ordering
description: Why __pmgTrack events fired at script boot can silently drop, and how to avoid it
---

Rule: any script that fires `window.__pmgTrack` events at eval/boot time must buffer-and-retry until the tracker exists.

**Why:** `defer` scripts execute in document order with `readyState === 'interactive'`, so a script listed BEFORE `pmg-analytics.js` in app.html boots immediately at eval — `__pmgTrack` doesn't exist yet and a plain `typeof` guard silently drops the event. This bit the first-run nudge: the CTA-click event landed (user acted later) while the nudge-shown event vanished.

**How to apply:** when adding tracked events to a `pmg-*.js` mounter, either place the fire behind a short buffered retry (see the `fire()` helper in `pmg-first-run.js`) or ensure the script tag comes after `pmg-analytics.js`. The DNT/GPC opt-out lives inside analytics' own `track()`, so buffering never bypasses it. A shared head-level queue stub was proposed as a follow-up to make this order-independent.
