// ---------------------------------------------------------------------------
// Local fallback — used when the API server is unreachable
// ---------------------------------------------------------------------------
const APP_TYPES = {
  marketplace: { label: "Marketplace",       icon: "🛒", description: "A platform connecting buyers and sellers." },
  saas:        { label: "SaaS Tool",          icon: "⚙️", description: "A subscription-based software service." },
  social:      { label: "Social / Community", icon: "🤝", description: "A platform for users to connect and share." },
  content:     { label: "Content Platform",   icon: "📝", description: "A platform for publishing and consuming content." },
  ecommerce:   { label: "E-commerce Store",   icon: "🏪", description: "A store for selling products online." },
  internal:    { label: "Internal Tool",      icon: "🔧", description: "A dashboard or tool for your own team." },
  ai:          { label: "AI App",             icon: "🤖", description: "An AI-powered product or assistant." },
  other:       { label: "Custom App",         icon: "💡", description: "A unique or hybrid application." },
};

function keywordClassify(idea) {
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

function buildLocalFallback(ideaText) {
  const appType = keywordClassify(ideaText);
  const appMeta = APP_TYPES[appType] ?? APP_TYPES.other;
  return {
    appType,
    appMeta,
    warning: "Could not reach the AI server — showing keyword-based classification. Your idea was saved; try again when the connection is restored.",
    questions: [
      { id: "q1", text: "Who is the primary user you are building this for?",     safeDefault: "Pick one persona and validate before expanding." },
      { id: "q2", text: "What is the single most important action in your app?",  safeDefault: "Name the one thing users will do every session." },
      { id: "q3", text: "What does success look like after your first 30 days?",  safeDefault: "10 real users giving honest feedback." },
    ],
    summary: `This looks like a ${appMeta.label}. ${appMeta.description}`,
  };
}

// ---------------------------------------------------------------------------
// analyzeIdea — POST /api/analyze  (AI-powered on the API Server)
// Falls back gracefully to keyword classification if unreachable.
// ---------------------------------------------------------------------------
export async function analyzeIdea(ideaText) {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideaText }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Server returned ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      console.warn("[analyzeIdea] API server unreachable, using local fallback:", err.message);
      return buildLocalFallback(ideaText);
    }
    throw err;
  }
}
