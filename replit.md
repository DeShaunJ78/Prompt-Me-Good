# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### PromptMeGood (`artifacts/promptmegood`)

Single-file static HTML AI prompt builder (`index.html`, ~6.6k lines, vanilla JS, vite preview). Live at https://prompt-me-good.replit.app.

Key features:
- **Builder**: goal, category, skill level, tone, output format, output language, personality, extra details, **guardrails** (things AI should avoid), **max response length** (presets 100/200/300/500 + custom), boost toggles (Money / Human Voice / Clarity / Photo).
- **Smart Suggestions**: keyword analyzer reads `#goal` (debounced) and recommends category/tone/outputFormat/maxLength via `Suggested` badges (`.suggested-badge`).
- **Auto Optimize**: toggle `#auto-optimize-toggle` (default ON, persisted in `localStorage` key `promptmegood:autoOptimize:v1`). When ON, applies suggestions to fields the user has not manually changed (tracked in `userTouched` Set). Demo + Guide Me mark all tracked fields as touched.
- **AI Tool Recommender**: highlights one of ChatGPT/Claude/Perplexity (`.is-recommended` glow + `.recommended-badge`) based on goal keywords (research → Perplexity, writing → Claude, default → ChatGPT).
- **Prompt Strength Score**: 0–100% bar + 2–3 insights (`#strength-score`) rendered after every generate, hidden on Clear Prompt. Heuristic uses goal length, details, guardrails, maxLength, personality, boosts, tone, format.
- **This Week's Focus**: rotating curated goal pin (`#weekly-goal-pin`) at the top of the builder. 10-item `WEEKLY_GOALS` list rotates by `Math.floor(Date.now() / (7d in ms)) % 10`. Click `#weekly-goal-cta` → fills `#goal`, dispatches input event, runs smart-systems recompute, marks viewed. Shows `New` badge (`#weekly-goal-new-badge`) when `localStorage[promptmegood:weeklyGoalViewedIndex:v1]` differs from current index; once-per-session toast `New weekly goal available.` gated by `sessionStorage[promptmegood:weeklyGoalToastShown]`. Daily nudge banner uses the current focus to generate prompt ideas; `Try it` action calls `applyWeeklyGoal()`. Backup export/import uses `weeklyGoalViewedIndex` (number); legacy `weeklyGoal` text field is silently ignored for backward compat.
- **Guide Me**: 4-question modal (`#guided-mode-dialog`, opened by `#guided-mode-btn`) that fills `#goal`, `#details`, `#guardrails` for users who don't know how to phrase a goal. Fields are REPLACED on each run (not appended).
- **Refinement**: refine buttons (More Detailed / More Aggressive / Beginner Friendly), Fine-Tune Your Prompt, Undo Last Change, manual editing.
- **Quality Checker**: `#check-quality-btn` runs heuristics over the form state (short goal, missing details/guardrails/max length, vague-word regex) and shows up to 3 suggestions in `#quality-feedback`.
- **Use**: Copy + ChatGPT/Claude/Perplexity launch buttons, Print/PDF, prompt history.
- **Tour**: in-app onboarding tour (`OB_STEPS`, 7 steps with Auto Optimize callout) and demo walkthrough (`DEMO_STEPS`, 7 steps including Strength Score) launched by "Use Demo Values" button. Tour titles use sentence case. **Replay Tour** buttons in both the builder panel header (`#replay-tour-btn-builder`) and footer (`#replay-tour-btn`) — both wired to a shared `startReplayTour()`.
- **Onboarding banner persistence**: `#tour-banner` resurfaces across sessions until dismissed `ONBOARDING_MAX_DISMISSALS` (3) times. Tracked by `localStorage[promptmegood:onboardingDismissCount:v1]` (incremented on every dismissal: banner X, banner Go-To-Start-Here, overlay Skip/Escape/backdrop) plus `sessionStorage[promptmegood:onboardingSeenSession]` to suppress within a single session. Tour completion (last "Next") sets `localStorage[promptmegood:onboarding:v1]` permanently via `obFinish({completed: true})`; cap-reach also calls `obMarkDone()`. All non-completion exit paths call `obDismissForSession()`.
- **Builder simplification**: 4 boost toggles (Money / Human Voice / Clarity / Photo) are wrapped in a `<details id="advanced-options">` collapsible (default closed). Goal, Category, Tone, Output Format, Max Response Length, Guardrails remain visible at the top level. Toggle states persist across collapse/expand because the inputs stay in the DOM.
- **Manual**: full in-page user manual restructured into two collapsibles inside `#manual`. `<details id="quick-start-card" open>` shows a 5-step Quick Start at the top (always visible by default). `#manual-toggle` (renamed to "Advanced Help", default collapsed) reveals the long-form sections (`#manual-flow`, `#manual-fields`, `#manual-boosts`, `#manual-refine`, `#manual-use`, `#manual-clearing`, `#manual-history`, `#manual-tips`, `#manual-mistakes`) plus the `#manual-smart-systems` callout for the Smart Suggestions / Auto Optimize / AI Tool Recommendation / Prompt Strength stack (now also includes the Expert Mode bullet).
- **Expert Mode**: opt-in power-user mode. Toggle (`#expert-mode-toggle`, wrapper `#expert-mode-toggle-wrap`) lives in the builder header next to Replay Tour, with the helper "For advanced users who want full control." Hero awareness link (`#hero-expert-link-btn`) reads "Power user? Switch to Expert Mode inside the builder." → smooth-scrolls to `#builder` and pulses the toggle (`.is-pulse` 1.6s × 2 keyframe). Activating ON for the first 3 times opens `#expert-warning-dialog` ("Turn on Expert Mode? — Expert Mode removes most guidance and shows advanced controls. This may feel overwhelming if you're new.") with `#expert-warning-confirm` (Enable Expert Mode) and `#expert-warning-cancel` (Stay In Guided Mode); after the 3rd confirmed activation, subsequent toggles are immediate. While ON: `body.is-expert-mode` hides `.tip-block`, `.demo-helper`, `#auto-optimize-row`, `#guided-cta-row`, `#weekly-goal-pin`, `.examples-block`, `#post-uc-guidance`, `.field .helper`, `.builder-transition`, `#quick-start-card`, and the `.adv-sub` description; the Advanced Options details (`#advanced-options`) is force-opened (prior open state remembered for restore on disable); Auto Optimize (`#auto-optimize-toggle`) is forced unchecked with a `change` event dispatch; the keyboard hints panel (`#keyboard-hints`, lists `G` generate, `C` copy, `/` focus history search, `Esc` close overlays) is shown; the "EXPERT MODE ACTIVE" pill (`#expert-mode-badge`) appears in the builder header. Persistence: `localStorage[promptmegood:expertMode:v1]='1'` (cleared on OFF), activation counter `localStorage[promptmegood:expertModeActivations:v1]` (numeric). Tour resilience: `obStart()` strips `is-expert-mode` from `<body>` for the duration of any onboarding/demo tour and restores it in `obFinish()` (persisted preference is not modified) — this keeps OB/DEMO targets like `#auto-optimize-row` and `#weekly-goal-pin` visible. OB/DEMO final-step copy mentions Expert Mode in one line; no new tour steps were added.

Globals: `window.__pmgSmartSystems` (`markAllTouched`, `clearTouched`, `recompute`) and `window.__pmgStrengthScore` (`render`, `hide`).

Workflow: `pnpm --filter @workspace/promptmegood run dev`. Iteration cadence is "polish round → architect review → runTest → republish via suggest_deploy".
