// ---------------------------------------------------------------------------
// sendCompanionMessage — POST /api/companion  (AI-powered on the API Server)
// action: "chat"     → multi-turn conversation with the Build Companion
// action: "recovery" → generate a targeted recovery prompt from a failure report
// ---------------------------------------------------------------------------
export async function sendCompanionMessage({ messages, projectBrain, flightLog, action = "chat", tier = "free" }) {
  const response = await fetch("/api/companion", {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ messages, projectBrain, flightLog, action, tier }),
  });

  if (response.status === 429) {
    const body = await response.json().catch(() => ({}));
    const err  = new Error(body.error ?? "Monthly limit reached.");
    err.blocked      = true;
    err.feature      = body.feature ?? "companion_message";
    err.featureLabel = body.featureLabel ?? "Build Companion messages";
    err.used         = body.used ?? 0;
    err.limit        = body.limit ?? 0;
    err.credits      = body.credits ?? 0;
    throw err;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Companion server returned ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}

// ---------------------------------------------------------------------------
// translateCompanionQuestion — POST /api/companion  action: "translate"
// Translates a confusing AI IDE question into plain English + exact response.
// ---------------------------------------------------------------------------
export async function translateCompanionQuestion({ question, rawIdea, specContext, projectType }) {
  const response = await fetch("/api/companion", {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ action: "translate", question, rawIdea, specContext, projectType }),
  });

  if (response.status === 429) {
    const body = await response.json().catch(() => ({}));
    const err  = new Error(body.error ?? "Monthly limit reached.");
    err.blocked      = true;
    err.feature      = body.feature ?? "question_translator";
    err.featureLabel = body.featureLabel ?? "AI Question Translator uses";
    err.used         = body.used ?? 0;
    err.limit        = body.limit ?? 0;
    err.credits      = body.credits ?? 0;
    throw err;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Companion server returned ${response.status}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// generateRecoveryPrompt — convenience wrapper for recovery action
// ---------------------------------------------------------------------------
export async function generateRecoveryPrompt({ issue, phase, projectBrain }) {
  const response = await fetch("/api/companion", {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ action: "recovery", issue, phase, projectBrain }),
  });

  if (response.status === 429) {
    const body = await response.json().catch(() => ({}));
    const err  = new Error(body.error ?? "Monthly limit reached.");
    err.blocked      = true;
    err.feature      = body.feature ?? "companion_message";
    err.featureLabel = body.featureLabel ?? "Build Companion messages";
    err.used         = body.used ?? 0;
    err.limit        = body.limit ?? 0;
    err.credits      = body.credits ?? 0;
    throw err;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Recovery server returned ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}

// ---------------------------------------------------------------------------
// translateBug — POST /api/debug — Bug Translator with 429 handling
// ---------------------------------------------------------------------------
export async function translateBug({ errorText, projectContext }) {
  const response = await fetch("/api/debug", {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ errorText, projectContext }),
  });

  if (response.status === 429) {
    const body = await response.json().catch(() => ({}));
    const err  = new Error(body.error ?? "Monthly limit reached.");
    err.blocked      = true;
    err.feature      = body.feature ?? "bug_translator";
    err.featureLabel = body.featureLabel ?? "Bug Translator uses";
    err.used         = body.used ?? 0;
    err.limit        = body.limit ?? 0;
    err.credits      = body.credits ?? 0;
    throw err;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Debug server returned ${response.status}`);
  }

  return response.json();
}
