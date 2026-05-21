import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ---------------------------------------------------------------------------
// Fallback — keyword-based classification used when the AI call fails
// ---------------------------------------------------------------------------
const APP_TYPES: Record<string, { label: string; icon: string; description: string }> = {
  marketplace: { label: "Marketplace",         icon: "🛒", description: "A platform connecting buyers and sellers." },
  saas:        { label: "SaaS Tool",            icon: "⚙️", description: "A subscription-based software service." },
  social:      { label: "Social / Community",   icon: "🤝", description: "A platform for users to connect and share." },
  content:     { label: "Content Platform",     icon: "📝", description: "A platform for publishing and consuming content." },
  ecommerce:   { label: "E-commerce Store",     icon: "🏪", description: "A store for selling products online." },
  internal:    { label: "Internal Tool",        icon: "🔧", description: "A dashboard or tool for your own team." },
  ai:          { label: "AI App",               icon: "🤖", description: "An AI-powered product or assistant." },
  other:       { label: "Custom App",           icon: "💡", description: "A unique or hybrid application." },
};

function keywordClassify(idea: string): string {
  const s = idea.toLowerCase();
  if (s.match(/market|buy|sell|rent|hire|book|connect.*provider/)) return "marketplace";
  if (s.match(/saas|tool|dashboard|manage|track|automate|workflow/)) return "saas";
  if (s.match(/social|community|forum|network|friend|follow|feed/))  return "social";
  if (s.match(/blog|content|publish|newsletter|media|article/))      return "content";
  if (s.match(/shop|store|product|ecommerce|cart|checkout/))         return "ecommerce";
  if (s.match(/internal|admin|ops|team|employee|crm/))               return "internal";
  if (s.match(/ai|gpt|llm|chatbot|assistant|generate|predict/))      return "ai";
  return "other";
}

const FALLBACK_WARNINGS: Record<string, string> = {
  marketplace: "Multi-sided marketplaces require careful trust & payments architecture — often 3× more complex than they appear.",
  saas:        "Real-time features and multi-tenancy add significant backend complexity — plan for these from day one.",
  social:      "Social feeds require fan-out architecture that is very hard to retrofit once you have real users.",
  content:     "User-generated content platforms need moderation, spam prevention, and storage pipelines.",
  ecommerce:   "Apps with payments need compliance work (PCI-DSS, fraud handling) beyond just Stripe integration.",
  internal:    "Geo-based features and SSO integrations can have unexpected complexity and enterprise security requirements.",
  ai:          "AI apps have hidden prompt-engineering, cost-control, and latency challenges that compound quickly.",
  other:       "Scope creep is the #1 killer of custom apps — nail down the core loop before adding anything else.",
};

const FALLBACK_QUESTIONS: Record<string, Array<{ id: string; text: string; safeDefault: string }>> = {
  marketplace: [
    { id: "q1", text: "Who are your two sides — who is buying and who is selling?", safeDefault: "Focus on one niche vertical first." },
    { id: "q2", text: "Will you handle payments in the platform, or connect buyers/sellers directly?", safeDefault: "Use Stripe Connect for in-platform payments." },
    { id: "q3", text: "How will you attract the first 10 sellers before you have any buyers?", safeDefault: "Manually recruit 10 sellers via outreach before launching." },
  ],
  default: [
    { id: "q1", text: "Who is the single most important user you're building this for?", safeDefault: "Pick one persona and ignore all others until validated." },
    { id: "q2", text: "What's the one thing your app does that nothing else does?", safeDefault: "If nothing unique comes to mind, do it manually as a service first." },
    { id: "q3", text: "What does success look like for your first 30 days after launch?", safeDefault: "Aim for 10 real users giving honest feedback." },
  ],
};

function buildFallback(ideaText: string) {
  const appType = keywordClassify(ideaText);
  const appMeta = APP_TYPES[appType] ?? APP_TYPES.other;
  const warning = FALLBACK_WARNINGS[appType] ?? FALLBACK_WARNINGS.other;
  const questions = FALLBACK_QUESTIONS[appType] ?? FALLBACK_QUESTIONS.default;
  return {
    appType,
    appMeta,
    warning,
    questions,
    summary: `This looks like a ${appMeta.label}. ${appMeta.description}`,
  };
}

// ---------------------------------------------------------------------------
// POST /api/analyze
// ---------------------------------------------------------------------------
router.post("/analyze", async (req, res) => {
  const { ideaText } = req.body as { ideaText?: string };

  if (!ideaText || typeof ideaText !== "string" || ideaText.trim().length < 5) {
    res.status(400).json({ error: "ideaText must be a non-empty string of at least 5 characters." });
    return;
  }

  const sanitized = ideaText.trim().slice(0, 2000);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert startup idea analyst and product strategist.
Analyse the user's app idea and return ONLY a JSON object with exactly this structure — no extra keys, no markdown:

{
  "appType": "<one of: marketplace | saas | social | content | ecommerce | internal | ai | other>",
  "appMeta": {
    "label": "<human-readable app type name>",
    "icon": "<single relevant emoji>",
    "description": "<one-sentence description of this app type>"
  },
  "warning": "<a specific, actionable hidden-complexity warning for THIS exact idea — 2-3 sentences, genuinely surprising and useful, not boilerplate>",
  "questions": [
    { "id": "q1", "text": "<strategic clarifying question specific to this idea>", "safeDefault": "<opinionated, actionable default answer>" },
    { "id": "q2", "text": "<strategic clarifying question specific to this idea>", "safeDefault": "<opinionated, actionable default answer>" },
    { "id": "q3", "text": "<strategic clarifying question specific to this idea>", "safeDefault": "<opinionated, actionable default answer>" }
  ],
  "summary": "<one-sentence summary of the idea and its classification>"
}

Rules:
- Be specific to THIS idea, not generic.
- The warning should be about a real technical or product pitfall this specific app type faces.
- Questions should be strategic, not obvious ("what colour?" is bad; "will you support teams or solo users?" is good).
- Safe defaults must be actionable and opinionated.`,
        },
        { role: "user", content: sanitized },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.json(buildFallback(sanitized));
      return;
    }

    const p = parsed as Record<string, unknown>;
    if (!p.appType || !p.appMeta || !p.warning || !Array.isArray(p.questions)) {
      res.json(buildFallback(sanitized));
      return;
    }

    res.json(parsed);
  } catch (err) {
    console.error("[analyze] AI call failed, using fallback:", err);
    res.json(buildFallback(sanitized));
  }
});

export default router;
