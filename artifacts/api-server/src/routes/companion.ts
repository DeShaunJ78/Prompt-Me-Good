import { Router } from "express";
import { getAuth } from "@clerk/express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { checkAndIncrement, FEATURE_LABELS as USAGE_FEATURE_LABELS } from "../lib/usage";

const router = Router();

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

interface FlightLogEntry {
  id?:         string;
  timestamp:   number;
  type:        string;
  title:       string;
  summary?:    string;
  projectName?: string;
}

// ---------------------------------------------------------------------------
// Format flight log entries for the system prompt
// ---------------------------------------------------------------------------
function formatFlightLog(entries?: FlightLogEntry[]): string {
  if (!entries?.length) return "";

  const lines = entries.slice(-5).map((e) => {
    const diff    = Date.now() - e.timestamp;
    let timeStr: string;
    if (diff < 60_000)        timeStr = "just now";
    else if (diff < 3_600_000) timeStr = `${Math.round(diff / 60_000)}m ago`;
    else if (diff < 86_400_000) timeStr = `${Math.round(diff / 3_600_000)}h ago`;
    else {
      const d = new Date(e.timestamp);
      timeStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    const summary = e.summary ? ` — ${e.summary}` : "";
    return `- ${timeStr}: ${e.title}${summary}`;
  });

  return `\n\nRecent Project History (Flight Recorder — use this for context-aware advice):\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// POST /api/companion
// ---------------------------------------------------------------------------
router.post("/companion", async (req, res) => {
  const { messages, projectBrain, action, flightLog, tier } = req.body as {
    messages?:    ChatMessage[];
    projectBrain?: Record<string, unknown>;
    action?:      "chat" | "recovery";
    issue?:       string;
    phase?:       Record<string, unknown>;
    flightLog?:   FlightLogEntry[];
    tier?:        string;
  };

  // Build tier-awareness block for the system prompt
  const TIER_FEATURES: Record<string, string[]> = {
    free:    ["Idea Doctor", "Generic AI prompts", "Markdown export", "3 Spec Packs/month"],
    builder: ["Everything in Free", "Unlimited Spec Packs", "Launch Coach", "Platform Adapters (Cursor/Replit/Lovable)", "Prompt chains", "Spec Quality Score"],
    pro:     ["Everything in Builder", "Feature Builder", "Flight Recorder", "Repo Doctor", "Debugger", "Priority support"],
  };
  const TIER_LOCKED: Record<string, string[]> = {
    free:    ["Launch Coach", "Platform Adapters", "Prompt Chains", "Spec Quality Score", "Feature Builder", "Flight Recorder", "Repo Doctor", "Debugger"],
    builder: ["Feature Builder", "Flight Recorder", "Repo Doctor", "Debugger"],
    pro:     [],
  };
  const userTier       = (tier && ["free", "builder", "pro"].includes(tier)) ? tier : "free";
  const tierFeatures   = TIER_FEATURES[userTier]?.join(", ")  ?? TIER_FEATURES.free.join(", ");
  const tierLocked     = TIER_LOCKED[userTier]?.join(", ")    ?? TIER_LOCKED.free.join(", ");
  const tierBlock      = `\n\nUser's Plan: ${userTier.charAt(0).toUpperCase() + userTier.slice(1)} tier\nAvailable: ${tierFeatures}${tierLocked ? `\nNOT available — do not suggest: ${tierLocked}` : ""}`;

  if (!action || !["chat", "recovery", "translate"].includes(action)) {
    res.status(400).json({ error: "action must be 'chat', 'recovery', or 'translate'." });
    return;
  }

  // Optional usage tracking — only applies to authenticated users
  const userId = getAuth(req)?.userId ?? null;
  if (userId) {
    const feature = action === "translate" ? "question_translator" : "companion_message";
    try {
      const { allowed, used, limit, credits } = await checkAndIncrement(userId, feature as "question_translator" | "companion_message");
      if (!allowed) {
        res.status(429).json({
          error:        `Monthly ${USAGE_FEATURE_LABELS[feature as keyof typeof USAGE_FEATURE_LABELS]} limit reached.`,
          blocked:      true,
          feature,
          featureLabel: USAGE_FEATURE_LABELS[feature as keyof typeof USAGE_FEATURE_LABELS],
          used,
          limit,
          credits,
        });
        return;
      }
    } catch (err) {
      console.error("[companion/usage-check]", err);
    }
  }

  const isFeatureMode = Boolean((projectBrain as { isFeatureMode?: boolean })?.isFeatureMode);
  const isLaunchMode  = Boolean((projectBrain as { isLaunchMode?: boolean })?.isLaunchMode);

  // Project context summary
  const contextBlock = projectBrain
    ? `Project: "${projectBrain.name ?? "Unnamed"}"
Mode: ${isLaunchMode ? "Launch Coach (preparing to launch)" : isFeatureMode ? "Feature Builder (adding to existing project)" : "New Project"}
App Type: ${(projectBrain as { analysis?: { appMeta?: { label?: string } } }).analysis?.appMeta?.label ?? "Unknown"}
Current Phase: ${projectBrain.currentStep ?? "Unknown"}
Build Progress: ${projectBrain.buildProgress ?? 0}%`
    : "No project context available.";

  // Mode-specific instructions
  const featureModeInstructions = isFeatureMode
    ? `\n\nIMPORTANT — FEATURE BUILDER MODE:
The user is ADDING A FEATURE to an EXISTING project, NOT building from scratch.
- Always emphasize working within the Scope Lock (only touching allowed files)
- Smallest possible change — add, don't replace
- Do NOT suggest refactoring existing code while implementing the feature
- Direct them to SCOPE_LOCK.md if unsure which files to touch
- Warn explicitly if they're about to touch something outside the Scope Lock`
    : "";

  const launchModeInstructions = isLaunchMode
    ? `\n\nIMPORTANT — LAUNCH COACH MODE:
The user is preparing to LAUNCH their app and reviewing their Launch Readiness Checklist.
- When they ask about any checklist item, explain it in plain English (max 5 sentences)
- Tell them what "done" looks like concretely — give a specific example
- If it's a Critical item, clearly state the risk of skipping it before launch
- Suggest the SIMPLEST way to check or implement it for their stack
- Never use jargon without immediately explaining it in plain terms
- Keep the tone encouraging — launching is an accomplishment, help them get there`
    : "";

  // Flight Recorder history
  const flightLogBlock = formatFlightLog(flightLog);

  // -------------------------------------------------------------------------
  // Translate mode — AI Question Translator
  // -------------------------------------------------------------------------
  if (action === "translate") {
    const { question, rawIdea, specContext, projectType } = req.body as {
      question?:    string;
      rawIdea?:     string;
      specContext?:  string;
      projectType?: string;
    };

    if (!question?.trim()) {
      res.status(400).json({ error: "question is required for translate action." });
      return;
    }

    const specBlock = [
      rawIdea     && `Project idea: ${rawIdea.slice(0, 800)}`,
      projectType && `App type: ${projectType}`,
      specContext  && `Spec context (answers so far):\n${specContext.slice(0, 1200)}`,
    ].filter(Boolean).join("\n\n");

    const systemPrompt = `You are the Build Companion AI Question Translator. Vibe-coders paste confusing questions their AI IDE asked them (Cursor, Windsurf, Replit, etc.) and you translate them into plain English and give them the exact response to paste back.

You know the user's project context. Use it to give a SPECIFIC answer for THEIR project — not generic advice.

Return ONLY valid JSON — no markdown, no code fences:
{
  "translation":    "<what the AI IDE is actually asking, in plain English. No jargon. 1-3 sentences.>",
  "recommendation": "<the safe default answer for THEIR specific project. If the spec makes it clear, say 'Based on your project, you need X because Y.' If not enough context, give the safest general recommendation. 1-3 sentences.>",
  "exactResponse":  "<the precise text they copy and paste back into their IDE. Complete and ready-to-use — no placeholders. Start with the direct answer, then brief rationale. 1-4 sentences.>",
  "specBased":      <true if answer was derived from their spec context, false if general>
}

Rules:
- Never hedge with 'it depends' — commit to a recommendation
- The exactResponse must work as a standalone message — no [brackets] or templates
- Pick the simplest option that fits their use case
- If the question is about a choice (database, auth, storage, etc.), pick one and explain why briefly`;

    const userContent = `AI IDE Question:\n"${question.trim()}"\n\n${specBlock || "No project context available."}`;

    try {
      const completion = await openai.chat.completions.create({
        model:           "gpt-4o-mini",
        messages:        [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userContent  },
        ],
        response_format: { type: "json_object" },
        temperature:     0.2,
        max_tokens:      700,
      });

      const raw    = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as {
        translation?:    string;
        recommendation?: string;
        exactResponse?:  string;
        specBased?:      boolean;
      };

      res.json({
        translation:    parsed.translation    ?? "Could not interpret this question.",
        recommendation: parsed.recommendation ?? "Use the simplest option for your project type.",
        exactResponse:  parsed.exactResponse  ?? question.trim(),
        specBased:      Boolean(parsed.specBased),
      });
    } catch (err) {
      console.error("[companion/translate]", err);
      res.status(500).json({ error: "Translation failed", detail: String(err) });
    }
    return;
  }

  // -------------------------------------------------------------------------
  // Chat mode
  // -------------------------------------------------------------------------
  if (action === "chat") {
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required for chat action." });
      return;
    }

    const safeMsgs = messages.slice(-20).map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 4000),
    }));

    const systemPrompt: ChatMessage = {
      role: "system",
      content: `You are the Build Companion — a calm, concise, expert coding advisor embedded inside Project Brain (a vibe-coder build tool).

Your persona:
- Plain English first, technical details second
- Never take irreversible actions — always explain before doing
- Calm and reassuring, even when things go wrong
- Concise: 2-4 sentences max unless the user explicitly asks for more
- You never guess — if you don't know, you say so and suggest a path forward

Project Context:
${contextBlock}${featureModeInstructions}${launchModeInstructions}${flightLogBlock}${tierBlock}

Rules:
- Use the Flight Recorder history above to give context-aware advice. If the history shows past struggles (recovery prompts, bugs), proactively flag similar risks.
- Stay focused on helping the user build their specific project
- If asked to write code, write it in a copyable code block
- If the user is stuck, suggest the smallest possible next action
- Never start a response with "Great!" or sycophantic phrases`,
    };

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        max_completion_tokens: 1024,
        messages: [systemPrompt, ...safeMsgs] as Parameters<typeof openai.chat.completions.create>[0]["messages"],
      });

      const response = completion.choices[0]?.message?.content ?? "I'm having trouble responding right now. Please try again.";
      res.json({ response });
    } catch (err) {
      console.error("[companion/chat] AI call failed:", err);
      res.json({ response: "I'm having trouble connecting right now. Check your network and try again — your progress is saved." });
    }
    return;
  }

  // -------------------------------------------------------------------------
  // Recovery mode
  // -------------------------------------------------------------------------
  if (action === "recovery") {
    const { issue, phase } = req.body as { issue?: string; phase?: Record<string, unknown> };

    if (!issue || typeof issue !== "string" || issue.trim().length < 3) {
      res.status(400).json({ error: "issue description is required for recovery action." });
      return;
    }

    const phaseTitle  = (phase?.title as string) ?? "Unknown Phase";
    const phaseId     = phase?.id ?? "?";
    const scopeLock   = Array.isArray(phase?.scopeLock) ? (phase.scopeLock as string[]).join(", ") : "N/A";
    const manualTests = Array.isArray(phase?.manualTests)
      ? (phase.manualTests as string[]).map((t) => `- [ ] ${t}`).join("\n")
      : "";

    const modeNote = isFeatureMode
      ? "\n\nFEATURE BUILDER MODE: Recovery steps must: (1) undo edits to files outside the Scope Lock, (2) verify no existing functionality was broken, (3) make the smallest possible change."
      : isLaunchMode
      ? "\n\nLAUNCH COACH MODE: Recovery steps should be specific to their tech stack and explain each step in plain English."
      : "";

    // Include flight history in recovery context for pattern recognition
    const recentIssues = (flightLog ?? [])
      .filter((e) => e.type === "bug_fix")
      .slice(-3)
      .map((e) => `- ${e.title}: ${e.summary ?? ""}`)
      .join("\n");

    const patternNote = recentIssues
      ? `\n\nRecent recovery history (look for patterns):\n${recentIssues}`
      : "";

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        max_completion_tokens: 1024,
        messages: [
          {
            role: "system",
            content: `You are Project Brain's recovery specialist. Generate a focused, actionable recovery prompt the user can paste into their AI coding tool.

Format:
### 🔧 Recovery Prompt — [Phase Title]
**Issue:** [restate clearly]
**Root Cause (likely):** [1-2 sentence diagnosis]
**Recovery Steps:** [numbered, 3-5 steps, specific]
**Files to check:** [scope-locked files only]
**Verify with:**
[checklist of manual tests]

Be specific and diagnostic. Every word should help fix the actual problem.${modeNote}${patternNote}`,
          },
          {
            role: "user",
            content: `Phase ${phaseId}: "${phaseTitle}"
Scope Lock: ${scopeLock}

Issue:
${issue.trim().slice(0, 1000)}

Manual tests:
${manualTests}

Project context:
${contextBlock}`,
          },
        ],
      });

      const response = completion.choices[0]?.message?.content ?? "";
      if (!response) {
        res.json({ response: `### 🔧 Recovery Prompt — ${phaseTitle}\n\n**Issue:** ${issue}\n\nPlease try reverting your last change and re-reading the Scope Lock. Only modify: ${scopeLock}.` });
        return;
      }
      res.json({ response });
    } catch (err) {
      console.error("[companion/recovery] AI call failed:", err);
      res.json({
        response: `### 🔧 Recovery Prompt — ${phaseTitle}\n\n**Issue:** ${issue}\n\n**Recovery Steps:**\n1. Undo any partial changes.\n2. Re-read the Scope Lock — only touch: ${scopeLock}\n3. Paste the original phase prompt again.\n4. Run the manual tests one by one.\n\nIf the issue persists, describe the exact error message.`,
      });
    }
  }
});

export default router;
