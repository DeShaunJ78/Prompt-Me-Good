import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ItemStatus   = "done" | "partial" | "missing" | "na";
type ItemPriority = "critical" | "high" | "medium" | "low";

interface ChecklistItem {
  id: string;
  label: string;
  status: ItemStatus;
  priority: ItemPriority;
  explanation: string;
}

interface Category {
  id: string;
  label: string;
  icon: string;
  items: ChecklistItem[];
}

interface LaunchReport {
  "LAUNCH_REPORT.md": string;
  "LAUNCH_CHECKLIST.md": string;
  score: number;
  categories: Category[];
}

// ---------------------------------------------------------------------------
// Score calculator
// ---------------------------------------------------------------------------
function calcScore(categories: Category[]): number {
  const deductions: Record<ItemPriority, number> = { critical: 15, high: 8, medium: 3, low: 1 };
  let score = 100;
  for (const cat of categories) {
    for (const item of cat.items) {
      if (item.status === "na" || item.status === "done") continue;
      const d = deductions[item.priority] ?? 3;
      score -= item.status === "partial" ? Math.round(d / 2) : d;
    }
  }
  return Math.max(0, Math.min(100, score));
}

function scoreLabel(score: number): string {
  if (score >= 81) return "Launch Ready! 🚀";
  if (score >= 61) return "Almost Ready";
  if (score >= 31) return "Needs Work";
  return "Not Ready";
}

// ---------------------------------------------------------------------------
// Fallback (used when AI call fails)
// ---------------------------------------------------------------------------
function buildFallback(projectSpec: string): LaunchReport {
  const today = new Date().toISOString().split("T")[0];

  const categories: Category[] = [
    {
      id: "production", label: "Production Requirements", icon: "⚙️",
      items: [
        { id: "env-vars", label: "Secrets and API keys stored as environment variables", status: "missing", priority: "critical", explanation: "Environment variables keep sensitive info like API keys out of your code. If they're hardcoded and your repo is public, anyone can steal them." },
        { id: "error-monitoring", label: "Error monitoring set up (Sentry, LogRocket, or similar)", status: "missing", priority: "high", explanation: "Error monitoring alerts you when something breaks in production so you can fix it before users complain." },
        { id: "prod-build", label: "App runs a production build (not dev mode)", status: "missing", priority: "high", explanation: "A production build is stripped of debugging code, making your app 2-5x faster for real users." },
        { id: "custom-domain", label: "Custom domain configured", status: "missing", priority: "medium", explanation: "A custom domain (myapp.com) looks professional. Platform URLs like .replit.app discourage users from sharing your link." },
      ],
    },
    {
      id: "security", label: "Security", icon: "🔒",
      items: [
        { id: "auth", label: "User authentication is fully implemented and tested", status: "missing", priority: "critical", explanation: "Without auth, anyone can access any user's data. If your app handles personal info, this is non-negotiable." },
        { id: "https", label: "HTTPS enabled on the production URL", status: "missing", priority: "critical", explanation: "HTTPS encrypts data in transit. Without it, passwords travel in plain text and browsers show a 'Not Secure' warning." },
        { id: "cors", label: "CORS configured to only allow trusted origins", status: "missing", priority: "high", explanation: "CORS controls which websites can call your API. Wide-open CORS lets any website abuse your backend." },
        { id: "input-validation", label: "User inputs validated and sanitized server-side", status: "missing", priority: "critical", explanation: "Input validation prevents users from injecting malicious code through form fields — one of the most common attack vectors." },
        { id: "no-secrets", label: "No API keys or passwords hardcoded in the codebase", status: "missing", priority: "critical", explanation: "Hardcoded secrets in code files can be stolen if your repo is public or your code is leaked." },
      ],
    },
    {
      id: "database", label: "Database", icon: "🗄️",
      items: [
        { id: "persistence", label: "Data persists between app restarts (not in-memory only)", status: "missing", priority: "critical", explanation: "In-memory storage loses all data on every restart. A real database keeps user data safe permanently." },
        { id: "backups", label: "Automated database backups configured", status: "missing", priority: "high", explanation: "Backups let you recover from accidental deletions or corruption. Most managed DB providers offer this in one click." },
        { id: "db-creds", label: "Database credentials in environment variables", status: "missing", priority: "critical", explanation: "Database passwords in code files can be used to access and wipe your entire database if leaked." },
        { id: "migrations", label: "All database migrations run in production", status: "missing", priority: "high", explanation: "If local migrations haven't been run in production, your app will crash trying to access tables that don't exist." },
      ],
    },
    {
      id: "legal", label: "Legal / Policy", icon: "⚖️",
      items: [
        { id: "terms", label: "Terms of Service page exists and is linked in the footer", status: "missing", priority: "high", explanation: "Terms of Service defines the rules of your app legally. Without it you have little protection if users misuse your service." },
        { id: "privacy-policy", label: "Privacy Policy page explains what data is collected", status: "missing", priority: "high", explanation: "A Privacy Policy is legally required in most countries when you collect any user data, including email addresses." },
        { id: "cookie-consent", label: "Cookie consent banner shown if using tracking cookies", status: "na", priority: "medium", explanation: "GDPR requires explicit consent before setting tracking cookies for EU users. A simple banner handles this." },
        { id: "data-deletion", label: "Users can delete their account and all data", status: "missing", priority: "medium", explanation: "GDPR and CCPA give users the right to permanent data deletion. You need a 'Delete my account' feature." },
      ],
    },
    {
      id: "mobile", label: "Mobile / Responsive", icon: "📱",
      items: [
        { id: "viewport", label: "Viewport meta tag present in HTML <head>", status: "missing", priority: "high", explanation: "Without the viewport meta tag, mobile browsers display your app zoomed out like a tiny desktop site." },
        { id: "responsive", label: "Layout responsive — no horizontal scrolling on mobile", status: "missing", priority: "high", explanation: "Over 50% of web traffic is mobile. Horizontal scrolling on phones causes most users to immediately leave." },
        { id: "touch-targets", label: "Buttons and links are at least 44×44px for easy tapping", status: "missing", priority: "medium", explanation: "Tiny tap targets frustrate mobile users. Apple and Google both recommend 44px minimum for interactive elements." },
        { id: "mobile-tested", label: "App tested on a real mobile device or emulator", status: "missing", priority: "high", explanation: "Desktop browser dev tools don't catch everything. Testing on a real phone finds issues that would frustrate launch-day users." },
      ],
    },
  ];

  const score = calcScore(categories);
  const label = scoreLabel(score);
  const totalItems = categories.flatMap(c => c.items).filter(i => i.status !== "na").length;
  const criticalLeft = categories.flatMap(c => c.items).filter(i => i.priority === "critical" && i.status === "missing").length;

  return {
    "LAUNCH_REPORT.md": `# LAUNCH_REPORT.md — Launch Readiness Report\n\n## 🚀 Score: ${score}% — ${label}\n\n_${criticalLeft} critical blockers · ${totalItems} total items_\n\n---\n\n## What Needs to Be Fixed\n\n${categories.flatMap(c => c.items).filter(i => i.priority === "critical" && i.status !== "done").map(i => `- ⛔ **${i.label}**`).join("\n") || "✅ No critical blockers"}\n\n---\n_Review LAUNCH_CHECKLIST.md for the full list._`,
    "LAUNCH_CHECKLIST.md": `# LAUNCH_CHECKLIST.md\n\n**Score: ${score}% — ${label}**\n\n---\n\n${categories.map(cat => `## ${cat.icon} ${cat.label}\n${cat.items.map(i => `- [${i.status === "done" ? "x" : " "}] ${i.label} _(${i.priority})_`).join("\n")}`).join("\n\n")}`,
    score,
    categories,
  };
}

// ---------------------------------------------------------------------------
// POST /api/launch
// ---------------------------------------------------------------------------
router.post("/launch", async (req, res) => {
  const { projectSpec } = req.body as { projectSpec?: string };

  if (!projectSpec || typeof projectSpec !== "string" || projectSpec.trim().length < 5) {
    res.status(400).json({ error: "projectSpec is required (min 5 chars)." });
    return;
  }

  const safeSpec = projectSpec.trim().slice(0, 6000);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are Project Brain's Launch Coach — a specialist who evaluates app launch readiness.

Analyze the provided project spec and return a JSON object with FOUR keys:

"LAUNCH_REPORT.md" (string): Markdown launch readiness report. Include:
- Score headline (e.g. "## 🚀 Score: 68% — Almost Ready")
- Summary paragraph (2-3 sentences about what's ready vs what needs work)
- Critical blockers section (list of ⛔ items)
- High priority section (list of 🟠 items)
- What's looking good section (✅ items)
- Footer: "Review LAUNCH_CHECKLIST.md for the full interactive checklist."

"LAUNCH_CHECKLIST.md" (string): Complete markdown checklist with [ ] / [x] syntax, grouped by category.

"score" (integer 0–100): Calculated as:
  Start at 100.
  Per item NOT done: subtract based on priority:
    critical missing = -15, critical partial = -7
    high missing = -8, high partial = -4
    medium missing = -3, medium partial = -1
    low missing = -1
    na items: no deduction
  Round to nearest integer, minimum 0.

"categories" (array): Exactly 5 categories IN THIS ORDER:
  1. { "id": "production", "label": "Production Requirements", "icon": "⚙️" }
  2. { "id": "security",   "label": "Security",               "icon": "🔒" }
  3. { "id": "database",   "label": "Database",               "icon": "🗄️" }
  4. { "id": "legal",      "label": "Legal / Policy",         "icon": "⚖️" }
  5. { "id": "mobile",     "label": "Mobile / Responsive",    "icon": "📱" }

Each category has "items" array. Each item:
{
  "id": string (unique kebab-case slug),
  "label": string (one line, action-oriented, what needs to be done),
  "status": "done" | "partial" | "missing" | "na",
  "priority": "critical" | "high" | "medium" | "low",
  "explanation": string (2-4 sentences in PLAIN ENGLISH for a non-developer — explain WHAT this is, WHY it matters for launch, and what "done" looks like concretely)
}

STATUS RULES:
- "done": spec explicitly states this is implemented/configured
- "partial": spec partially addresses this but leaves gaps
- "missing": spec doesn't mention this (or is ambiguous) — BE CONSERVATIVE
- "na": clearly not applicable (e.g. no database items if it's a static site with no backend)

PRIORITY RULES:
- "critical": security risk, data loss risk, or app breaks in production without this
- "high": app works but users experience significant problems or legal exposure
- "medium": should be done before launch but doesn't block it
- "low": nice to have, won't affect most users

REQUIRED ITEMS PER CATEGORY (generate 4–7 items relevant to this specific app):

PRODUCTION: env vars (if any secrets exist), error monitoring, prod build optimization,
  custom domain, deployment pipeline/CI, caching or CDN (if applicable)

SECURITY: auth implementation, HTTPS/SSL, CORS config, rate limiting (if API-heavy),
  input validation/sanitization, no secrets in codebase, secure session/cookie settings

DATABASE: data persistence (not in-memory), automated backups, DB credentials as env vars,
  migrations run in production, connection pooling (if applicable)

LEGAL: terms of service, privacy policy, cookie consent (if using tracking cookies),
  GDPR/data deletion right, age verification (if relevant to content)

MOBILE: viewport meta tag, responsive design (no h-scroll), touch target sizes,
  tested on mobile device, performance on slow connections, no deprecated APIs

CRITICAL INSTRUCTIONS:
- Be specific to THIS app — reference the actual tech stack and features mentioned
- The "explanation" MUST be in plain English — no jargon without immediate explanation
- Calibrate "done" strictly — if the spec doesn't explicitly confirm something, mark "missing"
- The "score" MUST mathematically match the item statuses using the formula above
- Items marked "na" should genuinely not apply (e.g., no DB section items for a static site)
- Write explanations as if talking to a first-time developer who is smart but non-technical`,
        },
        {
          role: "user",
          content: `Project Spec:\n${safeSpec}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch {
      res.json(buildFallback(safeSpec));
      return;
    }

    const p = parsed as Record<string, unknown>;
    const requiredKeys = ["LAUNCH_REPORT.md", "LAUNCH_CHECKLIST.md", "score", "categories"];

    if (!requiredKeys.every((k) => k in p) || !Array.isArray(p.categories)) {
      res.json(buildFallback(safeSpec));
      return;
    }

    // Re-calculate score from actual items to prevent AI hallucinating a wrong number
    const verifiedScore = calcScore(p.categories as Category[]);
    (p as Record<string, unknown>).score = verifiedScore;

    res.json(parsed);
  } catch (err) {
    console.error("[launch] AI call failed:", err);
    res.json(buildFallback(safeSpec));
  }
});

export default router;
