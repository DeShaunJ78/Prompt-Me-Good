import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/score
// Analyzes a project intake and returns a Spec Quality Score (0-100).
// ---------------------------------------------------------------------------
router.post("/score", async (req, res) => {
  const { rawIdea, answers, projectType } = req.body as {
    rawIdea?:    string;
    answers?:    Record<string, string>;
    projectType?: string;
  };

  if (!rawIdea) {
    res.status(400).json({ error: "rawIdea is required." });
    return;
  }

  const answersText = answers
    ? Object.entries(answers)
        .filter(([, v]) => v?.trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";

  const systemPrompt = `You are a senior software architect reviewing a project brief for AI-assisted development readiness. Score the spec across 5 dimensions and return ONLY a valid JSON object — no markdown, no explanation.

Schema:
{
  "score": <integer 0-100, weighted average>,
  "breakdown": {
    "clarity":   <integer 0-20, is the core concept and scope unambiguous?>,
    "userFlow":  <integer 0-20, are the main user journeys mapped out?>,
    "dataModel": <integer 0-20, is there clarity on what data needs storing and how?>,
    "auth":      <integer 0-20, is authentication and access control clearly defined?>,
    "edgeCases": <integer 0-20, are failure states and edge cases addressed?>
  },
  "gaps": [<2-5 specific, actionable strings — name the exact gap, not generic advice>],
  "summary": <one sentence: "Your spec is X% ready. [Key issue(s) to address].">
}

Scoring bands per dimension:
17-20 = Excellent, no ambiguity
12-16 = Good, minor gaps
7-11  = Needs work, rework likely
0-6   = Critical gap, do not build yet

Be strict. A well-written vague spec should still score low if technical specifics are absent. Gaps must be concrete — mention specific missing pieces (e.g. "User roles aren't defined — who is an admin vs. a regular user?"), not generic advice.`;

  const userContent = `Project type: ${projectType ?? "app"}

Raw idea:
${rawIdea}

Intake answers:
${answersText || "(none provided)"}`;

  try {
    const completion = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      messages:        [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature:     0.2,
      max_tokens:      900,
    });

    const raw    = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      score?:     number;
      breakdown?: Record<string, number>;
      gaps?:      string[];
      summary?:   string;
    };

    const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 50)));

    res.json({
      score,
      breakdown: parsed.breakdown ?? { clarity: 10, userFlow: 10, dataModel: 10, auth: 10, edgeCases: 10 },
      gaps:      parsed.gaps?.slice(0, 5) ?? ["Insufficient detail to assess automatically."],
      summary:   parsed.summary ?? `Your spec is ${score}% ready.`,
    });
  } catch (err) {
    console.error("[score]", err);
    res.status(500).json({ error: "Scoring failed", detail: String(err) });
  }
});

export default router;
