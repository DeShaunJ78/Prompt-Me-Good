import { Router } from "express";
import { getAuth } from "@clerk/express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { checkAndIncrement, FEATURE_LABELS as USAGE_FEATURE_LABELS } from "../lib/usage";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/debug
// Takes an error message / stack trace / bug description and returns a
// plain-English breakdown with a safe fix prompt and a prevention rule.
// ---------------------------------------------------------------------------
router.post("/debug", async (req, res) => {
  const { errorText, projectContext } = req.body as {
    errorText?:      string;
    projectContext?: string;
  };

  if (!errorText?.trim()) {
    res.status(400).json({ error: "errorText is required." });
    return;
  }

  // Optional usage tracking — only applies to authenticated users
  const userId = getAuth(req)?.userId ?? null;
  if (userId) {
    try {
      const { allowed, used, limit, credits } = await checkAndIncrement(userId, "bug_translator");
      if (!allowed) {
        res.status(429).json({
          error:        `Monthly ${USAGE_FEATURE_LABELS.bug_translator} limit reached.`,
          blocked:      true,
          feature:      "bug_translator",
          featureLabel: USAGE_FEATURE_LABELS.bug_translator,
          used,
          limit,
          credits,
        });
        return;
      }
    } catch (err) {
      console.error("[debug/usage-check]", err);
    }
  }

  const systemPrompt = `You are a senior developer who specialises in translating technical errors into plain English for vibe-coders and non-technical builders. Your goal is clarity, not cleverness.

Return ONLY a valid JSON object — no markdown, no code fences, no text outside the JSON.

Schema:
{
  "explanation":    "<plain-English explanation of what went wrong — no jargon. Written for someone who may not be a developer. 2-4 sentences.>",
  "rootCause":      "<the underlying technical reason this happened, explained simply. 1-2 sentences.>",
  "safeFixPrompt":  "<the exact prompt the user should paste into their AI IDE (Cursor, Windsurf, etc.) to fix this bug without breaking anything else. Begin with 'Fix the following bug:' and include the specific change needed plus guardrails to prevent side effects. 3-6 sentences.>",
  "preventionRule": "<a single, clear rule to add to their RULES.md file so the AI IDE avoids this class of bug in future. Begin with 'RULE:' and be specific to this exact error pattern. 1-2 sentences.>"
}

Rules:
- Be specific. Generic advice is useless.
- Tailor safeFixPrompt and preventionRule to the EXACT error pattern provided.
- Never say "it depends" — commit to the most likely cause and fix.
- If the input is a plain-English description (not a stack trace), infer the most probable technical cause.`;

  const userContent = projectContext?.trim()
    ? `Project context:\n${projectContext}\n\nError / bug report:\n${errorText}`
    : `Error / bug report:\n${errorText}`;

  try {
    const completion = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      messages:        [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userContent  },
      ],
      response_format: { type: "json_object" },
      temperature:     0.25,
      max_tokens:      900,
    });

    const raw    = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      explanation?:    string;
      rootCause?:      string;
      safeFixPrompt?:  string;
      preventionRule?: string;
    };

    res.json({
      explanation:    parsed.explanation    ?? "Unable to interpret this error.",
      rootCause:      parsed.rootCause      ?? "Root cause could not be determined.",
      safeFixPrompt:  parsed.safeFixPrompt  ?? "Fix the following bug: (see error above)",
      preventionRule: parsed.preventionRule ?? "RULE: Always validate inputs before use.",
    });
  } catch (err) {
    console.error("[debug]", err);
    res.status(500).json({ error: "Debug analysis failed", detail: String(err) });
  }
});

export default router;
