/* PromptMeGood — Chassis v3 bootstrap
   Implements the "Definitive Redesign Command" PDF.
   Default ON. Opt out with ?chassis=off (raw legacy). Chassis v2 was
   removed in cv3-22 cleanup pass.
   Reparents existing #goal, #settingsPanel, #generateBtn, #resultBox, #strength-score,
   #aiResponseSection into the new shell so all existing JS handlers keep working untouched.
*/
(function () {
  'use strict';

  var V3_CLASS = 'pmg-chassis-v3';
  var qs = new URLSearchParams(window.location.search);
  var modeOverride = qs.get('chassis');

  if (modeOverride === 'off') {
    return;
  }

  document.documentElement.classList.add(V3_CLASS);
  window.__pmgChassisV3Active = true;

  var rootEl = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    if (document.getElementById('pmg-chassis-v3-root')) return;
    rootEl = buildShell();
    document.body.appendChild(rootEl);
    reparent();
    // Kill stray clones that pmg-ux.js injects (generateBtnTop in particular)
    var killTicks = 0;
    var killClones = setInterval(function () {
      killTicks++;
      if (killTicks > 30) { clearInterval(killClones); return; }
      var clones = document.querySelectorAll('#generateBtnTop, .pmg-t100-top-cta-row, [id^="generateBtnTop"]');
      clones.forEach(function (n) {
        if (n.parentNode) n.parentNode.removeChild(n);
      });
    }, 200);
    // Force-hide collapsible sections + the generate button itself via inline style
    // (beats any CSS conflict and any legacy script that may unhide the section).
    ['tuning-panel', 'generate-section', 'prompt-output-box', 'ai-response-box'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.setProperty('display', 'none', 'important');
    });
    var genBtnHide = document.getElementById('generateBtn');
    if (genBtnHide) genBtnHide.style.setProperty('display', 'none', 'important');
    var settingsHide = document.getElementById('settingsPanel');
    if (settingsHide) settingsHide.style.setProperty('display', 'none', 'important');
    // ph-1 (Placeholder Fix Brief): ensure the empty-state placeholder is
    // visible on a fresh boot. Some legacy code paths may have left
    // body.pmg-has-result set from a previous interaction, which the CSS
    // rule `.pmg-has-result .pmgv3-right-placeholder { display:none }`
    // turns into a hidden right column on first paint. Clearing the class
    // here resets to the empty-state default. We do this BEFORE
    // wirePersistence() so session restore (L484) can legitimately
    // re-add the class when a stored prompt is being restored.
    document.body.classList.remove('pmg-has-result');
    wireActions();
    wirePersistence();
    wireDraftRecovery();
    deleteTargets();
    setupInspirationFeed();
    wireWhispererToggle();
    // Re-apply the hide on a short tick in case any late legacy script flips display
    var hideTicks = 0;
    var hideTick = setInterval(function () {
      hideTicks++;
      if (hideTicks > 20) { clearInterval(hideTick); return; }
      if (document.body.classList.contains('pmgv3-analyzed')) { clearInterval(hideTick); return; }
      var gb = document.getElementById('generateBtn');
      if (gb) gb.style.setProperty('display', 'none', 'important');
      var gs = document.getElementById('generate-section');
      if (gs) gs.style.setProperty('display', 'none', 'important');
      var sp = document.getElementById('settingsPanel');
      if (sp) sp.style.setProperty('display', 'none', 'important');
      var tp = document.getElementById('tuning-panel');
      if (tp) tp.style.setProperty('display', 'none', 'important');
    }, 200);
  }

  /* mux-3 (Section 1): Whisperer is collapsed by default. The small
     "✨ Need a starter idea?" toggle expands the bar; preference
     persists in localStorage['pmgv3:whisperer:open']. We DON'T auto-
     restore the open state on first load — the brief explicitly wants
     the textarea + Generate to dominate the first impression — but
     once the user opts in, we remember it for subsequent sessions. */
  function wireWhispererToggle() {
    var btn = document.getElementById('pmgv3-whisperer-toggle');
    var bar = document.getElementById('pmgv3-whisperer-bar');
    if (!btn || !bar) return;
    var KEY = 'pmgv3:whisperer:open';
    function setOpen(open, persist) {
      if (open) {
        bar.classList.remove('is-collapsed');
        bar.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.add('is-open');
      } else {
        bar.classList.add('is-collapsed');
        bar.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('is-open');
      }
      if (persist) {
        try { localStorage.setItem(KEY, open ? '1' : '0'); } catch (e) {}
      }
    }
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) {}
    if (stored === '1') setOpen(true, false);
    btn.addEventListener('click', function () {
      var nowOpen = btn.getAttribute('aria-expanded') !== 'true';
      setOpen(nowOpen, true);
      if (nowOpen) {
        var input = document.getElementById('whisperer-input');
        if (input) try { input.focus(); } catch (e) {}
      }
    });
  }

  /* if-1 (Right Column UX Fill brief): wire the "Start Fast" template
     pills inside .pmgv3-inspiration-feed. Clicking a pill fills the
     #goal textarea, fires input + change events so any listeners
     (auto-tune, persistence) react, focuses the field, and scrolls
     it into view on mobile. Mirrors the pattern used elsewhere
     (pmg-business-mode.js Build Prompt) and intentionally does NOT
     auto-submit — the user still picks tuning before generating. */
  function setupInspirationFeed() {
    document.addEventListener('click', function (ev) {
      var pill = ev.target && ev.target.closest && ev.target.closest('[data-pmg-tpl-fill]');
      if (!pill) return;
      ev.preventDefault();
      var text = pill.getAttribute('data-pmg-tpl-fill') || '';
      var goal = document.getElementById('goal');
      if (!goal) return;
      goal.value = text;
      goal.dispatchEvent(new Event('input', { bubbles: true }));
      goal.dispatchEvent(new Event('change', { bubbles: true }));
      try { goal.focus({ preventScroll: false }); } catch (_) { goal.focus(); }
      var beh = (window.PMG_A11Y && typeof window.PMG_A11Y.scrollBehavior === 'function')
        ? window.PMG_A11Y.scrollBehavior()
        : 'smooth';
      try { goal.scrollIntoView({ block: 'center', behavior: beh }); } catch (_) {}
    });
  }

  function buildShell() {
    var root = document.createElement('div');
    root.id = 'pmg-chassis-v3-root';
    root.innerHTML = [
      '<header class="pmgv3-topbar">',
        '<button type="button" class="pmgv3-brand" id="pmgv3-brand-home" title="Return to home — clears the current tab" aria-label="Return to home">',
          '<img src="/assets/pmg-logo.png?v=6" alt="PromptMeGood" />',
          '<span>PromptMeGood</span>',
          '<span class="pmgv3-brand-beta">Beta</span>',
        '</button>',
        '<div class="pmgv3-tb-r">',
          // nav-home-1: text link "← Home" (first-time users need an obvious
          // path back from the workstation; the brand glyph alone wasn't enough).
          '<button class="pmgv3-nav-home" id="pmgv3-nav-home" type="button" title="Return to home" aria-label="Return to home">← Home</button>',
          // H-4 (audit-2 triage): "Pricing" text link inside the workstation
          // topbar. Previously the only path to /pricing.html from /app was the
          // green "Upgrade" button (felt committal) or scrolling to the footer.
          // Sits next to ← Home as a peer ghost-link.
          '<a class="pmgv3-nav-pricing" id="pmgv3-nav-pricing" href="/pricing.html" title="See pricing" aria-label="See pricing">Pricing</a>',
          // H-3 (audit-2 triage): each icon now has a small text micro-label
          // below the glyph on desktop. Glyph-only was unreadable to first-time
          // users (no clue ❓ = Guide, 💼 = Growth, 🗄️ = Vault, ⚙️ = Settings).
          // Mobile (<480px) collapses back to icon-only via media query.
          '<a class="pmgv3-ico" id="pmgv3-help" href="/guide.html" target="_blank" rel="noopener" title="Quick Guide — opens in a new tab" aria-label="Open the PromptMeGood quick guide in a new tab"><span class="pmgv3-ico-glyph">❓</span><span class="pmgv3-ico-label">Guide</span></a>',
          // bm-2: Business Mode is a header-icon panel (NOT a 4th tab).
          // Click is wired by /scripts/pmg-business-mode.js.
          '<button class="pmgv3-ico" id="pmgv3-business" type="button" title="Growth Mode — assemble a marketing prompt" aria-label="Open Growth Mode"><span class="pmgv3-ico-glyph">💼</span><span class="pmgv3-ico-label">Growth</span></button>',
          '<button class="pmgv3-ico" id="pmgv3-vault" type="button" title="Vault — saved prompts" aria-label="Open Vault"><span class="pmgv3-ico-glyph">🗄️</span><span class="pmgv3-ico-label">Vault</span></button>',
          // expert-topbar-1 (audit-2 round 2): dedicated Expert Command Center
          // entry point in the workstation topbar. Click is wired by
          // pmg-expert-center.js wireEntryPoints (looks for #pmgv3-expert).
          // Sits between Vault and Settings so the icon order reads
          // Guide / Growth / Vault / Expert / Settings.
          '<button class="pmgv3-ico" id="pmgv3-expert" type="button" title="Expert Command Center — advanced prompt engineering tools" aria-label="Open Expert Command Center"><span class="pmgv3-ico-glyph">✦</span><span class="pmgv3-ico-label">Expert</span></button>',
          /* H-1 (audit-2 deferred): the 4 icons above (Guide / Growth /
             Vault / Settings) are CSS-hidden at ≤480px; this ⋮ button
             takes their place and opens a small dropdown that proxies
             clicks back to the (hidden) underlying buttons. Default
             display: none — only visible on phones via the same media
             query that hides the icons. Keeps brand text + ← Home +
             Pricing + Lock In $79 visible at 360px without crowding. */
          '<button class="pmgv3-more" id="pmgv3-more" type="button" aria-label="More" aria-haspopup="true" aria-expanded="false" title="More: Guide, Growth, Vault, Settings">⋮</button>',
          // L-C (audit-2 triage): during the open beta the only paid action
          // actually available is the Founding Member $79 one-time deal —
          // every other tier routes to the waitlist. "Upgrade" misrepresents
          // that. Render "Lock In $79" while now < BETA_END, swap back to
          // "Upgrade" once the full tier ladder goes live. Default text is
          // beta-mode ("Lock In $79") because that's the active state today;
          // the post-mount swap below promotes it to "Upgrade" if BETA_END
          // has already passed. Same idea as the launch swap that toggles
          // data-pmg-beta-only / data-pmg-post-launch elsewhere on the page.
          '<button class="pmgv3-upgrade" type="button" id="pmgv3-upgrade" title="Lock in lifetime access for $79 — Founding Member, first 500 buyers, price locked for life">Lock In $79</button>',
        '</div>',
      '</header>',
      '<nav class="pmgv3-tabs" role="tablist" aria-label="Module">',
        '<button class="pmgv3-tab is-active" data-module="text" role="tab" aria-selected="true" type="button">✍️ Text Prompts</button>',
        '<button class="pmgv3-tab" data-module="photography" role="tab" aria-selected="false" type="button">📸 Photography</button>',
        '<button class="pmgv3-tab" data-module="video" role="tab" aria-selected="false" type="button">🎬 Video</button>',
      '</nav>',
      '<div class="pmgv3-body" data-active-panel="text">',
        '<div class="pmgv3-panel" id="pmgv3-panel-text">',
        '<div class="pmgv3-left">',
          // mux-3 (Section 1): Whisperer demoted behind a small text-link
          // toggle. Default-collapsed so the textarea + Generate button
          // dominate the first impression. Click expands; preference
          // persists in localStorage['pmgv3:whisperer:open'].
          '<div class="pmgv3-whisperer-wrap" id="pmgv3-whisperer-wrap">',
            '<button type="button" class="pmgv3-whisperer-toggle" id="pmgv3-whisperer-toggle" aria-expanded="false" aria-controls="pmgv3-whisperer-bar">',
              '<span aria-hidden="true">✨</span>',
              '<span class="pmgv3-whisperer-toggle-label">Need a starter idea?</span>',
              '<span class="pmgv3-whisperer-toggle-chevron" aria-hidden="true">▾</span>',
            '</button>',
            '<div class="pmgv3-whisperer-bar is-collapsed" id="pmgv3-whisperer-bar" hidden>',
              '<div class="whisperer-input-row">',
                '<div class="whisperer-input-wrapper">',
                  '<input type="text" class="whisperer-input" id="whisperer-input" autocomplete="off" placeholder="" aria-label="Prompt Whisperer question" />',
                  '<div class="whisperer-typewriter" id="whisperer-typewriter" aria-hidden="true"></div>',
                '</div>',
                '<button type="button" class="whisperer-spark-btn" id="btn-whisperer-spark">Spark →</button>',
              '</div>',
            '</div>',
          '</div>',
          '<section class="idea-section">',
            '<label class="pmgv3-section-label" for="goal">Your Idea</label>',
            '<p class="pmgv3-section-hint">Describe what you want to create. Be as brief or detailed as you like.</p>',
            '<div class="pmgv3-idea-host">',
              /* cv3-48 fix: clear ✕ MUST live inside .pmgv3-idea-host (the
                 positioned ancestor) so its absolute placement anchors to
                 the goal field, not to the chassis root. */
              '<button type="button" id="pmgv3-goal-clear" class="pmgv3-goal-clear" title="Clear" aria-label="Clear what you typed" hidden>✕</button>',
            '</div>',
          '<button id="analyze-btn" class="btn-analyze" type="button">✨ Build My Prompt</button>',
          '</section>',
          '<section class="tuning-section is-collapsed" id="tuning-panel" style="display:none !important">',
            '<button type="button" class="tuning-header" id="tuning-mobile-toggle" aria-expanded="false" aria-controls="settingsPanel">',
              '<span class="tuning-header-row">',
                '<span class="tuning-title">🎛️ Tune Your Prompt</span>',
                '<span class="tuning-pick-count" id="tuning-pick-count" aria-hidden="true"></span>',
                '<span class="tuning-chevron" aria-hidden="true">▾</span>',
              '</span>',
              '<span class="tuning-hint">We\'ve pre-selected settings based on your idea. Adjust if needed.</span>',
            '</button>',
            '<div class="pmgv3-tuning-host"></div>',
            // cv3-58 epic-text: container for the new advanced reasoning /
            // calibrated-confidence / target-audience controls. Mounted by
            // mountEpicTextTuning() once the chassis is up.
            '<div class="pmgv3-epic-tuning" id="pmgv3-epic-tuning"></div>',
          '</section>',
          '<section class="generate-section is-collapsed" id="generate-section" style="display:none !important">',
            '<div class="generate-divider"></div>',
            '<div class="pmgv3-generate-host"></div>',
          '</section>',
        '</div>',
        '<div class="pmgv3-right">',
          /* if-1: aria-hidden removed. Previously the placeholder was
             marked aria-hidden="true" because it contained only
             decorative empty-state copy, but the inspiration feed
             below adds real interactive buttons (.pmgv3-if-pill).
             Hiding them from assistive tech while leaving them
             keyboard-focusable is an a11y regression — so the
             wrapper is now exposed normally. */
          '<div class="pmgv3-right-placeholder" id="pmgv3-right-placeholder">',
            '<div class="pmgv3-rp-icon" aria-hidden="true">✨</div>',
            '<div class="pmgv3-rp-title">Your Optimized Prompt Will Appear Here</div>',
            '<div class="pmgv3-rp-sub">Type your goal below or choose a template to generate your first prompt.</div>',
            '<ul class="pmgv3-rp-bullets">',
              '<li><span aria-hidden="true">①</span> Tell us what you want to create</li>',
              '<li><span aria-hidden="true">②</span> Tune the auto-picked settings</li>',
              '<li><span aria-hidden="true">③</span> Generate a strong, ready-to-run prompt</li>',
            '</ul>',
            /* if-1 (Right Column UX Fill brief): inspiration feed
               fills the otherwise-blank right column on desktop with
               two visual example cards + three clickable template
               pills. Auto-hidden post-generation because the parent
               .pmgv3-right-placeholder already collapses on
               body.pmg-has-result. Pills wire via delegated click
               handler installed below in setupInspirationFeed(). */
            '<div class="pmgv3-inspiration-feed">',
              /* sf-removed: the "Start Fast" pill row was removed at user
                 request — the pills kept getting cut off at the bottom of
                 the right column on common desktop heights regardless of
                 ordering. setupInspirationFeed() click delegation is left
                 in place (harmless when no .pmg-tpl-fill targets exist) so
                 anything that relies on the same data-pmg-tpl-fill contract
                 (Business Mode, etc.) keeps working. .pmgv3-if-section /
                 .pmgv3-if-heading / .pmgv3-if-pill CSS is also left in
                 place — unused but cheap and trivially re-mountable. */
              '<div class="pmgv3-if-section">',
                '<div class="pmgv3-if-heading">See What\u2019s Possible</div>',
                '<div class="pmgv3-if-examples">',
                  '<div class="pmgv3-if-card">',
                    '<div class="pmgv3-if-card-label">Reselling &amp; E-commerce</div>',
                    '<div class="pmgv3-if-ba">',
                      '<div class="pmgv3-if-ba-col pmgv3-if-ba-before">',
                        '<div class="pmgv3-if-ba-tag">Before</div>',
                        '<div class="pmgv3-if-ba-text">"how do I make money reselling stuff online"</div>',
                      '</div>',
                      '<div class="pmgv3-if-ba-arrow" aria-hidden="true">\u2192</div>',
                      '<div class="pmgv3-if-ba-col pmgv3-if-ba-after">',
                        '<div class="pmgv3-if-ba-tag">After</div>',
                        '<div class="pmgv3-if-ba-text">"Walk me through a 30-day plan to start a sneaker + streetwear reselling side hustle with $500 in my pocket. I want the 3 best places to actually source from (thrift, outlet, online arbitrage), a simple way to hit 40% margins, a listing template that ranks, and a straight answer on which marketplace pays out fastest when you\u2019re just starting."</div>',
                      '</div>',
                    '</div>',
                  '</div>',
                  '<div class="pmgv3-if-card">',
                    '<div class="pmgv3-if-card-label">AI-Powered Freelancing &amp; Digital Services</div>',
                    '<div class="pmgv3-if-ba">',
                      '<div class="pmgv3-if-ba-col pmgv3-if-ba-before">',
                        '<div class="pmgv3-if-ba-tag">Before</div>',
                        '<div class="pmgv3-if-ba-text">"how do I make money as an ai freelancer"</div>',
                      '</div>',
                      '<div class="pmgv3-if-ba-arrow" aria-hidden="true">\u2192</div>',
                      '<div class="pmgv3-if-ba-col pmgv3-if-ba-after">',
                        '<div class="pmgv3-if-ba-tag">After</div>',
                        '<div class="pmgv3-if-ba-text">"Help me launch an AI services side hustle in 30 days. I want 3 things I can productize and sell to small businesses for under $1,500 (think chatbot setup, content engine, custom GPT for ops), positioning that doesn\u2019t sound like every other \u2018AI guy\u2019 on LinkedIn, an outreach script for landing my first 3 clients on Upwork, and a delivery flow using ChatGPT + Zapier so each project takes under 6 hours."</div>',
                      '</div>',
                    '</div>',
                  '</div>',
                '</div>',
              '</div>',
            '</div>',
          '</div>',
          '<div class="output-box is-collapsed" id="prompt-output-box" style="display:none !important">',
            '<div class="strength-bar-container" id="pmgv3-strength-slot">',
              '<div class="strength-header">',
                '<span class="strength-label">Prompt Strength</span>',
                '<span class="strength-score" id="strength-score-badge">--</span>',
              '</div>',
              '<div class="strength-track"><div class="strength-fill" id="strength-fill" style="width:0%"></div></div>',
              '<div class="strength-status" id="strength-status">Analyzing…</div>',
            '</div>',
            '<label class="pmgv3-section-label" style="margin-top:12px;">Your Engineered Prompt</label>',
            '<div class="pmgv3-output-host"></div>',
            '<div class="prompt-actions">',
              '<button class="btn-secondary" type="button" id="edit-prompt-btn">✏️ Edit</button>',
              '<button class="btn-secondary" type="button" id="rewrite-btn">🔄 Rewrite</button>',
              '<button class="btn-secondary" type="button" id="save-draft-btn">💾 Save Draft</button>',
            '</div>',
            '<div class="next-step-divider"><span>Happy with your prompt?</span></div>',
            /* cv3-60: inline length-warning replaces the legacy alert()
               that fired when prompts exceeded the Run-With-AI ceiling.
               Hidden by default; app.html run() reveals + disables the
               button + pulses the send-to grid below. */
            '<div id="pmgv3-length-warning" class="pmgv3-inline-warning" style="display:none" role="status" aria-live="polite">',
              '<span class="warning-icon" aria-hidden="true">⚠️</span>',
              '<div class="warning-text">',
                '<strong>Epic prompt!</strong> It\'s too detailed for the quick preview window — use one of the <strong>Send to</strong> buttons below to run it in ChatGPT, Claude, Perplexity, or Gemini for the full, uncapped result.',
              '</div>',
            '</div>',
            '<button class="btn-run-primary" type="button" id="run-with-ai-btn">▶ Run With AI Here</button>',
            /* cv3-53: in-house Run With AI result renders here, BEFORE
               the send-to area, so the visual flow is:
               button → result → nudge → label → 2×2 handoff grid. */
            '<div class="output-box ai-response-box is-collapsed" id="ai-response-box" style="display:none !important">',
              '<div class="pmgv3-air-host"></div>',
            '</div>',
            '<p class="pmgv3-send-nudge">Not sure which to pick? ChatGPT for general tasks, Claude for writing, Perplexity for research.</p>',
            '<div class="pmgv3-send-label">Send your prompt to:</div>',
            '<div class="pmgv3-send-grid send-to-row">',
              '<button class="btn-send-to" data-platform="chatgpt"    data-pmg-dest="chatgpt"    type="button"><span class="pmgv3-send-name">ChatGPT</span><span class="pmgv3-send-desc">General purpose · most popular</span></button>',
              '<button class="btn-send-to" data-platform="claude"     data-pmg-dest="claude"     type="button"><span class="pmgv3-send-name">Claude</span><span class="pmgv3-send-desc">Long writing · analysis</span></button>',
              '<button class="btn-send-to" data-platform="perplexity" data-pmg-dest="perplexity" type="button"><span class="pmgv3-send-name">Perplexity</span><span class="pmgv3-send-desc">Research · cited answers</span></button>',
              '<button class="btn-send-to" data-platform="gemini"     data-pmg-dest="gemini"     type="button"><span class="pmgv3-send-name">Gemini</span><span class="pmgv3-send-desc">Google data · multimodal</span></button>',
            '</div>',
          '</div>',
        '</div>',
        '</div>', // /#pmgv3-panel-text
        '<div class="pmgv3-panel" id="pmgv3-panel-photo">',
          '<div class="pmgv3-left" id="pmgv3-photo-left"></div>',
          '<div class="pmgv3-right" id="pmgv3-photo-right"></div>',
        '</div>',
        '<div class="pmgv3-panel" id="pmgv3-panel-video">',
          '<div class="pmgv3-left" id="pmgv3-video-left"></div>',
          '<div class="pmgv3-right" id="pmgv3-video-right"></div>',
        '</div>',
      '</div>',
      '<footer class="pmgv3-bottom">',
        '<div class="quick-entry-pill">',
          '<span class="quick-entry-icon">✏️</span>',
          '<input type="text" id="quick-entry" placeholder="What do you want to build?" autocomplete="off" />',
          '<button id="quick-entry-submit" class="quick-entry-btn" type="button" aria-label="Send">▲</button>',
        '</div>',
      '</footer>',
      /* tr-trust: minimal trust-signal footer at the very bottom of the
         chassis so users can reach Terms / Privacy / Contact without
         leaving the workstation. Lives INSIDE #pmg-chassis-v3-root so the
         universal-hide rule doesn't erase it. */
      '<footer class="pmgv3-trust" role="contentinfo">',
        '<nav class="pmgv3-trust-nav" aria-label="Site">',
          '<a href="/">Home</a>',
          '<span class="pmgv3-trust-sep" aria-hidden="true">·</span>',
          '<a href="/guide.html">Guide</a>',
          '<span class="pmgv3-trust-sep" aria-hidden="true">·</span>',
          '<a href="/pricing.html">Pricing</a>',
          '<span class="pmgv3-trust-sep" aria-hidden="true">·</span>',
          '<a href="mailto:support@promptmegood.com">Contact</a>',
          '<span class="pmgv3-trust-sep" aria-hidden="true">·</span>',
          '<a href="/privacy.html">Privacy</a>',
          '<span class="pmgv3-trust-sep" aria-hidden="true">·</span>',
          '<a href="/terms.html">Terms</a>',
        '</nav>',
        '<div class="pmgv3-trust-copy">© 2026 PromptMeGood</div>',
      '</footer>',
    ].join('');
    return root;
  }

  function reparent() {
    // 0. Move #prompt-form to a stable body-level location so its submit
    //    listener (bound at app.html ~L8843) stays reachable after we
    //    reparent the form's input children into the v3 shell. Form is
    //    kept display:none — the visible inputs live inside v3 slots and
    //    submit via the [form="prompt-form"] HTML5 attribute association.
    var rescueForm = document.getElementById('prompt-form');
    if (rescueForm && rescueForm.parentNode !== document.body) {
      document.body.appendChild(rescueForm);
      rescueForm.style.setProperty('display', 'none', 'important');
      rescueForm.setAttribute('data-pmgv3-rescued', '1');
    }

    // 1. Move #goal field into idea host
    var goalEl = document.getElementById('goal');
    if (goalEl) {
      var goalField = goalEl.closest('.field') || goalEl;
      var ideaHost = rootEl.querySelector('.pmgv3-idea-host');
      if (ideaHost && goalField.parentNode !== ideaHost) {
        ideaHost.appendChild(goalField);
      }
    }

    // 2. Move #settingsPanel into tuning host
    var settings = document.getElementById('settingsPanel');
    if (settings) {
      var tuningHost = rootEl.querySelector('.pmgv3-tuning-host');
      if (tuningHost && settings.parentNode !== tuningHost) {
        tuningHost.appendChild(settings);
      }
      settings.style.setProperty('display', 'none', 'important');
      settings.setAttribute('data-pmgv3-collapsed', '1');
    }

    // 3. Move #generateBtn into generate-section. Keep it inside #prompt-form for submit semantics
    //    by ALSO moving #prompt-form into the body so the button stays a form submit child.
    var form = document.getElementById('prompt-form');
    var genBtn = document.getElementById('generateBtn');
    if (genBtn && form) {
      // Move form to a hidden container so the form remains the parent of relocated children.
      // The actual children (idea field, settings, generate button) are now physically nested
      // inside our shell, but the form element wraps them via DOM ancestry through host slots.
      // Simpler: move generateBtn into generate host; rely on form-attribute to keep submit.
      genBtn.setAttribute('form', 'prompt-form');
      genBtn.textContent = '✨ Done Tuning — Generate My Prompt';
      var genHost = rootEl.querySelector('.pmgv3-generate-host');
      if (genHost && genBtn.parentNode !== genHost) {
        genHost.appendChild(genBtn);
      }
      // Hard-hide the button itself; analyze click will un-hide.
      genBtn.style.setProperty('display', 'none', 'important');
      genBtn.setAttribute('data-pmgv3-collapsed', '1');
      // Same for #goal so submit on Enter still works
      if (goalEl) goalEl.setAttribute('form', 'prompt-form');
      // Ensure the form element still exists somewhere in the DOM so 'form' attribute resolves.
      if (form && !document.body.contains(form)) {
        document.body.appendChild(form);
        form.style.display = 'none';
      }
    }

    // 4. Move #resultBox into prompt output host
    var resultBox = document.getElementById('resultBox');
    if (resultBox) {
      var outHost = rootEl.querySelector('.pmgv3-output-host');
      if (outHost && resultBox.parentNode !== outHost) {
        outHost.appendChild(resultBox);
      }
      // Spec uses #output as the textarea ID; provide an alias getter on the global so
      // any spec-conformant code that tries document.getElementById('output') succeeds.
      if (!document.getElementById('output')) {
        try {
          // Add an attribute so it can also be reached via [data-spec-id]
          resultBox.setAttribute('data-spec-id', 'output');
        } catch (e) {}
      }
    }

    // 5. Move #strength-score into strength slot (replacing default markup)
    var legacyStrength = document.getElementById('strength-score');
    var strengthSlot = rootEl.querySelector('#pmgv3-strength-slot');
    if (legacyStrength && strengthSlot) {
      // Append legacy node alongside the spec markup so existing fill/pct updates still work
      legacyStrength.classList.add('pmgv3-relocated');
      legacyStrength.removeAttribute('hidden');
      strengthSlot.appendChild(legacyStrength);
    }

    // 6. Move #aiResponseSection into Box 2 host
    var air = document.getElementById('aiResponseSection');
    if (air) {
      var airHost = rootEl.querySelector('.pmgv3-air-host');
      if (airHost && air.parentNode !== airHost) {
        airHost.appendChild(air);
      }
      air.removeAttribute('hidden');
    }
  }

  /* cv3-49 — Session persistence. Mobile Safari aggressively unloads
     backgrounded tabs to free memory, so when a user taps "Send to
     Gemini/ChatGPT" and then returns to PromptMeGood, the page reloads
     fresh and the user's idea + tuning + generated prompt are gone.
     This is a critical UX failure — losing work mid-task is one of
     the fastest ways to lose a user. We persist the live session to
     sessionStorage on every change and restore it on boot. cv3-55:
     sessionStorage (not localStorage) — survives switching apps /
     opening Gemini in a new tab, but auto-clears when the tab is
     fully closed, giving a clean slate on next fresh open.

     Storage:
       pmgv3:session = { goal, tuning:{id:value}, prompt, ts }
     TTL: 30 minutes — see stale-session-1 below (defensive — sessionStorage clears on tab close
     anyway, but if a stale entry somehow survives we still ignore
     it). Disable hatches: ?fresh=1 in URL,
     localStorage.pmgv3_persist_disable='1' (disable flag stays on
     localStorage so it persists across tabs). */
  var SESSION_KEY = 'pmgv3:session';
  /* stale-session-1 (2026-05-12): cut from 7 days to 30 minutes.
     Users open the marketing page, click Open The App, and were greeted
     by their stale prompt + tuning from a session days earlier. The 7-day
     TTL was too generous for a single-session workflow tool. The Draft
     Recovery banner (dr-1) is the dedicated UX for explicitly restoring
     longer-term work — we should not silently re-hydrate stale state. */
  var SESSION_TTL_MS = 30 * 60 * 1000;
  /* dr-1 (Draft Recovery): mirror every session write to localStorage
     under a separate key so the draft survives a full tab close
     (sessionStorage does not). On next visit, if the live sessionStorage
     is empty but a fresh draft exists, we offer the user a non-blocking
     restore banner. Cleared on Vault save (pmg:vault-saved event) and
     on explicit dismiss. Same 30-minute TTL as the live session (stale-session-1). */
  var DRAFT_KEY = 'pmgv3:draft';
  var DRAFT_DISMISS_KEY = 'pmgv3:draft:dismissedTs';
  var TUNE_FIELDS = ['category', 'skillLevel', 'tone', 'outputFormat', 'maxLength', 'outputLanguage', 'personality'];
  var _persistTimer = null;
  var _persistSuspended = false;
  function persistDisabled() {
    try {
      if (/[?&]fresh\b/.test(window.location.search || '')) return true;
      if (localStorage.getItem('pmgv3_persist_disable') === '1') return true;
    } catch (e) {}
    return false;
  }
  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.ts && (Date.now() - parsed.ts) > SESSION_TTL_MS) return null;
      return parsed;
    } catch (e) { return null; }
  }
  function writeSession() {
    if (persistDisabled() || _persistSuspended) return;
    try {
      var goal = document.getElementById('goal');
      var rb = document.getElementById('resultBox');
      var tuning = {};
      TUNE_FIELDS.forEach(function (id) {
        var sel = document.getElementById(id);
        if (sel && sel.value) tuning[id] = sel.value;
      });
      var promptText = (rb && rb.textContent || '').trim();
      if (promptText === 'Your fixed prompt will appear here.') promptText = '';
      var data = {
        goal: goal ? goal.value : '',
        tuning: tuning,
        prompt: promptText,
        ts: Date.now()
      };
      // Skip writes when there's no real user content. Tuning selects
      // ALWAYS have a default value (e.g. "other"/"beginner") so we
      // can't gate on tuning emptiness — only goal+prompt count as
      // signal. Without this, pagehide on a cleared page re-persists
      // a junk session right after Start Over.
      if (!data.goal && !data.prompt) return;
      var serialized = JSON.stringify(data);
      sessionStorage.setItem(SESSION_KEY, serialized);
      // dr-1: mirror to localStorage so the draft survives a full tab
      // close. Same payload + timestamp; the recovery banner uses ts
      // for the freshness check.
      try { localStorage.setItem(DRAFT_KEY, serialized); } catch (e) {}
    } catch (e) {}
  }
  function schedulePersist() {
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(writeSession, 400);
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    // dr-1: clear the localStorage draft mirror too so Start Over /
    // explicit clears don't leave a stale "Restore your last draft?"
    // banner waiting on the next visit.
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }
  // Expose for doStartOver / external callers.
  window.pmgChassisV3 = window.pmgChassisV3 || {};
  window.pmgChassisV3.clearSession = clearSession;
  window.pmgChassisV3.saveSession = writeSession;

  function wirePersistence() {
    if (persistDisabled()) return;
    // 1. Restore on boot (if any). Run after wireActions has bound handlers
    //    so dispatched 'change' events refresh the pill UI.
    var snap = readSession();
    if (snap) restoreSession(snap);
    // 2. Save on user input — debounced.
    var goal = document.getElementById('goal');
    if (goal) goal.addEventListener('input', schedulePersist);
    TUNE_FIELDS.forEach(function (id) {
      var sel = document.getElementById(id);
      if (sel) sel.addEventListener('change', schedulePersist);
    });
    // 3. Save when the result text changes — #resultBox is updated
    //    by the legacy form-submit handler so we observe it.
    var rb = document.getElementById('resultBox');
    if (rb && typeof MutationObserver !== 'undefined') {
      try {
        var mo = new MutationObserver(schedulePersist);
        mo.observe(rb, { childList: true, characterData: true, subtree: true });
      } catch (e) {}
    }
    // 4. Belt-and-braces: save on visibility change (user is about to
    //    leave the tab — e.g. tapping "Send to Gemini").
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') writeSession();
    });
    window.addEventListener('pagehide', writeSession);
    window.addEventListener('beforeunload', writeSession);
  }

  /* dr-1 (Draft Recovery): on boot, if the live sessionStorage is empty
     (fresh tab) but a localStorage draft exists from a prior tab that
     was closed mid-edit, surface a non-blocking floating banner with
     Restore / Dismiss buttons. Restore rehydrates via the same
     restoreSession() the in-tab persistence uses. Dismiss clears the
     draft so the banner doesn't reappear.

     The banner carries data-pmg-overlay-root so the chassis universal-
     hide rule (pmg-chassis-v3.css L51) doesn't erase it on insertion.
     Auto-clears on pmg:vault-saved so users who reach a save state
     never see a stale offer. */
  function readDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.ts || (Date.now() - parsed.ts) > SESSION_TTL_MS) {
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
        return null;
      }
      // Only count as a draft if there's actual user content.
      if (!parsed.goal && !parsed.prompt) return null;
      return parsed;
    } catch (e) { return null; }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }
  function relativeAge(ts) {
    var diff = Math.max(0, Date.now() - ts);
    var min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + ' minute' + (min === 1 ? '' : 's') + ' ago';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' hour' + (hr === 1 ? '' : 's') + ' ago';
    var day = Math.floor(hr / 24);
    return day + ' day' + (day === 1 ? '' : 's') + ' ago';
  }
  // Full HTML-entity escape. The previous version omitted " and ' which
  // is fine for text-context insertion but brittle if the surrounding
  // markup ever moves the value into an attribute. Belt-and-braces.
  function escapeHtml(s) {
    return String(s).replace(/[<>&"']/g, function (c) {
      return c === '<' ? '&lt;'
        : c === '>' ? '&gt;'
        : c === '&' ? '&amp;'
        : c === '"' ? '&quot;'
        : '&#39;';
    });
  }
  function showDraftBanner(snap) {
    if (document.getElementById('pmg-draft-recovery')) return;
    var preview = (snap.goal || snap.prompt || '').replace(/\s+/g, ' ').trim();
    if (preview.length > 70) preview = preview.slice(0, 67) + '…';
    var bar = document.createElement('div');
    bar.id = 'pmg-draft-recovery';
    bar.className = 'pmg-draft-recovery';
    bar.setAttribute('data-pmg-overlay-root', '1');
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML =
      '<div class="pmg-draft-recovery-inner">' +
        '<div class="pmg-draft-recovery-text">' +
          '<strong>Restore your last draft?</strong>' +
          '<span class="pmg-draft-recovery-meta">Saved ' + escapeHtml(relativeAge(snap.ts)) +
            (preview ? ' — &ldquo;' + escapeHtml(preview) + '&rdquo;' : '') + '</span>' +
        '</div>' +
        '<div class="pmg-draft-recovery-actions">' +
          '<button type="button" class="pmg-draft-recovery-restore">Restore</button>' +
          '<button type="button" class="pmg-draft-recovery-dismiss" aria-label="Dismiss">Dismiss</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bar);
    bar.querySelector('.pmg-draft-recovery-restore').addEventListener('click', function () {
      // dr-1 race fix: if the user already started a new prompt while
      // the 250ms-deferred banner was animating in, do NOT silently
      // clobber their fresh typing. Confirm before overwriting; if they
      // decline we keep their new work and clear the draft offer.
      var goal = document.getElementById('goal');
      var liveText = (goal && goal.value || '').trim();
      if (liveText) {
        var ok = window.confirm('You\'ve started typing a new prompt. Replace it with your saved draft?');
        if (!ok) {
          clearDraft();
          bar.remove();
          return;
        }
      }
      // Mirror to sessionStorage so subsequent writes don't blow away
      // the restored state, then run the same restore path.
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(snap)); } catch (e) {}
      restoreSession(snap);
      bar.remove();
    });
    bar.querySelector('.pmg-draft-recovery-dismiss').addEventListener('click', function () {
      clearDraft();
      try { localStorage.setItem(DRAFT_DISMISS_KEY, String(Date.now())); } catch (e) {}
      bar.remove();
    });
  }
  function wireDraftRecovery() {
    if (persistDisabled()) return;
    // dr-1 fix: register the vault-saved auto-clear UNCONDITIONALLY
    // (not gated on having a draft at boot). A user who lands fresh,
    // types a new prompt, then saves to the Vault would otherwise see
    // a stale "Restore?" banner on their next visit because the
    // listener was never wired.
    document.addEventListener('pmg:vault-saved', function () {
      clearDraft();
      var live = document.getElementById('pmg-draft-recovery');
      if (live) live.remove();
    });
    // If sessionStorage already has a session, the in-tab restore path
    // runs and we don't need the banner. Only offer recovery for tabs
    // that booted clean.
    if (readSession()) return;
    var snap = readDraft();
    if (!snap) return;
    // If the user explicitly dismissed within the last 5 minutes, don't
    // re-show on a quick reload. After 5 min, treat as a new session.
    try {
      var dts = parseInt(localStorage.getItem(DRAFT_DISMISS_KEY) || '0', 10);
      if (dts && (Date.now() - dts) < 5 * 60 * 1000) return;
    } catch (e) {}
    // Defer one tick so chassis paint has settled before the banner
    // animates in.
    setTimeout(function () { showDraftBanner(snap); }, 250);
  }

  function restoreSession(snap) {
    try {
      var goal = document.getElementById('goal');
      if (goal && snap.goal) {
        goal.value = snap.goal;
        goal.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (snap.tuning) {
        TUNE_FIELDS.forEach(function (id) {
          var sel = document.getElementById(id);
          if (!sel) return;
          var v = snap.tuning[id];
          if (typeof v !== 'string') return;
          var ok = false;
          for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === v) { ok = true; break; }
          }
          if (!ok) return;
          sel.value = v;
          try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        });
      }
      if (snap.prompt) {
        var rb = document.getElementById('resultBox');
        if (rb) {
          rb.textContent = snap.prompt;
          // Reveal the result box + Run-with-AI button using the same
          // sequence the Generate handler uses, so the restored prompt
          // is visible immediately on reload.
          var box = document.getElementById('prompt-output-box');
          if (box) {
            box.classList.remove('is-collapsed');
            box.removeAttribute('hidden');
            box.style.setProperty('display', 'block', 'important');
          }
          var rwa = document.getElementById('run-with-ai-btn');
          if (rwa) {
            rwa.style.setProperty('display', 'block', 'important');
            rwa.removeAttribute('hidden');
          }
          document.body.classList.add('pmg-has-result');
        }
      }
      // If there was a goal OR prompt, reveal the post-analyze surface
      // so the user lands back where they left off.
      if (snap.goal || snap.prompt) {
        var t = document.getElementById('tuning-panel');
        var g = document.getElementById('generate-section');
        if (t) { t.classList.remove('is-collapsed'); t.removeAttribute('hidden'); t.style.removeProperty('display'); }
        if (g) { g.classList.remove('is-collapsed'); g.removeAttribute('hidden'); g.style.removeProperty('display'); }
        var aBtn = document.getElementById('analyze-btn');
        if (aBtn) aBtn.style.display = 'none';
        document.body.classList.add('pmgv3-analyzed');
      }
    } catch (e) {}
  }

  /* cv3-51 — Return-toast watcher for Send-to-platform clicks.
     The send is silent (no toast when tab opens) so logged-in users
     whose prefill works never see a useless message. If the user
     returns to PMG within 60s, that strongly suggests the prefill
     didn't take (or they bounced) — show a single helpful nudge:
     "Your prompt is still on your clipboard — paste it when ready."
     One-shot per launch, single shared visibilitychange listener. */
  var _rtArmedAt = 0;
  var _rtHooked = false;
  function armReturnToast(/* destLabel */) {
    _rtArmedAt = Date.now();
    if (_rtHooked) return;
    _rtHooked = true;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (!_rtArmedAt) return;
      var elapsed = Date.now() - _rtArmedAt;
      if (elapsed > 60000) { _rtArmedAt = 0; return; }
      _rtArmedAt = 0;
      setTimeout(function () {
        flash('\u2713 Your prompt is still on your clipboard \u2014 paste it when you\u2019re ready.');
      }, 200);
    });
  }

  function wireActions() {
    // Analyze: reveal tuning + generate
    var analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', function () {
        var t = document.getElementById('tuning-panel');
        var g = document.getElementById('generate-section');
        document.body.classList.add('pmgv3-analyzed');
        if (t) {
          t.classList.remove('is-collapsed');
          t.removeAttribute('hidden');
          t.style.removeProperty('display');
          /* cv3-47: tuning accordion always starts COLLAPSED after Analyze
             — on desktop AND mobile. The "AI tuned N picks" badge in the
             header tells the user the AI made selections; they don't have
             to see them to proceed. They can expand by clicking the
             header. This eliminates the "two equally prominent green
             buttons" problem on first-time analysis. */
          t.classList.remove('is-mobile-open');
          /* cv3-47: keep ARIA state synchronized in case the user
             expanded the accordion on a previous analysis pass. */
          var ariaToggle = document.getElementById('tuning-mobile-toggle');
          if (ariaToggle) ariaToggle.setAttribute('aria-expanded', 'false');
        }
        if (g) { g.classList.remove('is-collapsed'); g.removeAttribute('hidden'); g.style.removeProperty('display'); }
        var gbShow = document.getElementById('generateBtn');
        if (gbShow) { gbShow.style.removeProperty('display'); gbShow.removeAttribute('data-pmgv3-collapsed'); }
        var spShow = document.getElementById('settingsPanel');
        if (spShow) { spShow.style.removeProperty('display'); spShow.removeAttribute('data-pmgv3-collapsed'); }
        /* cv3-47: replace the loud "→ Analyze My Idea" button with a
           tiny low-contrast "← Re-analyze" text link. Power users can
           still re-run analysis; the green Generate button below is now
           the only prominent CTA on screen. Idempotent — second click
           on the link no-ops the injection. */
        try {
          if (analyzeBtn.style.display !== 'none') {
            analyzeBtn.style.display = 'none';
          }
          if (!document.getElementById('pmgv3-reanalyze')) {
            var link = document.createElement('button');
            link.type = 'button';
            link.id = 'pmgv3-reanalyze';
            link.className = 'pmgv3-reanalyze';
            link.textContent = '← Re-analyze';
            link.addEventListener('click', function () { analyzeBtn.click(); });
            analyzeBtn.parentNode.insertBefore(link, analyzeBtn.nextSibling);
          }
        } catch (e) {}
        /* cv3-47: subtle "Ready" label above the Generate button so the
           user understands the analysis step has completed and Generate
           is the next action. Inserted once. */
        try {
          if (g && !document.getElementById('pmgv3-ready-label')) {
            var ready = document.createElement('div');
            ready.id = 'pmgv3-ready-label';
            ready.className = 'pmgv3-ready-label';
            ready.textContent = '✓ Ready — your settings are tuned';
            g.insertBefore(ready, g.firstChild);
          }
        } catch (e) {}
        // Trigger existing auto-optimize logic if available so pills pre-fill
        try {
          var autoOpt = document.getElementById('auto-optimize-toggle');
          if (autoOpt && !autoOpt.checked) autoOpt.click();
        } catch (e) {}
        try {
          if (window.pmgAutoOptimize && typeof window.pmgAutoOptimize === 'function') {
            window.pmgAutoOptimize();
          }
        } catch (e) {}
        // cv3-30 audit 2.1: AI auto-picks tuning defaults so the user can hit
        // Generate immediately. Calls /api/auto-tune with the idea text and
        // sets each <select>.value + dispatches change so the existing pill
        // sync repaints. Falls back silently on error — user can still tune
        // manually. Disable hatches: ?noautotune or localStorage.pmg_autotune_disable.
        try { autoTuneFromIdea(); } catch (e) {}
        /* cv3-47: scroll to the Generate section, not the tuning section.
           Generate is the next action; the collapsed tuning header is
           visible just above it. */
        if (g) g.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    // Generate (legacy submit): explicitly fire form submit since form-attribute
    // association across reparented DOM is unreliable, then reveal Box 1.
    var genBtn = document.getElementById('generateBtn');
    if (genBtn) {
      genBtn.addEventListener('click', function (e) {
        // Prevent native form-attribute submission — we explicitly call
        // form.requestSubmit() below. Without this, browsers honoring the
        // [form="prompt-form"] association would fire submit twice (one
        // native, one from requestSubmit), causing duplicate API calls.
        e.preventDefault();
        // Reveal Box 1 immediately so the user sees feedback. The box
        // is rendered with inline `style="display:none !important"` so
        // we force-override with setProperty('display','block','important')
        // — clearing the property string-style is unreliable across
        // browsers when !important was set inline.
        var box = document.getElementById('prompt-output-box');
        if (box) {
          box.classList.remove('is-collapsed');
          box.removeAttribute('hidden');
          box.style.setProperty('display', 'block', 'important');
        }
        // Belt-and-braces: explicitly unhide the Run with AI button.
        // Some legacy scripts have been seen leaving display:none on it.
        var rwa = document.getElementById('run-with-ai-btn');
        if (rwa) {
          rwa.style.setProperty('display', 'block', 'important');
          rwa.removeAttribute('hidden');
        }
        // Explicitly fire submit on #prompt-form. The button was reparented out
        // of the form so HTML5 form-attribute association is unreliable; the
        // form itself lives in body (moved by reparent() step 0) so its
        // submit listener (app.html ~L8843) is still bound. requestSubmit()
        // dispatches the submit event and the legacy handler runs as normal.
        var form = document.getElementById('prompt-form');
        if (form && typeof form.requestSubmit === 'function') {
          try { form.requestSubmit(); }
          catch (err) { try { form.submit(); } catch (e2) {} }
        } else if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
        setTimeout(mirrorStrength, 350);
      });
    }
    // cv3-30 audit 2.1 helper: ask the server to pick the best tuning defaults
    // for this idea and apply them. No-op if the user disabled it via
    // ?noautotune or localStorage.pmg_autotune_disable='1', or if the idea is
    // too short to be meaningful.
    function autoTuneFromIdea() {
      try {
        var loc = (window.location && window.location.search) || '';
        if (/[?&]noautotune\b/.test(loc)) return;
        if (localStorage.getItem('pmg_autotune_disable') === '1') return;
      } catch (e) {}
      var goal = document.getElementById('goal');
      var idea = goal && goal.value ? String(goal.value).trim() : '';
      if (idea.length < 4) return;
      var statusBadge = document.getElementById('tuning-pick-count');
      var prevText = statusBadge ? statusBadge.textContent : '';
      if (statusBadge) {
        statusBadge.textContent = 'AI tuning…';
        statusBadge.style.background = 'rgba(0, 200, 150, 0.2)';
      }
      /* cv3-48: snapshot the user's pre-analyze tuning state so we can
         offer a "↺ Revert to my selections" link if the AI overwrites
         picks. Only render the link when at least one field actually
         changed AND the user had at least one non-default selection
         before analyze (otherwise there's nothing meaningful to undo). */
      var TUNE_FIELDS = ['category', 'skillLevel', 'tone', 'outputFormat', 'maxLength', 'outputLanguage', 'personality'];
      var snapshot = {};
      var hadManualSelection = false;
      TUNE_FIELDS.forEach(function (id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        snapshot[id] = sel.value;
        if (sel.value && sel.selectedIndex > 0) hadManualSelection = true;
      });
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timeoutId = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
      fetch('/api/auto-tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea }),
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data || !data.ok || !data.picks) return;
          var picks = data.picks;
          var anyChanged = false;
          TUNE_FIELDS.forEach(function (id) {
            var sel = document.getElementById(id);
            if (!sel) return;
            var v = picks[id];
            if (typeof v !== 'string') return;
            // Verify the value exists as an <option> before assigning so we
            // don't silently set an invalid select state.
            var ok = false;
            for (var i = 0; i < sel.options.length; i++) {
              if (sel.options[i].value === v) { ok = true; break; }
            }
            if (!ok) return;
            if (sel.value === v) return;
            sel.value = v;
            anyChanged = true;
            try { sel.dispatchEvent(new Event('change', { bubbles: true })); }
            catch (err) {
              var evt = document.createEvent('HTMLEvents');
              evt.initEvent('change', true, false);
              sel.dispatchEvent(evt);
            }
          });
          if (anyChanged && hadManualSelection) {
            try { mountRevertTuningLink(snapshot); } catch (e) {}
          }
        })
        .catch(function () {
          // Silent fail — user can still tune manually.
        })
        .then(function () {
          clearTimeout(timeoutId);
          if (statusBadge) {
            statusBadge.style.removeProperty('background');
            statusBadge.textContent = prevText || '';
          }
        });
    }

    /* cv3-48 — Reset & Navigation suite: Clear / Undo / Start Over / Home.
       Spec: "PromptMeGood: Navigation & Reset Specification" (May 8, 2026).
       Each function is independent and idempotent; safe to call repeatedly. */
    function mountRevertTuningLink(snap) {
      var hdr = document.getElementById('tuning-mobile-toggle');
      if (!hdr) return;
      var existing = document.getElementById('pmgv3-revert-tuning');
      if (existing) existing.remove();
      var link = document.createElement('button');
      link.type = 'button';
      link.id = 'pmgv3-revert-tuning';
      link.className = 'pmgv3-revert-tuning';
      link.textContent = '↺ Revert to my selections';
      link.title = 'Restore the tuning you had selected before Analyze';
      link.addEventListener('click', function (ev) {
        // Header is a button — stop the click from bubbling and toggling
        // the accordion open/close.
        ev.stopPropagation();
        ev.preventDefault();
        Object.keys(snap).forEach(function (id) {
          var sel = document.getElementById(id);
          if (!sel) return;
          if (sel.value === snap[id]) return;
          sel.value = snap[id];
          try { sel.dispatchEvent(new Event('change', { bubbles: true })); }
          catch (err) {
            var evt = document.createEvent('HTMLEvents');
            evt.initEvent('change', true, false);
            sel.dispatchEvent(evt);
          }
        });
        link.remove();
      });
      // Insert AFTER the header button so it sits inside the tuning section
      // but doesn't get swallowed by the header's click target.
      hdr.parentNode.insertBefore(link, hdr.nextSibling);
    }

    // cv3-61: Total Reset — extends doStartOver to clear every piece of
    // state the user can touch (pills, image/video goals, whisperer,
    // strength bar, auto-boost buttons, length warning, run button).
    // Called from doStartOver() AFTER the original reset cascade so any
    // single missing element doesn't break the rest of the chain.
    function performTotalReset() {
      // 1. Clear secondary text inputs/textareas (the main #goal is
      //    handled by the legacy doStartOver block below).
      ['pmg-vs-image-goal', 'pmg-vs-video-goal', 'pmg-vs-image-refined', 'pmg-vs-video-refined', 'whisperer-input', 'quick-entry'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        try {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e) {}
      });
      // 1b. Clear #resultBox (contenteditable <div>, not a textarea).
      var rbEl = document.getElementById('resultBox');
      if (rbEl) {
        try { rbEl.textContent = ''; } catch (e) {}
        try { rbEl.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      }
      // 1c. Whisperer: rotate placeholder + clear input.
      try { if (window.PMGSpark && typeof window.PMGSpark.reset === 'function') window.PMGSpark.reset(); } catch (e) {}
      // 2. Reset all pills across the three flavors:
      //    - .pmg-pill / .pmg-tune-pill (text panel)        → .is-active class
      //    - .pmg-photo-pill (photo suite)                  → .is-active + aria-pressed
      //    - .pmg-vs-pill (Sora video)                      → aria-pressed
      document.querySelectorAll('.pmg-pill.is-active, .pmg-tune-pill.is-active, .pmg-photo-pill.is-active').forEach(function (p) {
        p.classList.remove('is-active');
        if (p.hasAttribute('aria-pressed')) p.setAttribute('aria-pressed', 'false');
      });
      document.querySelectorAll('.pmg-vs-pill[aria-pressed="true"], .pmg-photo-pill[aria-pressed="true"]').forEach(function (p) {
        p.setAttribute('aria-pressed', 'false');
        p.classList.remove('is-active');
      });
      // 2b. Pro Tuning boost/mode toggles in the visual studio.
      document.querySelectorAll('[data-vs-pro-boost][aria-pressed="true"]').forEach(function (b) {
        b.setAttribute('aria-pressed', 'false');
      });
      document.querySelectorAll('input[data-vs-pro-mode]:checked').forEach(function (c) {
        c.checked = false;
        try { c.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
      });
      // 3. Tuning pick-count badge — clear so it shows "0 picks" cleanly.
      var pickBadge = document.querySelector('.tuning-pick-count, .tuning-badge');
      if (pickBadge) {
        try { pickBadge.textContent = ''; } catch (e) {}
      }
      // 5. Strength bar: zero the fill, restore default status, hide the
      //    container (it should not be visible on a fresh load).
      var sFill = document.getElementById('strength-fill');
      if (sFill) {
        sFill.style.width = '0%';
        sFill.style.removeProperty('background-color');
      }
      var sStatus = document.getElementById('strength-status');
      if (sStatus) sStatus.textContent = 'Analyzing…';
      var sBadge = document.getElementById('strength-score-badge');
      if (sBadge) sBadge.textContent = '--';
      var sPct = document.getElementById('strength-score-pct');
      if (sPct) sPct.textContent = '0';
      var sSlot = document.getElementById('pmgv3-strength-slot');
      if (sSlot) sSlot.style.setProperty('display', 'none', 'important');
      // 6. Auto-Boost buttons (per-panel: text/photo/video).
      ['pmg-ab-btn-text', 'pmg-ab-btn-photo', 'pmg-ab-btn-video'].forEach(function (id) {
        var ab = document.getElementById(id);
        if (!ab) return;
        ab.classList.remove('is-boosted', 'boosted-state', 'is-loading');
        ab.disabled = false;
        ab.removeAttribute('aria-busy');
        ab.style.removeProperty('opacity');
        // Restore the default label (text panel uses "Auto-Boost Prompt",
        // photo/video panels use "Auto-Boost Brief"). Only rewrite if it
        // was changed (e.g. "Boosting…", "✓ Boosted").
        // Note: pmg-auto-boost.js renders the sparkle as a separate
        // <span class="pmg-ab-spark"> sibling, so the label text itself
        // does NOT include a sparkle (avoids the "✨✨" duplicate).
        // The span is preserved across resets — we only touch the
        // .pmg-ab-label child here when restoring.
        var label = (id === 'pmg-ab-btn-text') ? 'Auto-Boost Prompt' : 'Auto-Boost Brief';
        if (ab.textContent && /boost(ing|ed)|\u2713|too|loading/i.test(ab.textContent)) {
          // Preserve the .pmg-ab-spark icon span by only rewriting the
          // .pmg-ab-label child, not the whole textContent.
          var lblSpan = ab.querySelector('.pmg-ab-label');
          if (lblSpan) {
            lblSpan.textContent = label;
          } else {
            ab.textContent = label;
          }
        }
      });
      // 6b. Remove any inline auto-boost clarifier cards left on screen.
      document.querySelectorAll('.pmg-ab-card').forEach(function (c) { c.remove(); });
      // 7. Run-With-AI button: clear the "too large" stuck state.
      [document.getElementById('runBtn'), document.getElementById('run-with-ai-btn')].forEach(function (btn) {
        if (!btn) return;
        btn.disabled = false;
        btn.style.removeProperty('opacity');
        btn.removeAttribute('aria-disabled');
        if (btn.textContent && /too large|prompt too|running/i.test(btn.textContent)) {
          btn.textContent = (btn.id === 'run-with-ai-btn') ? '\u25B6 Run With AI Here' : '\u25B6 Run With AI';
        }
      });
      // 8. Hide the inline length warning.
      var lw = document.getElementById('pmgv3-length-warning');
      if (lw) lw.style.display = 'none';
      // 8b. Epic Tuning controls (added by mountEpicTextTuning) — these
      //     persist to localStorage, so a true "Total Reset" must clear
      //     both the inputs AND the storage keys, otherwise reasoning
      //     framework + audience + fact-check toggle stick across resets.
      try {
        var epicSel = document.getElementById('pmgv3-reasoning-select');
        if (epicSel) {
          epicSel.value = 'standard';
          try { epicSel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        }
        var epicCC = document.getElementById('pmgv3-calibrated-confidence');
        if (epicCC) {
          epicCC.checked = false;
          try { epicCC.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        }
        var epicTA = document.getElementById('pmgv3-target-audience');
        if (epicTA) {
          epicTA.value = '';
          try { epicTA.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
        }
        try { localStorage.removeItem('pmgv3:epic:reasoning'); } catch (e) {}
        try { localStorage.removeItem('pmgv3:epic:confidence'); } catch (e) {}
        try { localStorage.removeItem('pmgv3:epic:audience'); } catch (e) {}
      } catch (e) {}
      // 9. Drop the visible photo/video result boxes back to their empty
      //    placeholders so the right column doesn't keep stale media.
      ['pmg-vs-generated-image', 'pmg-vs-generated-video'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          if (el.tagName === 'IMG') el.removeAttribute('src');
          if (el.tagName === 'VIDEO') { try { el.pause(); } catch (e) {} el.removeAttribute('src'); el.load && el.load(); }
          el.style.setProperty('display', 'none', 'important');
        }
      });
      ['pmg-vs-image-placeholder', 'pmg-vs-video-placeholder'].forEach(function (id) {
        var ph = document.getElementById(id);
        if (ph) ph.style.removeProperty('display');
      });
    }

    function doStartOver() {
      // cv3-49: drop the persisted session AND suspend the persistence
      // layer for ~700ms so the cascade of input/change events fired by
      // the reset below doesn't immediately re-write a half-empty
      // session (default-tuning-but-no-goal) back into sessionStorage.
      _persistSuspended = true;
      try { clearSession(); } catch (e) {}
      setTimeout(function () {
        _persistSuspended = false;
        // Final clear in case anything slipped through.
        try { clearSession(); } catch (e) {}
      }, 700);
      // 1. Clear the goal textarea
      var goal = document.getElementById('goal');
      if (goal) {
        goal.value = '';
        goal.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // 2. Reset all tuning selects to their default (first option) and
      //    notify listeners so the pill UI repaints.
      var TUNE_FIELDS = ['category', 'skillLevel', 'tone', 'outputFormat', 'maxLength', 'outputLanguage', 'personality'];
      TUNE_FIELDS.forEach(function (id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        if (sel.options && sel.options.length) {
          sel.selectedIndex = 0;
          try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        }
      });
      // 3. Hide result panel + AI response
      document.body.classList.remove('pmg-has-result', 'pmgv3-analyzed');
      var box = document.getElementById('prompt-output-box');
      if (box) {
        box.classList.add('is-collapsed');
        box.style.setProperty('display', 'none', 'important');
      }
      var air = document.getElementById('aiResponseSection');
      if (air) {
        air.setAttribute('hidden', '');
        air.style.setProperty('display', 'none', 'important');
      }
      /* cv3-48 fix: also collapse the v3 wrapper for the AI response
         (#ai-response-box). #aiResponseSection is the legacy node; the
         wrapper is what's actually visible after Run with AI. Without
         this Start Over leaves an empty mint-bordered box on screen. */
      var airBox = document.getElementById('ai-response-box');
      if (airBox) {
        airBox.classList.add('is-collapsed');
        airBox.setAttribute('hidden', '');
        airBox.style.setProperty('display', 'none', 'important');
      }
      // 4. Hide tuning + generate sections
      ['tuning-panel', 'generate-section'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.classList.add('is-collapsed');
        el.classList.remove('is-mobile-open');
        el.style.setProperty('display', 'none', 'important');
      });
      // 5. Restore Analyze button + drop the post-analyze adornments
      var aBtn = document.getElementById('analyze-btn');
      if (aBtn) aBtn.style.removeProperty('display');
      var rl = document.getElementById('pmgv3-reanalyze'); if (rl) rl.remove();
      var rdy = document.getElementById('pmgv3-ready-label'); if (rdy) rdy.remove();
      var rev = document.getElementById('pmgv3-revert-tuning'); if (rev) rev.remove();
      // 6. Scroll to the top of the form
      try {
        var form = document.querySelector('.idea-section') || document.body;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_e) {}
      }
      // 7. cv3-61: Total Reset extras — pills, secondary inputs, strength
      //    bar, auto-boost buttons, length warning, run button, etc.
      //    Wrapped in try/catch so any single failure can't break focus().
      try { performTotalReset(); } catch (e) {}
      if (goal) { try { goal.focus(); } catch (e) {} }
    }
    // Expose for tests / external callers.
    window.pmgChassisV3 = window.pmgChassisV3 || {};
    window.pmgChassisV3.totalReset = performTotalReset;
    // Expose so other scripts (or the home-button handler) can call it.
    window.pmgChassisV3 = window.pmgChassisV3 || {};
    window.pmgChassisV3.startOver = doStartOver;

    // ===================================================================
    // cv3-58 — Text Prompting Suite "Epic" upgrade
    // ===================================================================
    // Three new client-side controls injected into the v3 tuning section:
    //   1. Reasoning framework <select>  (Standard / CoT / CAD / MPS)
    //   2. Strict Fact-Checking switch   (calibrated-confidence directive)
    //   3. Target-audience text <input>  (persona injector)
    //
    // None of these touch the legacy #settingsPanel selects — they live
    // in their own #pmgv3-epic-tuning container ABOVE the legacy panel.
    // At submit time a capture-phase listener on #prompt-form temporarily
    // appends the chosen directives to #goal.value and restores the
    // original value in a microtask. Same mutate-and-restore pattern that
    // pmg-pro.js's Brand Voice injector already uses (documented at
    // app.html ~L8842).
    var EPIC_REASONING_DIRECTIVE = {
      cot: 'Before providing the final answer, please think step-by-step. Break down your reasoning process clearly.',
      cad: 'Please solve this by: 1) Identifying the core components of the problem. 2) Solving each component individually. 3) Synthesizing the partial solutions into a holistic final answer.',
      mps: 'Please analyze this from at least 3 distinct perspectives. For each, articulate its core assumptions and strongest arguments before providing an integrated conclusion.'
    };
    var EPIC_REASONING_HINTS = {
      standard: 'Standard: Fast and direct — best when you just want the answer.',
      cot:      'Step-by-Step: Forces the AI to show its work — best for math, logic, or planning.',
      cad:      'Break It Down: Decomposes a big problem into parts then synthesizes — best for massive, complex projects.',
      mps:      'Multiple Perspectives: Forces the AI to argue 3+ angles before concluding — best for debates or strategy.'
    };
    var EPIC_CONFIDENCE_DIRECTIVE = 'For each factual claim you make, assign an explicit confidence level (e.g., Highly Confident, Speculative, Unknown). Prioritize accurate confidence calibration over making definitive statements. If you do not know, explicitly state that you lack sufficient information.';
    var EPIC_AUDIENCE_DIRECTIVE_TPL = 'Tailor your vocabulary, tone, and examples specifically for this target audience: ';

    function buildEpicTextTuningHtml() {
      return [
        '<div class="pmgv3-reasoning-frameworks">',
          '<label class="pmgv3-section-label" for="pmgv3-reasoning-select">How should the AI think?</label>',
          '<select id="pmgv3-reasoning-select" class="pmgv3-select">',
            '<option value="standard">Standard (Just give me the answer)</option>',
            '<option value="cot">Step-by-Step (Best for math, logic, or planning)</option>',
            '<option value="cad">Break It Down (Best for massive, complex projects)</option>',
            '<option value="mps">Multiple Perspectives (Best for debates or strategy)</option>',
          '</select>',
          '<p class="pmgv3-style-hint" id="pmgv3-reasoning-hint">' + EPIC_REASONING_HINTS.standard + '</p>',
        '</div>',
        '<div class="pmgv3-confidence-toggle">',
          '<label class="pmgv3-switch">',
            '<input type="checkbox" id="pmgv3-calibrated-confidence">',
            '<span class="pmgv3-slider"></span>',
          '</label>',
          '<div class="pmgv3-switch-text">',
            '<span class="pmgv3-switch-label">Strict Fact-Checking Mode</span>',
            '<p class="pmgv3-switch-hint">Forces the AI to tell you how confident it is in each claim, and to admit when it doesn\'t know — instead of guessing.</p>',
          '</div>',
        '</div>',
        '<div class="pmgv3-audience-injector">',
          '<label class="pmgv3-section-label" for="pmgv3-target-audience">Who is this for?</label>',
          '<input type="text" id="pmgv3-target-audience" class="pmgv3-input" placeholder="e.g. busy small-business owners, 5th-grade students, senior engineers" maxlength="200" autocomplete="off" />',
          '<p class="pmgv3-style-hint">The AI will automatically adjust its vocabulary, tone, and examples to match.</p>',
        '</div>'
      ].join('');
    }
    function mountEpicTextTuning() {
      var host = document.getElementById('pmgv3-epic-tuning');
      if (!host || host.getAttribute('data-mounted') === '1') return;
      host.innerHTML = buildEpicTextTuningHtml();
      host.setAttribute('data-mounted', '1');
      try {
        var sel = document.getElementById('pmgv3-reasoning-select');
        var saved = localStorage.getItem('pmgv3:epic:reasoning');
        if (sel && saved && EPIC_REASONING_HINTS[saved]) sel.value = saved;
        if (sel) {
          var hint = document.getElementById('pmgv3-reasoning-hint');
          if (hint) hint.textContent = EPIC_REASONING_HINTS[sel.value] || EPIC_REASONING_HINTS.standard;
          sel.addEventListener('change', function () {
            try { localStorage.setItem('pmgv3:epic:reasoning', sel.value); } catch (_) {}
            var h = document.getElementById('pmgv3-reasoning-hint');
            if (h) h.textContent = EPIC_REASONING_HINTS[sel.value] || EPIC_REASONING_HINTS.standard;
          });
        }
        var cc = document.getElementById('pmgv3-calibrated-confidence');
        var ccSaved = localStorage.getItem('pmgv3:epic:confidence');
        if (cc && ccSaved === '1') cc.checked = true;
        if (cc) cc.addEventListener('change', function () {
          try { localStorage.setItem('pmgv3:epic:confidence', cc.checked ? '1' : '0'); } catch (_) {}
        });
        var ta = document.getElementById('pmgv3-target-audience');
        var taSaved = localStorage.getItem('pmgv3:epic:audience');
        if (ta && taSaved) ta.value = taSaved;
        if (ta) ta.addEventListener('input', function () {
          try { localStorage.setItem('pmgv3:epic:audience', ta.value); } catch (_) {}
        });
      } catch (_) {}
    }
    function collectEpicDirectives() {
      var out = [];
      var sel = document.getElementById('pmgv3-reasoning-select');
      if (sel && sel.value && EPIC_REASONING_DIRECTIVE[sel.value]) {
        out.push(EPIC_REASONING_DIRECTIVE[sel.value]);
      }
      var cc = document.getElementById('pmgv3-calibrated-confidence');
      if (cc && cc.checked) out.push(EPIC_CONFIDENCE_DIRECTIVE);
      var ta = document.getElementById('pmgv3-target-audience');
      var aud = ta && ta.value && ta.value.trim();
      if (aud) out.push(EPIC_AUDIENCE_DIRECTIVE_TPL + aud);
      return out;
    }
    function attachEpicDirectivesInjector() {
      var form = document.getElementById('prompt-form');
      if (!form || form.getAttribute('data-pmgv3-epic-injector') === '1') return;
      form.setAttribute('data-pmgv3-epic-injector', '1');
      // Capture phase so we mutate BEFORE the legacy bubble-phase
      // submit handler at app.html ~L8840 reads getFormData(). Restore
      // the original goal text in a microtask — by then getFormData()
      // has already captured the mutated value, but the user never sees
      // the appended directives in their textarea.
      form.addEventListener('submit', function () {
        var goal = document.getElementById('goal');
        if (!goal) return;
        var dirs = collectEpicDirectives();
        if (!dirs.length) return;
        var original = goal.value;
        var suffix = '\n\n' + dirs.join('\n\n');
        goal.value = original + suffix;
        Promise.resolve().then(function () {
          if (goal.value === original + suffix) goal.value = original;
        });
      }, true);
    }
    // Expose for tests / external callers.
    window.pmgChassisV3.mountEpicTextTuning = mountEpicTextTuning;
    window.pmgChassisV3.collectEpicDirectives = collectEpicDirectives;
    // Mount the epic-text controls + attach the submit-time directive
    // injector. Called inside wireActions() so the helper functions are
    // in scope (they're declared as inner functions above).
    mountEpicTextTuning();
    attachEpicDirectivesInjector();

    function mountStartOverLinks() {
      // (a) Below the Generate button, inside #generate-section.
      var gen = document.getElementById('generate-section');
      if (gen && !document.getElementById('pmgv3-startover-generate')) {
        var l1 = document.createElement('button');
        l1.type = 'button';
        l1.id = 'pmgv3-startover-generate';
        l1.className = 'pmgv3-startover';
        l1.textContent = '↩ Start Over';
        l1.addEventListener('click', doStartOver);
        gen.appendChild(l1);
      }
      // (b) At the bottom of the result panel.
      var box = document.getElementById('prompt-output-box');
      if (box && !document.getElementById('pmgv3-startover-result')) {
        var l2 = document.createElement('button');
        l2.type = 'button';
        l2.id = 'pmgv3-startover-result';
        l2.className = 'pmgv3-startover pmgv3-startover-result';
        l2.textContent = '↩ Start Over — build a new prompt';
        l2.addEventListener('click', doStartOver);
        box.appendChild(l2);
      }
    }
    mountStartOverLinks();

    // Goal-textarea ✕ (Clear) — only visible when the field has content.
    function wireGoalClear() {
      var clr = document.getElementById('pmgv3-goal-clear');
      var goal = document.getElementById('goal');
      if (!clr || !goal) return;
      function sync() {
        var hasText = goal.value && goal.value.length > 0;
        if (hasText) clr.removeAttribute('hidden');
        else clr.setAttribute('hidden', '');
      }
      sync();
      goal.addEventListener('input', sync);
      clr.addEventListener('click', function () {
        goal.value = '';
        goal.dispatchEvent(new Event('input', { bubbles: true }));
        try { goal.focus(); } catch (e) {}
        sync();
      });
    }
    // Reparent runs after buildShell, so #goal lives inside .pmgv3-idea-host
    // by the time wireActions fires. Poll briefly in case timing slips.
    (function pollGoalClear(n) {
      if (n > 30) return;
      if (document.getElementById('goal') && document.getElementById('pmgv3-goal-clear')) {
        wireGoalClear();
      } else {
        setTimeout(function () { pollGoalClear(n + 1); }, 200);
      }
    })(0);

    // Logo → Home: hard reset. Closes overlays, switches to Text tab, then
    // runs Start Over.
    var brandHome = document.getElementById('pmgv3-brand-home');
    if (brandHome) {
      brandHome.addEventListener('click', function () {
        window.location.href = '/';
      });
    }
    var navHome = document.getElementById('pmgv3-nav-home');
    if (navHome) {
      navHome.addEventListener('click', function () {
        window.location.href = '/';
      });
    }

    // cv3-30 audit 3.1: mobile accordion toggle for the text-panel tuning
    // section. Tap the header → expand/collapse #settingsPanel. Desktop
    // ignores the click handler effect because CSS doesn't gate visibility
    // on .is-mobile-open above 768px.
    var tuneToggle = document.getElementById('tuning-mobile-toggle');
    if (tuneToggle) {
      tuneToggle.addEventListener('click', function (e) {
        var sec = document.getElementById('tuning-panel');
        if (!sec) return;
        var open = sec.classList.toggle('is-mobile-open');
        tuneToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          // Smooth-scroll the now-expanded grid into view on mobile so the
          // user doesn't lose visual context.
          try {
            var sp = document.getElementById('settingsPanel');
            if (sp && sp.scrollIntoView) {
              setTimeout(function () { sp.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60);
            }
          } catch (err) {}
        }
      });
    }
    // Live pick-count badge so the collapsed header still tells the user
    // how many tuning choices are active.
    function updatePickCount() {
      var badge = document.getElementById('tuning-pick-count');
      if (!badge) return;
      var sp = document.getElementById('settingsPanel');
      if (!sp) { badge.textContent = ''; return; }
      var n = sp.querySelectorAll('.pmg-tune-pill.is-active, .pmg-pill.is-active').length;
      badge.textContent = n > 0 ? (n + ' pick' + (n === 1 ? '' : 's')) : '';
    }
    setInterval(updatePickCount, 1200);

    // Mirror strength on a polling tick so it stays current
    setInterval(mirrorStrength, 1500);

    // Re-assert generate button label on a tick — other scripts may overwrite text
    var GEN_LABEL = '✨ Generate My Prompt';
    setInterval(function () {
      var b = document.getElementById('generateBtn');
      if (b && rootEl.contains(b) && b.textContent.trim() !== GEN_LABEL) {
        b.textContent = GEN_LABEL;
      }
    }, 800);

    // Run with AI: reveal Box 2 + delegate to legacy #runBtn
    // run-reveal-1 (2026-05-12): users reported "clicking Run With AI Here
    // scrolls me to the ChatGPT/Claude buttons instead of running". Two
    // root causes:
    //   1. #ai-response-box ships with style="display:none !important" and
    //      #aiResponseSection can be inline-hidden via Start Over with
    //      !important. Plain `box.style.display = ''` and `.hidden = false`
    //      silently fail to clear !important inline declarations in some
    //      browsers/states. Result: outer box reveals but inner section
    //      stays hidden → zero-height response area → scrollIntoView lands
    //      on the empty box top, putting the send-to grid below it
    //      dominantly in view.
    //   2. The chassis scrolled the wrapper (block:'start') AND run() also
    //      scrolled aiResponseSection 50ms later — competing scrolls.
    // Fix: defensively removeProperty('display') on the box AND its inner
    // section AND the output. Drop the chassis-side scroll — let run()
    // handle the single authoritative scroll, which now centers on the
    // output element so the spinner/streaming text is visually dominant.
    var runBtn = document.getElementById('run-with-ai-btn');
    if (runBtn) {
      runBtn.addEventListener('click', function () {
        var box = document.getElementById('ai-response-box');
        var sec = document.getElementById('aiResponseSection');
        var outEl = document.getElementById('aiResponseOutput');
        if (box) {
          box.classList.remove('is-collapsed');
          box.removeAttribute('hidden');
          box.style.removeProperty('display');
          box.style.removeProperty('visibility');
        }
        if (sec) {
          sec.removeAttribute('hidden');
          sec.style.removeProperty('display');
          sec.style.removeProperty('visibility');
        }
        if (outEl) {
          outEl.removeAttribute('hidden');
          outEl.style.removeProperty('display');
          outEl.style.removeProperty('visibility');
        }
        var legacyRun = document.getElementById('runBtn');
        if (legacyRun) {
          legacyRun.click();
        } else if (typeof window.runWithAI === 'function') {
          window.runWithAI();
        }
        // No scroll here — run() owns the single authoritative scroll
        // 50ms after this returns. Two competing smooth-scrolls produced
        // a "lands on the wrong element" jitter on Safari.
      });
    }

    // Edit / Rewrite / Save Draft — wire to existing handlers if present
    bindIfPresent('edit-prompt-btn', function () {
      var rb = document.getElementById('resultBox');
      if (rb) { rb.focus(); document.execCommand && document.execCommand('selectAll', false, null); }
    });
    bindIfPresent('rewrite-btn', function () {
      // Re-submit the form
      var f = document.getElementById('prompt-form');
      if (f) {
        if (typeof f.requestSubmit === 'function') f.requestSubmit();
        else f.submit();
      }
    });
    bindIfPresent('save-draft-btn', function () {
      /* sd-vault-1: the legacy save selectors below (#save-vault-btn etc)
         don't exist anywhere in app.html — the previous implementation
         silently fell through to the localStorage 'pmgv3:lastDraft'
         branch, which writes nowhere the Vault drawer can ever surface.
         User reported "vault does nothing." Real save mechanism is
         window.__pmgText.addToHistory(data, prompt) (exposed in
         app.html L5851), which writes to the same #history list the
         drawer hosts AND fires the 'pmg:vault-saved' signal. Try
         that first; fall through to the legacy paths only if the
         workstation API hasn't loaded. */
      try {
        var rb1 = document.getElementById('resultBox');
        var prompt1 = (rb1 && rb1.textContent || '').trim();
        if (prompt1 && prompt1 !== 'Your fixed prompt will appear here.'
            && window.__pmgText
            && typeof window.__pmgText.addToHistory === 'function') {
          /* getFormData() is hoisted in app.html; if it's not on window,
             pass an empty-ish object — addToHistory tolerates it. */
          var data = {};
          try { if (typeof window.getFormData === 'function') data = window.getFormData() || {}; } catch (_e) {}
          window.__pmgText.addToHistory(data, prompt1);
          flash('Saved to Vault');
          return;
        }
      } catch (_e) {}
      var existing = document.querySelector('#save-vault-btn, #pmg-save-vault-btn, #savePromptBtn, [data-pmg-save-vault]');
      if (existing) existing.click();
      else {
        try {
          var rb = document.getElementById('resultBox');
          var draft = (rb && rb.textContent || '').trim();
          if (draft) {
            localStorage.setItem('pmgv3:lastDraft', JSON.stringify({ text: draft, savedAt: Date.now() }));
            flash('Draft saved locally');
          }
        } catch (e) {}
      }
    });

    // Send-to-platform buttons (Step 5A)
    var sendBtns = rootEl.querySelectorAll('.btn-send-to');
    Array.prototype.forEach.call(sendBtns, function (btn) {
      btn.addEventListener('click', function () {
        var rb = document.getElementById('resultBox');
        var prompt = (rb && rb.textContent || '').trim();
        if (!prompt || prompt === 'Your fixed prompt will appear here.') {
          flash('Generate a prompt first.');
          return;
        }
        var encoded = encodeURIComponent(prompt);
        /* cv3-51: Silent send. ChatGPT/Claude get real ?q= prefill;
           Gemini ignores ?q= so opens bare. Either way, copy to
           clipboard SILENTLY and arm a 60s return-toast — no toast
           when the tab opens. If the user comes back to PMG within
           60s (signal: prefill didn't take), the return-toast tells
           them their prompt is still on the clipboard. */
        var urls = {
          chatgpt: 'https://chatgpt.com/?q=' + encoded,
          claude: 'https://claude.ai/new?q=' + encoded,
          gemini: 'https://gemini.google.com/app',
          perplexity: 'https://www.perplexity.ai/search?q=' + encoded,
        };
        var platform = btn.dataset.pmgDest || btn.dataset.platform;
        var label = platform === 'chatgpt'    ? 'ChatGPT'
                  : platform === 'claude'     ? 'Claude'
                  : platform === 'gemini'     ? 'Gemini'
                  : platform === 'perplexity' ? 'Perplexity'
                  : platform;
        try { navigator.clipboard.writeText(prompt); } catch (e) {}
        if (urls[platform]) {
          armReturnToast(label);
          window.open(urls[platform], '_blank', 'noopener');
        }
      });
    });

    // Quick entry → mirror into #goal then trigger Analyze
    var qe = document.getElementById('quick-entry');
    var qsub = document.getElementById('quick-entry-submit');
    function submitQuick() {
      if (!qe) return;
      var val = qe.value.trim();
      if (!val) return;
      var goal = document.getElementById('goal');
      if (goal) {
        goal.value = val;
        goal.dispatchEvent(new Event('input', { bubbles: true }));
      }
      qe.value = '';
      var a = document.getElementById('analyze-btn');
      if (a) a.click();
    }
    if (qsub) qsub.addEventListener('click', submitQuick);
    if (qe) {
      qe.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submitQuick(); }
      });
    }

    // Module tabs — panel switcher (no modals)
    var tabs = rootEl.querySelectorAll('.pmgv3-tab');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        setActivePanel(tab.dataset.module);
      });
    });

    // Vault icon → open the vault drawer overlay (chassis-v3 hides the
    // legacy #history section via the body > * universal-hide rule, so a
    // simple delegated click never surfaced anything; we lazily build a
    // right-side drawer and reparent #history into it on first open).
    bindIfPresent('pmgv3-vault', function () { openVaultDrawer(); });

    /* no-theme-1: removed the #pmgv3-settings slot entirely. Was a
       gear → Expert (expert-topbar-1) → theme toggle (theme-toggle-1)
       progression that ended up redundant: Expert has its own ✦ button
       in the topbar, and the theme toggle was misleading because
       pmg-g-theme.css force-locks both [data-theme] values to the
       dark teal palette. openSettings() and #settingsPanel are still
       defined and remain reachable via any other entry points that
       call them. */
    bindIfPresent('pmgv3-upgrade', function () {
      // audit-2 H-3: deep-link straight to the founding-checkout card so the
      // user lands on the actual buy button instead of the top of the page
      // (where they'd have to scan past the hero + counter to find it). The
      // anchor ID is `founding-checkout-card` per pricing.html L580.
      window.location.href = '/pricing.html#founding-checkout-card';
    });

    /* H-1 (audit-2 deferred): mobile "More" menu. Lazily injects a small
       dropdown next to the ⋮ button containing the 4 icons (Guide /
       Growth / Vault / Settings) that are CSS-hidden at ≤480px. Each
       dropdown item dispatches a synthetic click on the (hidden)
       underlying button so all existing wiring (vault drawer, settings
       overlay, growth panel, guide tab) is reused — no duplicated
       handlers. Click-outside + Escape close. */
    bindIfPresent('pmgv3-more', function () {
      var moreBtn = document.getElementById('pmgv3-more');
      if (!moreBtn) return;
      var existing = document.getElementById('pmgv3-more-menu');
      if (existing) {
        /* Toggle-close path. The shared closer attached to the menu
           cleans up document listeners — calling it here ensures we
           don't leak them on rapid open→close→open cycles. */
        if (typeof existing.__pmgClose === 'function') existing.__pmgClose();
        else { existing.remove(); moreBtn.setAttribute('aria-expanded', 'false'); }
        return;
      }
      var menu = document.createElement('div');
      menu.id = 'pmgv3-more-menu';
      menu.setAttribute('role', 'menu');
      menu.innerHTML =
        '<button type="button" role="menuitem" data-pmg-more-target="pmgv3-help"><span aria-hidden="true">❓</span> Guide</button>' +
        '<button type="button" role="menuitem" data-pmg-more-target="pmgv3-business"><span aria-hidden="true">💼</span> Growth</button>' +
        '<button type="button" role="menuitem" data-pmg-more-target="pmgv3-vault"><span aria-hidden="true">🗄️</span> Vault</button>' +
        '<button type="button" role="menuitem" data-pmg-more-target="pmgv3-expert"><span aria-hidden="true">✦</span> Expert</button>';
      moreBtn.parentNode.appendChild(menu);
      moreBtn.setAttribute('aria-expanded', 'true');

      /* Shared closer used by every close path (item-click, outside-click,
         Escape, and the toggle-close branch above). Idempotent — safe to
         call twice. Removes both document listeners to avoid leaks. */
      function close() {
        moreBtn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', closeOnOutside, true);
        document.removeEventListener('keydown', closeOnEsc, true);
        if (menu.parentNode) menu.parentNode.removeChild(menu);
      }
      menu.__pmgClose = close;

      function closeOnOutside(ev) {
        if (ev.target === moreBtn || moreBtn.contains(ev.target)) return;
        if (menu.contains(ev.target)) return;
        close();
      }
      function closeOnEsc(ev) { if (ev.key === 'Escape') close(); }

      menu.addEventListener('click', function (e) {
        var item = e.target && e.target.closest && e.target.closest('[data-pmg-more-target]');
        if (!item) return;
        var targetId = item.getAttribute('data-pmg-more-target');
        var underlying = document.getElementById(targetId);
        close();
        if (underlying) {
          /* Use .click() so anchor (#pmgv3-help) follows href and
             buttons fire their bound handlers identically. */
          try { underlying.click(); } catch (_e) {}
        }
      });

      setTimeout(function () {
        document.addEventListener('click', closeOnOutside, true);
        document.addEventListener('keydown', closeOnEsc, true);
      }, 0);
    });

    /* L-C (audit-2 triage): swap "Lock In $79" → "Upgrade" once the open
       beta has ended. Until BETA_END the only paid action available is the
       Founding Member $79 one-time deal, so the more specific label is
       honest and reinforces scarcity. After BETA_END the full tier ladder
       (Pro / Pro Yearly / Pro Studio / Pro Studio Yearly) is live and
       "Upgrade" is the right umbrella term again. Reads BETA_END from
       window.PMG_PRICING (loaded via /api/pricing-config.js); silently
       no-ops if the config hasn't loaded yet — the default "Lock In $79"
       text is the safer fallback during beta. */
    try {
      var upBtn = document.getElementById('pmgv3-upgrade');
      var betaEndIso = (window.PMG_PRICING && window.PMG_PRICING.BETA_END) || '';
      if (upBtn && betaEndIso) {
        var betaEndMs = Date.parse(betaEndIso);
        if (isFinite(betaEndMs) && Date.now() >= betaEndMs) {
          upBtn.textContent = 'Upgrade';
          upBtn.title = 'See pricing — Founding Member, Pro, or Pro Studio';
        }
      }
    } catch (_e) {}
  }

  /* -------------------- Vault drawer overlay -------------------- */
  function ensureVaultDrawerStyles() {
    if (document.getElementById('pmgv3-vault-drawer-css')) return;
    var s = document.createElement('style');
    s.id = 'pmgv3-vault-drawer-css';
    s.textContent = [
      '#pmgv3-vault-overlay { position: fixed; inset: 0; z-index: 99990; background: rgba(0,0,0,0.55); opacity: 0; pointer-events: none; transition: opacity 0.18s ease; }',
      '#pmgv3-vault-overlay.is-open { opacity: 1; pointer-events: auto; }',
      '#pmgv3-vault-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 92vw); z-index: 99991; background: #0d2b1e; color: #e6f7ee; box-shadow: -8px 0 24px rgba(0,0,0,0.45); transform: translateX(100%); transition: transform 0.22s ease; display: flex; flex-direction: column; overflow: hidden; }',
      '#pmgv3-vault-overlay.is-open + #pmgv3-vault-drawer, #pmgv3-vault-drawer.is-open { transform: translateX(0); }',
      '.pmgv3-vault-drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.08); flex: 0 0 auto; }',
      '.pmgv3-vault-drawer-head h2 { margin: 0; font-size: 18px; color: #e6f7ee; }',
      '.pmgv3-vault-drawer-close { width: 36px; height: 36px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #e6f7ee; font-size: 18px; cursor: pointer; }',
      '.pmgv3-vault-drawer-close:hover { background: rgba(0,200,150,0.08); color: #00c896; }',
      '.pmgv3-vault-drawer-body { flex: 1 1 auto; overflow-y: auto; padding: 14px 18px 24px; }',
      /* mux-1: large bottom "Done" target for thumb-reach on mobile. Hidden
         on ≥769px (the top-right ✕ already lands well on desktop). */
      '.pmgv3-vault-drawer-done { display: none; }',
      '@media (max-width: 768px) {',
        '.pmgv3-vault-drawer-done { display: block; flex: 0 0 auto; width: 100%; padding: 14px 18px; background: #00c896; color: #0a2420; border: 0; border-top: 1px solid rgba(255,255,255,0.08); font-size: 16px; font-weight: 700; cursor: pointer; -webkit-tap-highlight-color: transparent; }',
        '.pmgv3-vault-drawer-done:active { background: #00b387; }',
      '}',
      /* When #history is hosted inside the drawer it must override the chassis universal-hide. */
      '#pmgv3-vault-drawer #history { display: block !important; visibility: visible !important; opacity: 1 !important; }',
      '#pmgv3-vault-drawer #history .panel { background: transparent; box-shadow: none; border: 0; padding: 0; }',
      '#pmgv3-vault-drawer #history .pmg-vault-toggle { display: none !important; }',
      '@media (max-width: 480px) { #pmgv3-vault-drawer { width: 100vw; } }'
    ].join('\n');
    document.head.appendChild(s);
  }
  function openVaultDrawer() {
    ensureVaultDrawerStyles();
    var overlay = document.getElementById('pmgv3-vault-overlay');
    var drawer  = document.getElementById('pmgv3-vault-drawer');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pmgv3-vault-overlay';
      overlay.setAttribute('data-pmg-overlay-root', '');
      overlay.addEventListener('click', closeVaultDrawer);
      document.body.appendChild(overlay);
    }
    if (!drawer) {
      drawer = document.createElement('aside');
      drawer.id = 'pmgv3-vault-drawer';
      /* MUST be set before append: the chassis `body > *:not(...)`
         universal-hide rule hides anything appended directly under
         <body> unless it carries `data-pmg-overlay-root`. The overlay
         above already has it; the drawer was missing it, so the
         drawer was added to the DOM with class `is-open` but
         `display: none / visibility: hidden` — the user saw nothing. */
      drawer.setAttribute('data-pmg-overlay-root', '');
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      drawer.setAttribute('aria-label', 'Prompt Vault');
      drawer.innerHTML = [
        '<div class="pmgv3-vault-drawer-head">',
          '<h2>🔒 Prompt Vault</h2>',
          '<button type="button" class="pmgv3-vault-drawer-close" aria-label="Close vault">✕</button>',
        '</div>',
        '<div class="pmgv3-vault-drawer-body" id="pmgv3-vault-drawer-body"></div>',
        '<button type="button" class="pmgv3-vault-drawer-done" aria-label="Close vault">Done</button>'
      ].join('');
      drawer.querySelector('.pmgv3-vault-drawer-close').addEventListener('click', closeVaultDrawer);
      drawer.querySelector('.pmgv3-vault-drawer-done').addEventListener('click', closeVaultDrawer);
      document.body.appendChild(drawer);
    }
    var body = document.getElementById('pmgv3-vault-drawer-body');
    var hist = document.getElementById('history');
    if (hist && body && hist.parentNode !== body) {
      body.appendChild(hist);
      // Force-expand if a previous session left it collapsed.
      var panel = hist.querySelector('.panel');
      if (panel) panel.classList.remove('pmg-vault-collapsed');
    }
    // Trigger a render of vault contents if the legacy script exposes one.
    try { if (typeof window.renderHistory === 'function') window.renderHistory(); } catch (_e) {}
    /* Resilience: if #history was never mounted (some script removed it
       or the chassis loaded before app.html parsed), avoid showing a
       blank drawer — render a friendly empty-state so the gear/vault
       interaction always reads as intentional. Idempotent: only fills
       when the drawer body has nothing in it. */
    if (body && !body.firstElementChild) {
      var es = document.createElement('div');
      es.id = 'pmgv3-vault-empty';
      es.style.cssText = 'padding: 28px 8px; text-align: center; color: #9bccb6; font-size: 14px; line-height: 1.55;';
      es.innerHTML = [
        '<div style="font-size: 36px; margin-bottom: 10px;" aria-hidden="true">🗄️</div>',
        '<div style="font-weight: 700; color: #e6f7ee; margin-bottom: 6px;">Your Vault Is Empty</div>',
        '<div>Generate a prompt and tap <strong style="color:#3ee0a0;">💾 Save Draft</strong> to keep it here for later.</div>'
      ].join('');
      body.appendChild(es);
    } else if (body) {
      // If real content is now present, remove any stale empty-state node.
      var stale = document.getElementById('pmgv3-vault-empty');
      if (stale && body.firstElementChild !== stale) try { stale.remove(); } catch (_e) {}
    }
    overlay.classList.add('is-open');
    drawer.classList.add('is-open');
    document.addEventListener('keydown', vaultDrawerEsc);
  }
  function closeVaultDrawer() {
    var overlay = document.getElementById('pmgv3-vault-overlay');
    var drawer  = document.getElementById('pmgv3-vault-drawer');
    if (overlay) overlay.classList.remove('is-open');
    if (drawer)  drawer.classList.remove('is-open');
    document.removeEventListener('keydown', vaultDrawerEsc);
  }
  function vaultDrawerEsc(e) { if (e.key === 'Escape') closeVaultDrawer(); }

  /* -------------------- Settings opener -------------------- */
  function openSettings() {
    try { setActivePanel('text'); } catch (_e) {}
    setTimeout(function () {
      var panel = document.getElementById('tuning-panel');
      if (panel) panel.classList.add('is-mobile-open');
      // Settings panel itself ships with inline display:none; force visible.
      var sp = document.getElementById('settingsPanel');
      if (sp) {
        sp.style.setProperty('display', 'block', 'important');
        try { sp.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_e) { sp.scrollIntoView(); }
        // Brief highlight pulse so the user sees where it landed.
        sp.style.transition = 'box-shadow 0.6s ease';
        sp.style.boxShadow = '0 0 0 3px rgba(0,200,150,0.45)';
        setTimeout(function () { sp.style.boxShadow = ''; }, 1200);
      } else {
        // Last-ditch: if no settingsPanel exists, surface the theme toggle.
        var theme = document.querySelector('[data-theme-toggle], .theme-toggle');
        if (theme) theme.click();
      }
    }, 60);
  }

  function mirrorStrength() {
    var pct = document.getElementById('strength-score-pct');
    var fill = document.getElementById('strength-fill');
    var badge = document.getElementById('strength-score-badge');
    var status = document.getElementById('strength-status');
    if (!pct) return;
    var val = parseInt(String(pct.textContent).replace(/[^0-9]/g, ''), 10);
    if (isNaN(val)) return;
    if (fill) fill.style.width = Math.min(100, Math.max(0, val)) + '%';
    if (badge) badge.textContent = String(val);
    if (status) {
      if (val >= 80) status.textContent = '⚡ Strong — Ready to Run';
      else if (val >= 50) status.textContent = '✓ Good — could be sharper';
      else status.textContent = 'Needs more detail';
    }
  }

  function bindIfPresent(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  function flash(msg) {
    var el = document.createElement('div');
    el.textContent = msg;
    /* MUST carry data-pmg-overlay-root so the chassis
       `body > *:not(...)` universal-hide CSS rule doesn't make
       the toast invisible (see pmg-chassis-v3.css line 51). */
    el.setAttribute('data-pmg-overlay-root', '');
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'background:#0a2218;color:#00c896;border:1px solid #00c896;padding:10px 16px;' +
      'border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.4);';
    document.body.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, 1800);
    setTimeout(function () { el.remove(); }, 2200);
  }

  function deleteTargets() {
    // Hard-remove a small set of nodes by ID so they cannot be revealed by other scripts
    ['pmg-help-me-start-btn', 'guided-mode-dialog', 'guided-mode-btn',
     'pmg-shortcuts-panel', 'pmg-result-confirm', 'pmg-t42-beta-banner',
     'auto-optimize-row', 'post-uc-guidance']
      .forEach(function (id) {
        var n = document.getElementById(id);
        if (n && n.parentNode) n.parentNode.removeChild(n);
      });
  }

  // Defensive stray-form rescue: if any late-loading legacy script reparents
  // #prompt-form out of body, move it back so its submit listener stays
  // reachable. Form is display:none either way (visible inputs live in v3 slots).
  var mo = new MutationObserver(function () {
    var stray = document.getElementById('prompt-form');
    if (stray && stray.parentNode !== document.body) {
      document.body.appendChild(stray);
      stray.style.setProperty('display', 'none', 'important');
      stray.setAttribute('data-pmgv3-rescued', '1');
    }
  });
  if (document.body) {
    mo.observe(document.body, { childList: true });
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      mo.observe(document.body, { childList: true });
    });
  }

  function setActivePanel(name) {
    if (!name) return;
    var validNames = { text: 1, photography: 1, video: 1 };
    if (!validNames[name]) return;
    var body = rootEl && rootEl.querySelector('.pmgv3-body');
    if (body) body.setAttribute('data-active-panel', name);
    var tabs = rootEl && rootEl.querySelectorAll('.pmgv3-tab');
    if (tabs) {
      Array.prototype.forEach.call(tabs, function (t) {
        var active = t.dataset.module === name;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
    // Toggle legacy body.image-mode so the Photography Suite's gated
    // pill groups, image-mode-only buttons, and helper text become
    // visible while the Photo panel is active. Strip it for Text/Video.
    try {
      if (name === 'photography') {
        document.body.classList.add('image-mode');
        // re-relocate in case suite (re)built since last switch
        if (typeof window.relocatePhotoSuite === 'function') {
          try { window.relocatePhotoSuite(); } catch (_) {}
        }
      } else {
        document.body.classList.remove('image-mode');
      }
    } catch (_) {}
  }

  // bm-3 (Repair Brief Bug 3): wait-for-condition helper backed by a
  // MutationObserver instead of setInterval polling. Calls `predicate`
  // immediately, then on every DOM mutation under document.body, with
  // a hard timeout safety net. This eliminates 3 of the chassis's
  // polling loops (mount-VS, deep-link panel, photo-suite relocate).
  //
  // The remaining 5 setIntervals in this file are intentionally kept:
  //   - killClones / hideTick are *defensive* against legacy scripts
  //     that re-inject removed DOM after we've cleaned it; they are
  //     load-bearing for the chassis' "swap legacy DOM into v3 slots"
  //     contract. Replacing them risks the legacy markup flashing or
  //     persisting on slow first paints.
  //   - updatePickCount / mirrorStrength / (1269) are periodic UI
  //     sync ticks, not "wait for X" — observers don't apply here.
  function waitForCondition(predicate, opts) {
    var timeoutMs = (opts && opts.timeoutMs) || 4000;
    var done = false;
    function attempt() {
      if (done) return true;
      var ok = false;
      try { ok = !!predicate(); } catch (_) { ok = false; }
      if (ok) { done = true; try { mo.disconnect(); } catch (_) {} clearTimeout(killer); }
      return ok;
    }
    if (attempt()) return;
    var mo = new MutationObserver(function () { attempt(); });
    try {
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (_) { /* SSR / detached docs */ }
    var killer = setTimeout(function () {
      done = true;
      try { mo.disconnect(); } catch (_) {}
    }, timeoutMs);
  }

  // Mount Visual Studio inline panels once the chassis + VS script are both ready.
  function tryMountVS() {
    if (typeof window.mountVisualStudioPanels !== 'function') return false;
    var pl = document.getElementById('pmgv3-photo-left');
    var pr = document.getElementById('pmgv3-photo-right');
    var vl = document.getElementById('pmgv3-video-left');
    var vr = document.getElementById('pmgv3-video-right');
    if (!pl || !pr || !vl || !vr) return false;
    window.mountVisualStudioPanels({
      photoLeft: pl, photoRight: pr, videoLeft: vl, videoRight: vr,
    });
    return true;
  }
  function mountVSWhenReady() { waitForCondition(tryMountVS, { timeoutMs: 4000 }); }
  // Kick off mount after boot; chassis-v3 runs first so VS may not be defined yet.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountVSWhenReady);
  } else {
    mountVSWhenReady();
  }
  // Allow ?panel=photography|video|text deep-linking (also useful for tests).
  var initialPanel = qs.get('panel');
  if (initialPanel === 'photography' || initialPanel === 'video') {
    waitForCondition(function () {
      if (!(rootEl && rootEl.querySelector('.pmgv3-body'))) return false;
      setActivePanel(initialPanel);
      return true;
    }, { timeoutMs: 3000 });
  }
  // Re-attempt to relocate the photo suite as legacy mounts run. The
  // photo suite can mount late, so we observe DOM mutations until a
  // hard 6s ceiling — no per-mutation settle counter (mutations don't
  // imply work was done; counting them risks premature disconnect on
  // unrelated DOM churn).
  (function () {
    var done = false;
    function tick() {
      if (done) return;
      if (typeof window.relocatePhotoSuite === 'function') {
        try { window.relocatePhotoSuite(); } catch (_) {}
      }
    }
    tick();
    var mo2 = new MutationObserver(tick);
    try { mo2.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    setTimeout(function () { done = true; try { mo2.disconnect(); } catch (_) {} }, 6000);
  })();

  // Expose for debugging + VS back-compat shim
  window.pmgChassisV3 = {
    rebuild: function () {
      var existing = document.getElementById('pmg-chassis-v3-root');
      if (existing) existing.remove();
      boot();
    },
    setActivePanel: setActivePanel,
  };
})();
