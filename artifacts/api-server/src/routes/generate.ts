import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatAnswers(answers: Record<string, string> | undefined): string {
  if (!answers || !Object.keys(answers).length) return "_No answers recorded._";
  return Object.entries(answers).map(([k, v]) => `- **${k}:** ${v}`).join("\n");
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

type ProjectInput = {
  ideaText?: string;
  isGameMode?: boolean;
  mode?: string;
  analysis?: {
    appMeta?: { label?: string; icon?: string };
    warning?: string;
    summary?: string;
  };
  answers?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Standard app fallback
// ---------------------------------------------------------------------------
function buildFallbackSpecPack(p: { ideaText: string; analysis?: ProjectInput["analysis"]; answers?: Record<string, string> }): Record<string, string> {
  const appType = p.analysis?.appMeta?.label ?? "Custom App";
  const icon    = p.analysis?.appMeta?.icon   ?? "💡";
  const slug    = slugify(p.ideaText || "my-project");
  return {
    "SPEC.md":       `# SPEC.md\n\n## ${icon} ${appType}\n${p.ideaText}\n\n## ⚠️ Warning\n${p.analysis?.warning ?? "_None._"}\n\n## Answers\n${formatAnswers(p.answers)}\n`,
    "RULES.md":      `# RULES.md\n\n- Build only what is in SPEC.md.\n- Stack: React + Vite + Tailwind + Express\n- All routes documented in APP_MAP.md\n`,
    "BUILD_PLAN.md": `# BUILD_PLAN.md\n\n## Phase 1 ✅\n- [x] Setup\n\n## Phase 2 (Current)\n- [ ] Core feature\n- [ ] API routes\n\n## Phase 3\n- [ ] Polish\n- [ ] Deploy\n`,
    "TEST_PLAN.md":  `# TEST_PLAN.md\n\n- [ ] Unit tests for core logic\n- [ ] E2E happy path\n- [ ] Error states\n`,
    "APP_MAP.md":    `# APP_MAP.md\n\n| Method | Route | Description |\n|--------|-------|-------------|\n| POST | /api/analyze | Classify idea |\n| POST | /api/generate | Generate docs |\n| POST | /api/companion | AI chat |\n\n## Slug\n\`${slug}\`\n`,
  };
}

// ---------------------------------------------------------------------------
// Game fallback
// ---------------------------------------------------------------------------
function buildFallbackGamePack(p: { ideaText: string }): Record<string, string> {
  const slug = slugify(p.ideaText || "my-game");
  return {
    "GAME_DESIGN_DOC.md":      `# GAME_DESIGN_DOC.md\n\n## Concept\n${p.ideaText}\n\n## Core Loop\n1. Observe → 2. Decide → 3. Feedback → 4. Reward\n`,
    "SYSTEMS_ARCHITECTURE.md": `# SYSTEMS_ARCHITECTURE.md\n\n## Game Loop\n\`\`\`\nrequestAnimationFrame → update(dt) → render(ctx)\n\`\`\`\n\n## DO NOT TOUCH the game loop outside \`Game.js\`\n`,
    "ASSET_LIST.md":           `# ASSET_LIST.md\n\n- [ ] Player sprite\n- [ ] Enemy sprite\n- [ ] Background\n- [ ] sfx_hit, sfx_score, sfx_gameover, music_main\n`,
    "FUN_TEST.md":             `# FUN_TEST.md\n\n- [ ] Understood in 10 seconds\n- [ ] First input responsive\n- [ ] Core action fun to repeat\n- [ ] Failure feels fair\n- [ ] No crashes after 5 min\n\n## Slug: \`${slug}\`\n`,
  };
}

// ---------------------------------------------------------------------------
// Website fallback (backend version — used if AI call fails)
// ---------------------------------------------------------------------------
function buildFallbackWebsitePack(p: { ideaText: string; analysis?: ProjectInput["analysis"]; answers?: Record<string, string> }): Record<string, string> {
  const slug    = slugify(p.ideaText || "my-website");
  const appType = p.analysis?.appMeta?.label ?? "Website";
  const icon    = p.analysis?.appMeta?.icon   ?? "🌐";
  return {
    "SPEC.md":        `# SPEC.md — Site Specification\n\n## ${icon} ${appType}\n${p.ideaText}\n\n## ⚠️ Watch Out For\n${p.analysis?.warning ?? "_None._"}\n\n## Answers\n${formatAnswers(p.answers)}\n\n## Stack\n- Static React + Vite\n- Deploy: Vercel / Netlify\n- Forms: Formspree (no backend)\n`,
    "RULES.md":       `# RULES.md\n\n- No backend server in V1\n- Mobile-first design\n- One CTA per page\n- Lighthouse > 90 before launch\n- Real copy before design\n`,
    "CONTENT_MAP.md": `# CONTENT_MAP.md\n\n| Page | URL | Purpose |\n|------|-----|---------|\n| Home | / | First impression |\n| About | /about | Trust |\n| Services | /services | What you offer |\n| Contact | /contact | Lead capture |\n\n## Copy Checklist\n- [ ] Hero headline written\n- [ ] CTAs are action-oriented\n- [ ] Social proof added\n- [ ] No Lorem ipsum\n`,
    "SEO_PLAN.md":    `# SEO_PLAN.md\n\n## Technical SEO\n- [ ] Unique title per page (50-60 chars)\n- [ ] Meta description per page (140-160 chars)\n- [ ] OG tags set\n- [ ] sitemap.xml submitted\n- [ ] Lighthouse > 90\n\n## Analytics\n- [ ] GA4 or Plausible installed\n- [ ] Conversion event tracked\n`,
    "BUILD_PLAN.md":  `# BUILD_PLAN.md\n\n## Phase 1 ✅ — Shell\n- [x] Design tokens, layout, base components\n\n## Phase 2 — Pages & Content\n- [ ] All CONTENT_MAP.md pages built\n- [ ] Real copy and images\n\n## Phase 3 — Forms\n- [ ] Contact form + Formspree\n\n## Phase 4 — SEO\n- [ ] Lighthouse > 90\n- [ ] sitemap.xml\n\n## Phase 5 — Deploy\n- [ ] Vercel + custom domain\n- [ ] Analytics live\n\n## Slug: \`${slug}\`\n`,
  };
}

// ---------------------------------------------------------------------------
// Web App fallback — enhanced SPEC.md with DB schema + auth flow
// ---------------------------------------------------------------------------
function buildFallbackWebAppPack(p: { ideaText: string; analysis?: ProjectInput["analysis"]; answers?: Record<string, string> }): Record<string, string> {
  const appType = p.analysis?.appMeta?.label ?? "Web App";
  const icon    = p.analysis?.appMeta?.icon   ?? "⚡";
  const slug    = slugify(p.ideaText || "my-app");
  return {
    "SPEC.md": `# SPEC.md — Web App Specification\n\n## ${icon} ${appType}\n${p.ideaText}\n\n## ⚠️ Warning\n${p.analysis?.warning ?? "_None._"}\n\n## Answers\n${formatAnswers(p.answers)}\n\n## 🗄️ Database Schema\n\`\`\`sql\nCREATE TABLE users (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  email TEXT UNIQUE NOT NULL,\n  password_hash TEXT NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT now()\n);\n\nCREATE TABLE resources (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  title TEXT NOT NULL,\n  body TEXT,\n  status TEXT DEFAULT 'draft',\n  created_at TIMESTAMPTZ DEFAULT now()\n);\n\`\`\`\n\n## 🔐 Auth Flow\n\`\`\`\nPOST /api/auth/register → hash password → insert user → JWT\nPOST /api/auth/login    → verify hash  → JWT (HTTP-only cookie)\nAll protected routes    → requireAuth middleware → req.user\n\`\`\`\n\n## Auth Rules\n- bcrypt/Argon2, cost ≥ 12\n- JWTs expire in 24h\n- All data scoped to user_id\n`,
    "RULES.md":      `# RULES.md\n\n- Auth before any user data\n- Every route validates inputs (Zod)\n- All secrets in env vars\n- Stack: React + Vite + Express + PostgreSQL\n`,
    "BUILD_PLAN.md": `# BUILD_PLAN.md\n\n## Phase 1 ✅ — Foundation\n- [x] DB schema + seed\n- [x] App shell\n\n## Phase 2 — Auth\n- [ ] Sign-up + login\n- [ ] requireAuth middleware\n- [ ] Protected routes\n\n## Phase 3 — Core Feature\n- [ ] CRUD API routes\n- [ ] Frontend UI\n\n## Phase 4 — Polish\n- [ ] Loading/error states\n- [ ] Mobile\n\n## Phase 5 — Ship\n- [ ] Production DB\n- [ ] Sentry\n- [ ] Deploy\n\n## Slug: \`${slug}\`\n`,
    "TEST_PLAN.md":  `# TEST_PLAN.md\n\n## Auth\n- [ ] Sign-up creates user\n- [ ] Login returns token\n- [ ] Protected route returns 401 without token\n\n## Core Feature\n- [ ] Create/read/update/delete all work\n- [ ] Users cannot see other users' data\n\n## E2E\n- [ ] Sign up → login → create resource → logout → login → resource persists\n`,
    "APP_MAP.md":    `# APP_MAP.md\n\n| Method | Route | Auth | Description |\n|--------|-------|------|-------------|\n| POST | /api/auth/register | No | Create account |\n| POST | /api/auth/login | No | Get token |\n| GET | /api/resources | Yes | List resources |\n| POST | /api/resources | Yes | Create resource |\n| PATCH | /api/resources/:id | Yes | Update resource |\n| DELETE | /api/resources/:id | Yes | Delete resource |\n| GET | /api/health | No | Health check |\n\n## Slug: \`${slug}\`\n`,
  };
}

// ---------------------------------------------------------------------------
// POST /api/generate
// ---------------------------------------------------------------------------
router.post("/generate", async (req, res) => {
  const { project, isGame = false, mode: rawMode } = req.body as {
    isGame?: boolean;
    mode?: string;
    project?: ProjectInput;
  };

  if (!project?.ideaText || typeof project.ideaText !== "string") {
    res.status(400).json({ error: "project.ideaText is required." });
    return;
  }

  const safeProject = {
    ideaText: project.ideaText.trim().slice(0, 2000),
    analysis: project.analysis,
    answers:  project.answers ?? {},
  };

  const answersBlock = formatAnswers(safeProject.answers);
  const appType      = safeProject.analysis?.appMeta?.label ?? "Custom App";

  // Resolve mode: explicit flag > body mode field > isGame flag
  const gameMode    = isGame || Boolean(project.isGameMode);
  const resolvedMode = gameMode ? "game" : (rawMode ?? "standard");

  // =========================================================================
  // GAME MODE
  // =========================================================================
  if (resolvedMode === "game") {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are Project Brain in Game Builder Mode. Generate four markdown game documents for the user's game idea. Return ONLY a JSON object with these four keys: "GAME_DESIGN_DOC.md", "SYSTEMS_ARCHITECTURE.md", "ASSET_LIST.md", "FUN_TEST.md".\n\nGAME_DESIGN_DOC.md: concept, genre, core loop (10-second loop), player experience goals, mechanics table, art direction, unique selling point.\nSYSTEMS_ARCHITECTURE.md: game loop pseudocode, entity system, input system, state machine, 3-5 hard Scope Lock rules (e.g. "DO NOT TOUCH the game loop outside Game.js").\nASSET_LIST.md: sprites table (name, size, status checkboxes), audio table (sfx + music, event triggers, status), fonts/UI, asset rules.\nFUN_TEST.md: 10-Second Test (3 items), Core Loop Test (3 items specific to this game), Juice & Feel checklist, Progression checklist, Stability checklist.\n\nAll content must be specific to THIS game — no generic placeholders.`,
          },
          {
            role: "user",
            content: `Game Idea: ${safeProject.ideaText}\nGenre: ${appType}\nAnswers: ${answersBlock}\nWarning: ${safeProject.analysis?.warning ?? "N/A"}`,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { res.json(buildFallbackGamePack(safeProject)); return; }

      const p = parsed as Record<string, unknown>;
      const required = ["GAME_DESIGN_DOC.md", "SYSTEMS_ARCHITECTURE.md", "ASSET_LIST.md", "FUN_TEST.md"];
      if (!required.every((k) => typeof p[k] === "string")) { res.json(buildFallbackGamePack(safeProject)); return; }
      res.json(parsed);
    } catch (err) {
      console.error("[generate/game] AI call failed:", err);
      res.json(buildFallbackGamePack(safeProject));
    }
    return;
  }

  // =========================================================================
  // WEBSITE MODE — SPEC + RULES + CONTENT_MAP + SEO_PLAN + BUILD_PLAN
  // =========================================================================
  if (resolvedMode === "website") {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are Project Brain in Website Mode. Generate five markdown documents for a STATIC, content-focused website (no backend, no user accounts, no database). Return ONLY a JSON object with these five keys: "SPEC.md", "RULES.md", "CONTENT_MAP.md", "SEO_PLAN.md", "BUILD_PLAN.md".\n\nSPEC.md: site type, what the site does, target audience, goals, answers table, tech stack (React/Vite static, Vercel/Netlify, Formspree for forms).\nRULES.md: explicitly state NO backend/database in V1, mobile-first, one CTA per page, Lighthouse > 90, real copy before design.\nCONTENT_MAP.md: page structure table (page, URL, purpose, priority), reusable components table, copy hierarchy (what to write first), content checklist with checkboxes.\nSEO_PLAN.md: keyword strategy table, on-page SEO checklist with checkboxes, technical SEO checklist, performance checklist (Lighthouse targets), analytics setup checklist.\nBUILD_PLAN.md: 5 phases (Design Shell, Pages & Content, Forms, SEO & Performance, Deploy & Analytics), each with 3-5 checkbox tasks specific to this site.\n\nBe specific to THIS website idea. No generic content. The safe default is always the simplest approach: static HTML, no backend.`,
          },
          {
            role: "user",
            content: `Website Idea: ${safeProject.ideaText}\nType: ${appType}\nAnswers: ${answersBlock}\nWarning: ${safeProject.analysis?.warning ?? "N/A"}`,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { res.json(buildFallbackWebsitePack(safeProject)); return; }

      const p = parsed as Record<string, unknown>;
      const required = ["SPEC.md", "RULES.md", "CONTENT_MAP.md", "SEO_PLAN.md", "BUILD_PLAN.md"];
      if (!required.every((k) => typeof p[k] === "string")) { res.json(buildFallbackWebsitePack(safeProject)); return; }
      res.json(parsed);
    } catch (err) {
      console.error("[generate/website] AI call failed:", err);
      res.json(buildFallbackWebsitePack(safeProject));
    }
    return;
  }

  // =========================================================================
  // WEB APP MODE — standard 5 files, SPEC.md enhanced with DB schema + auth
  // =========================================================================
  const isWebApp = resolvedMode === "webapp";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are Project Brain — an expert technical product manager generating structured documentation for vibe-coders.

Generate five markdown documents for this ${isWebApp ? "WEB APPLICATION" : "app"}. Return ONLY a JSON object with these five keys: "SPEC.md", "RULES.md", "BUILD_PLAN.md", "TEST_PLAN.md", "APP_MAP.md".

SPEC.md must include:
- App type and emoji
- Core idea restated clearly
- Hidden complexity warning
- Clarification answers table
- 2-3 sentence technical summary
${isWebApp ? `- **🗄️ Database Schema section**: Write CREATE TABLE SQL for all tables this app needs (users table always first, then domain-specific tables with foreign keys, indexes for common queries)
- **🔐 Authentication Flow section**: Write the auth flow as a pseudocode block (sign-up, login, session/JWT, protected request pattern, logout). Add auth rules (password hashing, token expiry, data scoping by user_id)` : ""}

RULES.md: scope constraints for V1, tech stack, quality gates, security constraints.
BUILD_PLAN.md: 5 phases with 3-5 checkbox tasks each, Phase 1 marked done [x]. ${isWebApp ? "Phase 2 must always be Authentication." : ""}
TEST_PLAN.md: unit tests, component tests, integration tests, 3+ Playwright E2E scenarios specific to this app.
APP_MAP.md: frontend routes table (include auth required column for web apps), backend API routes table (include auth column), data flow description, tech stack summary.

Be specific to THIS idea. No generic placeholders.`,
        },
        {
          role: "user",
          content: `App Idea: ${safeProject.ideaText}\nApp Type: ${appType}${isWebApp ? " (Web App with user accounts and database)" : ""}\nWarning: ${safeProject.analysis?.warning ?? "N/A"}\n\nAnswers:\n${answersBlock}\n\nSummary: ${safeProject.analysis?.summary ?? "N/A"}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch {
      res.json(isWebApp ? buildFallbackWebAppPack(safeProject) : buildFallbackSpecPack(safeProject));
      return;
    }

    const p = parsed as Record<string, unknown>;
    const required = ["SPEC.md", "RULES.md", "BUILD_PLAN.md", "TEST_PLAN.md", "APP_MAP.md"];
    if (!required.every((k) => typeof p[k] === "string")) {
      res.json(isWebApp ? buildFallbackWebAppPack(safeProject) : buildFallbackSpecPack(safeProject));
      return;
    }
    res.json(parsed);
  } catch (err) {
    console.error("[generate] AI call failed:", err);
    res.json(isWebApp ? buildFallbackWebAppPack(safeProject) : buildFallbackSpecPack(safeProject));
  }
});

export default router;
