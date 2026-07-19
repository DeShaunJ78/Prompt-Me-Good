---
name: Hero demo recording pitfalls
description: Gotchas when re-recording the landing-page hero clip of /app
---

# Hero demo recording pitfalls

- **First-run prefill leaks into recordings.** `/app` pre-fills the goal textarea with an example sentence for first-time visitors (pmg-first-run.js). A clean Playwright context looks like a first visit, and clicking the textarea collapses the select-all, so typed text gets APPENDED to the example — producing a garbled concatenated prompt sent to the API. Always record with `?nofirstrun`.
- **Why:** two recording attempts were wasted on this before the kill-switch fix.
- **Trim from 3s, not 2s.** The first ~2.5s of the raw capture is page load; trimming at 2s left a blank dark opening frame after the 1.25x speed-up.
- **Duplicate `#hero-demo-video` ids silently pin the stale clip.** index.html once had two hero video blocks (old `/media/…`, new `/assets/…`); `getElementById` in both lazy-load scripts targeted the FIRST (stale) one, so fresh assets never played. After any hero-clip edit, verify exactly one `#hero-demo-video` element exists on the landing page.
- **How to apply:** whenever re-recording or touching the hero-demo section of `index.html`, check frames of the encoded mp4 (ffmpeg frame extraction) before shipping — the clip is the product demo.
- **Lazy-load is not observable at real viewports.** The hero-demo section sits ~550–720px from the top of the landing page, i.e. already inside the 400px IntersectionObserver rootMargin at any phone/desktop viewport — the clip starts loading immediately on page open. To test the "no request before near-viewport" contract, use a short viewport (~360x200) so the section is genuinely out of observer range; a layout-independent raw-HTML check (no `src=` on sources, `preload="none"`) guards the most likely regression.
