╔══════════════════════════════════════════════════════════════════╗
║  FOUR FEATURE SPECS — RUN IN ORDER, ONE AT A TIME               ║
║  1. Template Browser                                             ║
║  2. Multi-Model Compare                                          ║
║  3. Prompt Versioning                                            ║
║  4. Developer API                                                ║
╚══════════════════════════════════════════════════════════════════╝

Complete each spec fully and confirm it works before starting
the next one. Do not start spec 2 until spec 1 is deployed and
verified. Same rule applies for 3 and 4.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPEC 1 — TEMPLATE BROWSER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

─── READ FIRST (do not modify) ──────────────────────────────────
artifacts/promptmegood/public/styles/pmg-g-theme.css
  → Note all --color-* CSS custom properties. Use only these.
artifacts/promptmegood/app.html
  → Find #goal textarea and its parent container.
  → Find the existing nav or top bar in the workstation — you
    will add one "Templates" button there.
  → Find <script> and <link> tag blocks at the bottom.
    Your two new tags go at the END of each block.
  → Do not modify any existing markup except inserting one
    button and two tags.
artifacts/api-server/src/routes/ai.ts
  → Read how existing POST routes are structured (middleware
    chain, Zod validation, OpenAI call, response shape).
    Mirror this pattern exactly for the new endpoint.
  → Note the existing `rateLimit` and `generateCostCheck`
    middleware — use both on the new endpoint.
─────────────────────────────────────────────────────────────────

─── CREATE ──────────────────────────────────────────────────────
artifacts/promptmegood/public/scripts/pmg-template-browser.js
artifacts/promptmegood/public/styles/pmg-template-browser.css
─────────────────────────────────────────────────────────────────

─── MODIFY (minimal) ────────────────────────────────────────────
artifacts/api-server/src/routes/ai.ts
  → Add one new POST route: /templates/generate
  → Add it AFTER the last existing router.post() call.
  → Do not touch any existing route.

artifacts/promptmegood/app.html
  → Add one "Templates" button to the workstation nav/top bar.
    Place it alongside existing nav items. Label: "Templates"
    ID: pmg-template-browser-btn
    class: btn btn-secondary
  → Add <link> for pmg-template-browser.css at END of links.
  → Add <script> for pmg-template-browser.js at END of scripts.
─────────────────────────────────────────────────────────────────

─── DO NOT TOUCH ────────────────────────────────────────────────
pmg-ux.js, pmg-chassis-v3.js, pmg-optimize-toggle.js,
pmg-vault-import.js, pmg-vault-versions.js (not created yet),
pmg-compare.js (not created yet). Any other existing script.
Any existing route in ai.ts.
─────────────────────────────────────────────────────────────────

─── BACKEND: POST /api/templates/generate ───────────────────────
Middleware chain: rateLimit, generateCostCheck

Zod input schema:
  {
    category: z.string().min(1).max(64),
    count:    z.number().int().min(1).max(12).optional().default(6)
  }

System prompt sent to gpt-4.1-mini (not gpt-4.1 — cost control):
  "You are a prompt template generator for PromptMeGood, an AI
   prompt builder. Generate {count} distinct, ready-to-use prompt
   templates for the category: {category}.

   Each template is a goal a user would type into a prompt
   builder. Write them in plain English, first-person, as if the
   user is typing their goal. They should be specific enough to
   produce a useful prompt but short enough to fit in one line.

   Respond ONLY with a JSON array. No markdown, no explanation,
   no backticks. Each object has exactly these fields:
     title: string (3-6 words, the template name)
     goal:  string (the full goal text the user would type,
                    20-80 words)
     tags:  string[] (2-4 relevant tags, lowercase)

   Example for category 'Marketing':
   [
     {
       'title': 'Cold Email Sequence',
       'goal': 'Write a 3-email cold outreach sequence for a B2B
                SaaS targeting operations managers at mid-size
                logistics companies. Each email should have a
                clear hook, one value point, and a low-friction
                CTA.',
       'tags': ['email', 'b2b', 'saas', 'sales']
     }
   ]"

Response shape from the endpoint:
  { templates: Array<{ title, goal, tags }> }

On OpenAI error: return 502 with { error: 'Generation failed' }
On Zod error: return 400 with { error: 'Invalid input' }
─────────────────────────────────────────────────────────────────

─── FRONTEND: pmg-template-browser.js ───────────────────────────
Self-contained IIFE. Kill-switch: localStorage key
'pmg_template_browser_disable' === '1' → exit immediately.

CATEGORIES (hardcoded array, in this order):
  Marketing & Sales, Content & Writing, Photography & Image,
  Business & Strategy, Career & Resume, Faith & Community,
  Real Estate, Social Media, Productivity, Learning & Education,
  Growth & Revenue, Personal Development

STATE:
  let isOpen = false;
  let activeCategory = null;
  let templates = [];
  let isLoading = false;

ON INIT (DOMContentLoaded or immediate if already fired):
  1. Find #pmg-template-browser-btn. If not found, exit silently.
  2. On button click: toggle the modal open/closed.

MODAL STRUCTURE (injected into <body> once on init, hidden by
default, never re-created):

  <div id="pmg-tb-backdrop" class="pmg-tb-backdrop">
    <div id="pmg-tb-modal" class="pmg-tb-modal"
         role="dialog" aria-modal="true"
         aria-label="Browse prompt templates">
      <div class="pmg-tb-header">
        <h2 class="pmg-tb-title">Browse Templates</h2>
        <button id="pmg-tb-close" class="pmg-tb-close"
                aria-label="Close template browser">×</button>
      </div>
      <div class="pmg-tb-body">
        <div id="pmg-tb-categories" class="pmg-tb-categories">
          <!-- one button per category, injected by script -->
        </div>
        <div id="pmg-tb-results" class="pmg-tb-results">
          <!-- state: empty / loading / template cards -->
        </div>
      </div>
    </div>
  </div>

CATEGORY SELECTION:
  When user clicks a category button:
  1. Mark it active (aria-selected="true", CSS active class).
  2. Set isLoading = true. Show loading state in #pmg-tb-results:
       <p class="pmg-tb-loading">Generating templates…</p>
  3. POST to /api/templates/generate:
       { category: selectedCategory, count: 8 }
     Include Authorization header if Supabase session available.
  4. On success: render template cards (see below).
  5. On error: show error state:
       <p class="pmg-tb-error">
         Couldn't load templates. Try again.
       </p>
     With a "Retry" button that re-fires the same request.
  6. Set isLoading = false.

TEMPLATE CARDS:
  Each card renders:
    <div class="pmg-tb-card">
      <div class="pmg-tb-card-title">{title}</div>
      <div class="pmg-tb-card-goal">{goal}</div>
      <div class="pmg-tb-card-tags">
        {tags.map(t => <span class="pmg-tb-tag">{t}</span>)}
      </div>
      <button class="pmg-tb-use btn btn-primary"
              data-goal="{goal}">
        Use This Template →
      </button>
    </div>

  On "Use This Template" click:
    1. Find #goal textarea.
    2. Set its value to the template's goal text.
    3. Dispatch an 'input' event on #goal so any existing
       listeners react (character count, enable/disable logic).
    4. Close the modal.
    5. Scroll #goal into view smoothly.

MODAL CLOSE:
  - Click #pmg-tb-close button.
  - Click the backdrop (#pmg-tb-backdrop) outside the modal.
  - Press Escape key (only when modal is open).
  All three paths: set isOpen = false, hide modal,
  remove Escape listener.

WHAT THIS SCRIPT MUST NEVER DO:
  - Never call any existing pmg* function by name.
  - Never modify #goal directly except to set .value and
    dispatch 'input' (the two lines in "Use This Template").
  - Never modify any global set by another script.
─────────────────────────────────────────────────────────────────

─── FRONTEND: pmg-template-browser.css ──────────────────────────
All values use --color-* CSS custom properties from the theme.
No hardcoded hex colors.

.pmg-tb-backdrop
  Fixed overlay, full viewport, z-index above all existing UI
  (check existing z-index values in app.html CSS and go 1
  above the highest). Semi-transparent dark background.
  Hidden by default (display:none). Flex center when visible.

.pmg-tb-modal
  Max-width 760px. Max-height 82vh. Overflow hidden.
  Border-radius: var(--radius-lg). Background: var(--color-surface).
  Border: 1px solid var(--color-border).
  Display flex flex-direction column.
  Mobile: max-width 100vw, max-height 96vh, border-radius 0
  at bottom (slide up from bottom on mobile).

.pmg-tb-header
  Flex row, space-between, align-center.
  Padding. Border-bottom: 1px solid var(--color-border).

.pmg-tb-title
  Font-weight 700. Margin 0.

.pmg-tb-close
  No background, no border. Color: var(--color-text-muted).
  Font-size 24px. Cursor pointer. Padding 4px 8px.

.pmg-tb-body
  Display flex. Flex-direction row. Overflow hidden. Flex 1.

.pmg-tb-categories
  Width 180px. Flex-shrink 0.
  Border-right: 1px solid var(--color-border).
  Overflow-y auto. Padding 12px 8px.
  Display flex. Flex-direction column. Gap 4px.
  Mobile: width 100%, flex-direction row, flex-wrap wrap,
  border-right none, border-bottom 1px solid var(--color-border).

.pmg-tb-cat-btn
  Width 100%. Text-align left. Background transparent.
  Border none. Border-radius var(--radius-md).
  Padding 8px 12px. Color var(--color-text-muted).
  Font-size 13px. Cursor pointer.
  Hover: background var(--color-surface-2), color var(--color-primary).

.pmg-tb-cat-btn[aria-selected="true"]
  Background var(--color-surface-2).
  Color var(--color-primary). Font-weight 600.

.pmg-tb-results
  Flex 1. Overflow-y auto. Padding 16px.
  Display flex. Flex-direction column. Gap 12px.

.pmg-tb-card
  Background var(--color-surface-2).
  Border: 1px solid var(--color-border).
  Border-radius var(--radius-md). Padding 16px.

.pmg-tb-card-title
  Font-weight 700. Font-size 15px. Margin-bottom 6px.

.pmg-tb-card-goal
  Color var(--color-text-muted). Font-size 13px.
  Line-height 1.55. Margin-bottom 10px.

.pmg-tb-card-tags
  Display flex. Flex-wrap wrap. Gap 6px. Margin-bottom 12px.

.pmg-tb-tag
  Font-size 11px. Padding 2px 8px.
  Background var(--color-surface). Border-radius 999px.
  Color var(--color-text-muted).
  Border: 1px solid var(--color-border).

.pmg-tb-use
  Width 100%. Font-size 14px.

.pmg-tb-loading, .pmg-tb-error
  Color var(--color-text-muted). Font-size 14px.
  Text-align center. Padding 32px 0.

.pmg-tb-empty-state
  Color var(--color-text-faint). Font-size 14px.
  Text-align center. Padding 40px 0.
  Content: "← Pick a category to browse templates"
─────────────────────────────────────────────────────────────────


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPEC 2 — MULTI-MODEL COMPARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

─── READ FIRST (do not modify) ──────────────────────────────────
artifacts/promptmegood/app.html
  → Find #result-top-actions. It contains #result-top-copy,
    #result-top-run, #result-top-refine. You will add one new
    button as the LAST child of this div.
  → Find #resultBox — this is where the generated prompt lives.
    Your compare button reads its content as the prompt to send.
  → Find body.pmg-has-result — this class is set when a result
    exists. Your compare button should only be active when this
    class is present.
  → Find <script> and <link> blocks. New tags go at the END.
artifacts/api-server/src/routes/ai.ts
  → Note the rateLimit and generateCostCheck middleware.
  → Note how existing parallel work is handled if at all,
    otherwise use Promise.allSettled for parallel calls.
─────────────────────────────────────────────────────────────────

─── CREATE ──────────────────────────────────────────────────────
artifacts/promptmegood/public/scripts/pmg-compare.js
artifacts/promptmegood/public/styles/pmg-compare.css
─────────────────────────────────────────────────────────────────

─── MODIFY (minimal) ────────────────────────────────────────────
artifacts/api-server/src/routes/ai.ts
  → Add one new POST route: /compare
  → Add it AFTER the last existing router.post() call.
  → Do not touch any existing route.

artifacts/promptmegood/app.html
  → In #result-top-actions, add as LAST child:
    <button type="button"
            class="btn btn-secondary result-top-btn"
            id="result-top-compare"
            disabled
            aria-disabled="true"
            title="Generate a prompt first to compare models.">
      Compare Models
    </button>
  → Enable/disable logic: mirror exactly how #result-top-copy
    is enabled/disabled (same trigger, same timing).
  → Add <link> for pmg-compare.css at END of links.
  → Add <script> for pmg-compare.js at END of scripts.
─────────────────────────────────────────────────────────────────

─── DO NOT TOUCH ────────────────────────────────────────────────
pmg-ux.js, pmg-chassis-v3.js, pmg-optimize-toggle.js,
pmg-vault-import.js, pmg-template-browser.js.
#result-top-copy, #result-top-run, #result-top-refine
and their existing event handlers.
─────────────────────────────────────────────────────────────────

─── BACKEND: POST /api/compare ──────────────────────────────────
Middleware chain: rateLimit, generateCostCheck

Zod input schema:
  { prompt: z.string().min(1).max(4000) }

Fire THREE parallel calls using Promise.allSettled to gpt-4.1
with different system prompts. Do not await them sequentially.

CALL 1 — ChatGPT style:
  System: "You are ChatGPT. Respond to the following prompt
           in your natural style: conversational, numbered steps
           where appropriate, clear and direct. Aim for
           practical, actionable output. 300 words max."

CALL 2 — Claude style:
  System: "You are Claude by Anthropic. Respond to the following
           prompt in your natural style: thoughtful, thorough,
           using structured headers and bullet points where they
           aid clarity. Nuanced where appropriate. 300 words max."

CALL 3 — Gemini style:
  System: "You are Gemini by Google. Respond to the following
           prompt in your natural style: lead with a concrete
           example or analogy, use visual structure, present
           multiple perspectives briefly. 300 words max."

Each call passes the user's prompt as the user message.
Max tokens: 500 per call.

On Promise.allSettled resolution:
  Build response object. For each call:
    If fulfilled: use result value text.
    If rejected:  use null for that model's field.

Response shape:
  {
    chatgpt: string | null,
    claude:  string | null,
    gemini:  string | null
  }

If ALL three calls fail: return 502 { error: 'All models failed' }
If some fail: still return 200 with nulls for failed models.
─────────────────────────────────────────────────────────────────

─── FRONTEND: pmg-compare.js ────────────────────────────────────
Self-contained IIFE.
Kill-switch: localStorage 'pmg_compare_disable' === '1' → exit.

ON INIT:
  1. Find #result-top-compare. If not found, exit silently.
  2. On click: read #resultBox.textContent (trim it).
     If empty: do nothing.
     If not empty: open the compare modal and fire the API call.

MODAL STRUCTURE (injected into <body> once, hidden by default):

  <div id="pmg-cmp-backdrop" class="pmg-cmp-backdrop">
    <div id="pmg-cmp-modal" class="pmg-cmp-modal"
         role="dialog" aria-modal="true"
         aria-label="Compare model outputs">
      <div class="pmg-cmp-header">
        <h2 class="pmg-cmp-title">Compare Models</h2>
        <p class="pmg-cmp-sub">
          Same prompt. Three model styles. Side by side.
        </p>
        <button id="pmg-cmp-close" class="pmg-cmp-close"
                aria-label="Close compare">×</button>
      </div>
      <div class="pmg-cmp-cols" id="pmg-cmp-cols">
        <div class="pmg-cmp-col" id="pmg-cmp-chatgpt">
          <div class="pmg-cmp-col-label">ChatGPT Style</div>
          <div class="pmg-cmp-col-body">Loading…</div>
        </div>
        <div class="pmg-cmp-col" id="pmg-cmp-claude">
          <div class="pmg-cmp-col-label">Claude Style</div>
          <div class="pmg-cmp-col-body">Loading…</div>
        </div>
        <div class="pmg-cmp-col" id="pmg-cmp-gemini">
          <div class="pmg-cmp-col-label">Gemini Style</div>
          <div class="pmg-cmp-col-body">Loading…</div>
        </div>
      </div>
      <div class="pmg-cmp-footer">
        <p class="pmg-cmp-note">
          Responses simulate each model's output style using
          GPT-4.1. Actual model outputs may vary.
        </p>
      </div>
    </div>
  </div>

API CALL FLOW:
  1. Open modal immediately (show loading state in all 3 cols).
  2. POST to /api/compare { prompt: <resultBox text> }.
     Include Authorization header if Supabase session available.
  3. On success:
       For each of chatgpt, claude, gemini:
         If value is a string: set col body to the text.
         If null: set col body to error state:
           "This model style failed to load. Try again."
  4. On fetch error: set all three col bodies to error state.
  5. Add a "Close" button in footer that closes the modal.

MODAL CLOSE:
  - #pmg-cmp-close button click.
  - Backdrop click outside modal.
  - Escape key.

WHAT THIS SCRIPT MUST NEVER DO:
  - Never modify #resultBox content.
  - Never interfere with #result-top-copy, #result-top-run,
    or #result-top-refine.
  - Never call any existing pmg* function by name.
─────────────────────────────────────────────────────────────────

─── FRONTEND: pmg-compare.css ───────────────────────────────────
All values use --color-* custom properties only.

.pmg-cmp-backdrop
  Fixed, full viewport. Z-index: above everything (same rule as
  pmg-template-browser — go 1 above highest existing z-index,
  or match pmg-template-browser's z-index exactly so only one
  modal can be visible at a time via open/close logic).
  Semi-transparent dark overlay. Flex center. Hidden by default.

.pmg-cmp-modal
  Max-width 1000px. Width 96vw. Max-height 86vh.
  Display flex. Flex-direction column.
  Background var(--color-surface). Border-radius var(--radius-lg).
  Border: 1px solid var(--color-border).

.pmg-cmp-header
  Padding 20px 24px 16px. Border-bottom 1px solid var(--color-border).
  Position relative.

.pmg-cmp-title
  Font-size 18px. Font-weight 700. Margin 0 0 4px.

.pmg-cmp-sub
  Color var(--color-text-muted). Font-size 13px. Margin 0.

.pmg-cmp-close
  Position absolute. Top 16px. Right 16px.
  No background, no border. Font-size 24px.
  Color var(--color-text-muted). Cursor pointer.

.pmg-cmp-cols
  Display grid. Grid-template-columns: repeat(3, 1fr).
  Gap 1px. Background var(--color-border).
  Flex 1. Overflow hidden.
  Mobile (max-width 720px): grid-template-columns 1fr.
  Each col scrolls independently.

.pmg-cmp-col
  Background var(--color-surface). Overflow-y auto.
  Display flex. Flex-direction column.

.pmg-cmp-col-label
  Font-size 12px. Font-weight 700. Letter-spacing 0.08em.
  Text-transform uppercase. Color var(--color-text-muted).
  Padding 14px 16px 10px. Border-bottom 1px solid var(--color-border).
  Position sticky. Top 0. Background var(--color-surface).
  Z-index 1.

.pmg-cmp-col-body
  Padding 16px. Font-size 14px. Line-height 1.65.
  Color var(--color-text). White-space pre-wrap.
  Flex 1.

.pmg-cmp-footer
  Padding 12px 24px. Border-top 1px solid var(--color-border).

.pmg-cmp-note
  Color var(--color-text-faint). Font-size 12px.
  Font-style italic. Margin 0.
─────────────────────────────────────────────────────────────────


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPEC 3 — PROMPT VERSIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

─── READ FIRST (do not modify) ──────────────────────────────────
artifacts/promptmegood/public/scripts/pmg-vault-import.js
  → Read the HISTORY_KEY constant and how entries are written
    to localStorage. Note the exact shape of a vault entry.
    Your versioning script must use the SAME key and SAME
    entry shape.
artifacts/promptmegood/app.html
  → Find the Vault list rendering — how existing cards are
    built and where they live in the DOM.
  → Find the existing save-to-vault event or button.
    Note its ID and how it fires.
  → Find <script> and <link> blocks. New tags go at the END.
─────────────────────────────────────────────────────────────────

─── CREATE ──────────────────────────────────────────────────────
artifacts/promptmegood/public/scripts/pmg-vault-versions.js
artifacts/promptmegood/public/styles/pmg-vault-versions.css
─────────────────────────────────────────────────────────────────

─── MODIFY (minimal) ────────────────────────────────────────────
artifacts/promptmegood/app.html
  → Add <link> for pmg-vault-versions.css at END of links.
  → Add <script> for pmg-vault-versions.js at END of scripts.
  → No other changes to app.html.
─────────────────────────────────────────────────────────────────

─── DO NOT TOUCH ────────────────────────────────────────────────
pmg-ux.js, pmg-chassis-v3.js, pmg-vault-import.js,
pmg-optimize-toggle.js, pmg-template-browser.js,
pmg-compare.js. Any existing vault save logic.
─────────────────────────────────────────────────────────────────

─── HOW VERSIONING WORKS ────────────────────────────────────────
The Vault stores entries in localStorage[HISTORY_KEY] as a JSON
array. Each entry has a prompt text field and other metadata.

This script adds a `versions` array to entries. When a user
saves a prompt whose title already exists in the Vault (exact
title match, case-insensitive, trimmed), instead of overwriting,
the new prompt text is pushed into the `versions` array with a
timestamp. The original entry is updated with the new text as
the current version and the old text is archived.

Version object shape:
  {
    text:      string,   // the prompt text at that version
    savedAt:   string,   // ISO timestamp
    label:     string    // auto-generated: "v1", "v2", "v3"...
  }

Entry shape after this script modifies it:
  {
    ...existingFields,         // all existing fields unchanged
    versions: [                // new field, may be absent on old entries
      { text, savedAt, label } // oldest first
    ]
  }
─────────────────────────────────────────────────────────────────

─── FRONTEND: pmg-vault-versions.js ─────────────────────────────
Self-contained IIFE.
Kill-switch: localStorage 'pmg_vault_versions_disable' === '1'

This script does TWO things:

THING 1 — INTERCEPT SAVES (version tracking):
  Listen for the 'pmg:vault:saved' custom event on document
  (or whatever event the existing save flow dispatches — check
  pmg-ux.js for the exact event name used after a save).
  If no such event exists, use a MutationObserver on the Vault
  list container to detect when a new card is added.

  On each save detection:
  1. Read all entries from localStorage[HISTORY_KEY].
  2. Find if an entry with the same title already exists
     (case-insensitive, trimmed comparison).
  3. If NO match: add a `versions` array with one entry
     (the current text, timestamp now, label "v1").
     Write back to localStorage.
  4. If MATCH found:
     a. Get the existing versions array (or create it with
        the existing entry's text as v1 if versions absent).
     b. Push new version: { text: newText, savedAt: now,
        label: "v" + (versions.length + 1) }.
     c. Update the entry's main text to the new text.
     d. Write back to localStorage.
     e. Update the version badge on the card in the DOM
        (see THING 2).

THING 2 — RENDER VERSION HISTORY IN VAULT CARDS:
  Listen for 'pmg:vault:imported' and 'pmg:vault:rendered'
  events (or MutationObserver on the vault list) to know
  when cards are in the DOM.

  For each vault card in the DOM:
  1. Read its associated entry from localStorage by matching
     the prompt text or title shown in the card.
  2. If the entry has a versions array with length > 1:
     a. Add a version badge to the card:
          <span class="pmg-ver-badge">v{versions.length}</span>
        Place it next to the title.
     b. Add a collapsed version history section at the bottom
        of the card:
          <div class="pmg-ver-history" hidden>
            <div class="pmg-ver-history-title">
              Version History
            </div>
            {versions in reverse order, newest first}
          </div>
        Each version row:
          <div class="pmg-ver-row">
            <span class="pmg-ver-label">{label}</span>
            <span class="pmg-ver-date">{relative time}</span>
            <button class="pmg-ver-restore btn btn-secondary"
                    data-text="{version text}">
              Restore
            </button>
          </div>
     c. The badge is also a toggle button — click it to
        show/hide the .pmg-ver-history panel.
  3. If versions array length is 1 or absent: no badge,
     no history panel. Do nothing.

  RESTORE button click:
  1. Find the entry in localStorage.
  2. Set its main text to the selected version's text.
  3. Write back to localStorage.
  4. Dispatch 'pmg:vault:imported' so the Vault re-renders.
  5. Close the history panel.

RELATIVE TIME helper:
  Simple function: < 1 min → "just now", < 1 hour → "X min ago",
  < 24 hours → "X hours ago", else → locale date string.

WHAT THIS SCRIPT MUST NEVER DO:
  - Never call pmg-ux.js functions by name.
  - Never rewrite the entire localStorage entry array without
    first reading and merging — always read → modify → write.
  - Never add more than one badge or history panel per card.
─────────────────────────────────────────────────────────────────

─── FRONTEND: pmg-vault-versions.css ────────────────────────────
All values use --color-* custom properties only.

.pmg-ver-badge
  Display inline-flex. Align-items center.
  Font-size 10px. Font-weight 700. Letter-spacing 0.06em.
  Padding 2px 7px. Border-radius 999px.
  Background var(--color-surface-2).
  Color var(--color-primary).
  Border: 1px solid var(--color-border).
  Cursor pointer. Margin-left 8px.
  Vertical-align middle.
  Hover: background var(--color-primary), color white.

.pmg-ver-history
  Margin-top 12px. Padding-top 12px.
  Border-top: 1px solid var(--color-border).

.pmg-ver-history-title
  Font-size 11px. Font-weight 700. Letter-spacing 0.08em.
  Text-transform uppercase. Color var(--color-text-muted).
  Margin-bottom 8px.

.pmg-ver-row
  Display flex. Align-items center. Gap 10px.
  Padding 6px 0.
  Border-bottom: 1px solid var(--color-border).
  Font-size 13px.

.pmg-ver-row:last-child { border-bottom: none; }

.pmg-ver-label
  Font-weight 700. Color var(--color-primary).
  Min-width 28px.

.pmg-ver-date
  Color var(--color-text-muted). Flex 1.

.pmg-ver-restore
  Font-size 12px. Padding 4px 10px.
─────────────────────────────────────────────────────────────────


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPEC 4 — DEVELOPER API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

─── READ FIRST (do not modify) ──────────────────────────────────
lib/db/src/schema/index.ts
  → Note how existing tables are exported. You will add one
    new schema file and export it from here.
lib/db/src/schema/founding-purchases.ts
  → Study the Drizzle table definition pattern exactly.
    Mirror it for the new api_keys table.
artifacts/api-server/src/middlewares/userCaps.ts
  → Understand how the existing auth middleware resolves a
    user's plan from their JWT. Your API key middleware
    needs to resolve the same plan object by a different
    path (API key → user_id → plan lookup).
artifacts/api-server/src/routes/ai.ts
  → The first few lines of the file show how the router and
    middleware are imported. Mirror that for the new
    developer route file.
artifacts/promptmegood/vite.config.ts
  → Note the rollupOptions.input pattern. You will add
    api.html to this list.
artifacts/promptmegood/index.html
  → Study nav and footer structure to mirror in api.html.
artifacts/promptmegood/public/styles/pmg-g-theme.css
  → CSS custom properties for api.html styling.
─────────────────────────────────────────────────────────────────

─── CREATE ──────────────────────────────────────────────────────
lib/db/src/schema/api-keys.ts
artifacts/api-server/src/routes/developer.ts
artifacts/api-server/src/middlewares/apiKeyAuth.ts
artifacts/promptmegood/api.html
artifacts/promptmegood/public/scripts/pmg-api-keys.js
artifacts/promptmegood/public/styles/pmg-api-keys.css
─────────────────────────────────────────────────────────────────

─── MODIFY (minimal) ────────────────────────────────────────────
lib/db/src/schema/index.ts
  → Export the new api-keys schema at the end of the file.

lib/db/src/schema/api-keys.ts
  → New file — full Drizzle table definition (see below).

artifacts/api-server/src/app.ts (or wherever routes mount)
  → Mount the new developer router at /api/developer.
  → Mount apiKeyAuth middleware BEFORE the existing auth
    middleware so API key requests resolve before JWT checks.
    Do not change the existing auth middleware order.

artifacts/api-server/src/routes/ai.ts
  → On the existing /generate, /boost, and /auto-tune routes:
    add a check at the TOP of each handler (before any other
    logic): if req.pmgApiKeyUser is set (populated by
    apiKeyAuth middleware), use that user object instead of
    the JWT-resolved user. This is a 3-line addition per
    route, not a rewrite.

artifacts/promptmegood/vite.config.ts
  → Add to rollupOptions.input:
      apiDocs: path.resolve(import.meta.dirname, "api.html")

artifacts/promptmegood/app.html
  → In the workstation nav/settings area, add a small
    "API Keys" link that opens /api.html in a new tab.
    Place it alongside or below the existing settings items.
    Do not restructure any existing nav.
  → Add <link> for pmg-api-keys.css at END of links.
  → Add <script> for pmg-api-keys.js at END of scripts.
─────────────────────────────────────────────────────────────────

─── DO NOT TOUCH ────────────────────────────────────────────────
Any existing middleware execution order beyond the one addition
described above. Any existing route handler logic beyond the
3-line pmgApiKeyUser check. Any existing schema file beyond
adding the export line to index.ts.
pmg-ux.js, pmg-chassis-v3.js, and all other existing scripts.
─────────────────────────────────────────────────────────────────

─── DATABASE: lib/db/src/schema/api-keys.ts ─────────────────────
import {
  index, pgTable, serial, text, timestamp, boolean
} from "drizzle-orm/pg-core";

export const apiKeysTable = pgTable(
  "api_keys",
  {
    id:           serial("id").primaryKey(),
    userId:       text("user_id").notNull(),
    keyHash:      text("key_hash").notNull(),    // SHA-256 of key
    keyPrefix:    text("key_prefix").notNull(),  // first 12 chars shown to user
    label:        text("label").notNull().default("Default"),
    isActive:     boolean("is_active").notNull().default(true),
    lastUsedAt:   timestamp("last_used_at", { withTimezone: true }),
    createdAt:    timestamp("created_at",  { withTimezone: true })
                    .notNull().defaultNow(),
  },
  (table) => ({
    userIdx:    index("api_keys_user_idx").on(table.userId),
    hashUnique: index("api_keys_hash_idx").on(table.keyHash),
  })
);

After creating this file, run the Drizzle migration to push
the new table to Supabase:
  pnpm --filter @workspace/db run generate
  pnpm --filter @workspace/db run migrate
─────────────────────────────────────────────────────────────────

─── MIDDLEWARE: apiKeyAuth.ts ────────────────────────────────────
Purpose: if the request has Authorization: Bearer pmg_live_*,
resolve it to a user and attach to req.pmgApiKeyUser. Otherwise
pass through untouched.

Logic:
  1. Check Authorization header. If absent or doesn't start
     with "pmg_live_", call next() immediately and return.
  2. Extract the full key string.
  3. SHA-256 hash it using Node's crypto.createHash('sha256').
  4. Query api_keys table: WHERE key_hash = hash AND
     is_active = true. If not found: return 401
     { error: 'Invalid API key' }.
  5. Update last_used_at to now (fire-and-forget, don't await
     if it would add latency — use .catch(noop)).
  6. Resolve the user's plan using the same logic as the
     existing JWT-based plan resolution (look at userCaps.ts
     for the getOrCreateProfile or equivalent call).
  7. Attach to req: req.pmgApiKeyUser = { userId, plan }.
  8. Call next().

API key format:
  "pmg_live_" + 32 lowercase hex characters
  Total length: 41 characters
  Generate with: crypto.randomBytes(16).toString('hex')
─────────────────────────────────────────────────────────────────

─── BACKEND: artifacts/api-server/src/routes/developer.ts ───────
Mount at /api/developer in app.ts.

Middleware on all routes: existing JWT auth middleware (user
must be logged in to manage their own API keys).

Zod schemas:
  CreateKeyInput:  { label: z.string().min(1).max(64) }
  RevokeKeyInput:  { id: z.number().int().positive() }

Routes:

GET /api/developer/keys
  Returns all API keys for the authenticated user.
  Response: { keys: Array<{id, keyPrefix, label, isActive,
                            lastUsedAt, createdAt}> }
  Never returns keyHash. Never returns the full key.

POST /api/developer/keys
  Validate CreateKeyInput.
  1. Generate key: "pmg_live_" + randomBytes(16).hex()
  2. Hash it: SHA-256
  3. keyPrefix: key.slice(0, 12) + "..."
  4. Insert row into api_keys.
  5. Return the FULL key ONCE in the response:
       { key: fullKey, id, keyPrefix, label }
  This is the only time the full key is ever returned.
  After this response, it cannot be retrieved again.

DELETE /api/developer/keys/:id
  Validate that the key belongs to the authenticated user.
  Set is_active = false (soft delete, never hard delete).
  Response: { success: true }
─────────────────────────────────────────────────────────────────

─── FRONTEND: pmg-api-keys.js ───────────────────────────────────
Self-contained IIFE. Runs only on pages where
#pmg-ak-container exists (the api.html page).
If #pmg-ak-container not found: exit silently.

This script manages API key UI on the api.html page:

STATE:
  let keys = [];
  let isLoading = false;

ON INIT:
  1. Check if user is logged in via Supabase session.
  2. If not logged in: show a "Sign in to manage API keys"
     message with a link to /app.
  3. If logged in: call loadKeys().

LOADKEYS():
  GET /api/developer/keys with Authorization: Bearer <jwt>.
  Render the keys list (see below).

KEYS LIST RENDER:
  If no keys:
    <p class="pmg-ak-empty">
      No API keys yet. Generate one below.
    </p>
  For each key:
    <div class="pmg-ak-row">
      <div class="pmg-ak-row-info">
        <span class="pmg-ak-label">{label}</span>
        <code class="pmg-ak-prefix">{keyPrefix}</code>
        <span class="pmg-ak-meta">
          Created {relative date} ·
          {lastUsedAt ? 'Last used ' + relative : 'Never used'}
        </span>
      </div>
      <button class="pmg-ak-revoke btn btn-secondary"
              data-id="{id}">
        Revoke
      </button>
    </div>

  Revoke button click:
    1. Confirm: window.confirm("Revoke this key? It will stop
       working immediately.")
    2. DELETE /api/developer/keys/{id}
    3. Reload keys list.

GENERATE KEY FORM:
  <div class="pmg-ak-generate">
    <input type="text" id="pmg-ak-label"
           placeholder="Key label (e.g. My App)"
           maxlength="64" />
    <button id="pmg-ak-create" class="btn btn-primary">
      Generate Key
    </button>
  </div>

  On Generate click:
    1. POST /api/developer/keys { label: input value }
    2. On success: show the key ONCE in a highlighted box:
         <div class="pmg-ak-new-key">
           <p class="pmg-ak-new-key-warning">
             ⚠ Copy this key now. It won't be shown again.
           </p>
           <code id="pmg-ak-key-display">{fullKey}</code>
           <button id="pmg-ak-copy-key" class="btn btn-primary">
             Copy Key
           </button>
         </div>
       Copy button: copies key to clipboard, changes label to
       "Copied!" for 2 seconds.
    3. Reload keys list.
    4. Clear the label input.
─────────────────────────────────────────────────────────────────

─── api.html PAGE ───────────────────────────────────────────────
Title: Developer API — PromptMeGood
Meta description: Use the PromptMeGood API to build, optimize,
and enhance prompts programmatically. API key management and
full endpoint documentation.

Mirror the nav and footer from index.html exactly.
Use the same CSS custom properties as the rest of the site.
Link pmg-g-theme.css and pmg-api-keys.css.
Script: pmg-api-keys.js at bottom.

PAGE SECTIONS (top to bottom):

1. HERO (no background image, just text)
   H1: PromptMeGood API
   Sub: Automate prompt generation, optimization, and
        enhancement in your own apps.
   Two pills (not buttons, just status indicators):
     "REST API" · "API Key Auth" · "JSON responses"

2. API KEY MANAGEMENT
   H2: Your API Keys
   Container: <div id="pmg-ak-container"> — the script mounts here.

3. ENDPOINT REFERENCE
   H2: Endpoints
   Sub: All endpoints accept JSON and return JSON.
        Include your API key as: Authorization: Bearer pmg_live_...

   Three endpoint blocks (use <details> for collapsible):

   ENDPOINT 1:
     POST /api/generate
     Description: Build a structured prompt from a plain-English goal.
     Request body:
       {
         "goal": "string — what you want the prompt to do",
         "category": "string — optional: General | Business |
                      Money | Content | Career | Personal |
                      Productivity | Learning | Faith",
         "tone": "string — optional: Professional | Bold & Direct |
                  Casual | Expert",
         "format": "string — optional: Step-By-Step | List |
                    Detailed Breakdown",
         "personality": "string — optional: see app for full list",
         "targetModel": "string — optional: Universal | Claude |
                         ChatGPT | Gemini | Perplexity",
         "framework": "string — optional: Auto | RISE | CARE |
                       Step-by-Step"
       }
     Response:
       { "result": "string — the generated prompt" }

   ENDPOINT 2:
     POST /api/boost
     Description: Automatically improve an existing prompt.
     Request body:
       { "prompt": "string — your existing prompt text" }
     Response:
       { "result": "string — the improved prompt" }

   ENDPOINT 3:
     POST /api/auto-tune
     Description: Fine-tune a prompt's tone, clarity, and structure.
     Request body:
       { "prompt": "string — your existing prompt text" }
     Response:
       { "result": "string — the tuned prompt" }

   Rate limits note:
     "API key requests share your plan's daily limits.
      Free: 10 requests/day. Pro: 100/day. Pro Studio: unlimited."

4. CODE EXAMPLE
   H2: Quick Start
   One clean <pre><code> block showing a curl example:

   curl -X POST https://www.promptmegood.com/api/boost \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer pmg_live_your_key_here" \
     -d '{"prompt": "Write me a sales email"}'

5. FOOTER — mirror from index.html exactly.

STYLING FOR api.html:
  All inline <style> using --color-* tokens (same pattern as
  promptperfect.html — self-contained styles, no external
  stylesheet except pmg-g-theme.css and pmg-api-keys.css).
  Clean, minimal. Match the site's dark teal aesthetic.
  Code blocks: monospace font, var(--color-surface-2) background,
  var(--color-border) border, border-radius var(--radius-md),
  padding 16px, overflow-x auto.
─────────────────────────────────────────────────────────────────

─── pmg-api-keys.css ────────────────────────────────────────────
All values use --color-* custom properties only.

.pmg-ak-empty
  Color var(--color-text-muted). Font-size 14px.

.pmg-ak-row
  Display flex. Align-items center. Gap 12px.
  Padding 14px 0. Border-bottom 1px solid var(--color-border).
  Flex-wrap wrap.

.pmg-ak-row-info
  Flex 1. Display flex. Flex-direction column. Gap 4px.

.pmg-ak-label
  Font-weight 700. Font-size 15px.

.pmg-ak-prefix
  Font-family monospace. Font-size 13px.
  Color var(--color-primary).

.pmg-ak-meta
  Font-size 12px. Color var(--color-text-muted).

.pmg-ak-revoke
  Font-size 13px. Padding 6px 14px.

.pmg-ak-generate
  Display flex. Gap 10px. Margin-top 20px. Flex-wrap wrap.

.pmg-ak-generate input
  Flex 1. Min-width 200px.
  Background var(--color-surface-2).
  Border: 1px solid var(--color-border).
  Border-radius var(--radius-md). Padding 10px 14px.
  Color var(--color-text). Font-size 14px.

.pmg-ak-new-key
  Margin-top 16px. Padding 16px.
  Background var(--color-surface-2).
  Border: 1px solid var(--color-border).
  Border-radius var(--radius-md).

.pmg-ak-new-key-warning
  Color var(--color-warning, #f4d574). Font-weight 600.
  Font-size 14px. Margin 0 0 10px.

#pmg-ak-key-display
  Display block. Font-family monospace. Font-size 13px.
  Word-break break-all. Margin-bottom 12px.
  Color var(--color-primary).

.pmg-ak-empty-sign-in
  Text-align center. Padding 32px 0.
  Color var(--color-text-muted).
─────────────────────────────────────────────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPLOYMENT ORDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
After each spec:
  1. pnpm --filter @workspace/promptmegood run build
  2. Verify the new files exist in dist/
  3. Deploy
  4. Confirm the feature works on the live site
  5. Only then start the next spec

Spec 4 only: also run DB migration before deploying:
  pnpm --filter @workspace/db run generate
  pnpm --filter @workspace/db run migrate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
