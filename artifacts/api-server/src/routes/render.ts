import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

function specPackToText(specPack: Record<string, string>): string {
  const priority = ["SPEC.md", "GAME_DESIGN_DOC.md", "FEATURE_SPEC.md", "LAUNCH_REPORT.md", "RULES.md", "BUILD_PLAN.md"];
  const ordered  = [...priority.filter((f) => specPack[f]), ...Object.keys(specPack).filter((k) => !priority.includes(k))];
  return ordered
    .map((file) => `=== ${file} ===\n${specPack[file]}`)
    .join("\n\n")
    .slice(0, 8000);
}

// ---------------------------------------------------------------------------
// POST /api/render
// Generates (or refines) a single-file HTML/CSS/JS prototype from a spec pack.
// ---------------------------------------------------------------------------
router.post("/render", async (req, res) => {
  const { specPack, ideaText, previousHtml, message } = req.body as {
    specPack?:     Record<string, string>;
    ideaText?:     string;
    previousHtml?: string;
    message?:      string;
  };

  if (!specPack && !ideaText) {
    res.status(400).json({ error: "specPack or ideaText is required." });
    return;
  }

  let systemContent: string;
  let userContent: string;

  if (previousHtml && message) {
    systemContent = `You are an expert frontend developer. The user has a working HTML prototype and wants a specific change applied. Return ONLY the complete updated single-file HTML document. No explanations, no markdown fences — raw HTML starting with <!DOCTYPE html>.`;
    userContent   = `Current prototype:\n\n${previousHtml}\n\n---\nApply this change: ${message}\n\nReturn the updated HTML file.`;
  } else {
    const specText = specPack ? specPackToText(specPack) : `App idea: ${ideaText}`;
    systemContent  = `You are an expert frontend developer. Generate a functional, visually impressive single-file HTML/CSS/JS prototype.

Rules:
- Return ONLY raw HTML. No markdown fences, no explanations, no commentary.
- Start with <!DOCTYPE html>. Fully self-contained — all CSS and JS inline.
- Use a dark UI: background #0F1117, surface #161821, accent teal #14B8A6, text #FFFFFF, muted #9CA3AF.
- Load Inter font via: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
- Make it look like a real, polished product — realistic sample data, not "Lorem ipsum" placeholders.
- Include working interactive elements: navigation tabs, buttons, forms, modals where relevant.
- Use localStorage for any data persistence (e.g., saved items, user preferences).
- Clean modern design: 8px radius cards, subtle borders (#1F2937), smooth hover transitions.
- Aim for maximum visual quality within ~300 lines.`;
    userContent    = `Build a functional prototype for this app:\n\n${specText}\n\nReturn only the raw HTML file.`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model:                "gpt-4.1",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: systemContent },
        { role: "user",   content: userContent   },
      ],
    });

    let html = completion.choices[0]?.message?.content ?? "";
    html = html.replace(/^```html?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    if (!html.toLowerCase().includes("<!doctype")) {
      res.status(500).json({ error: "AI returned invalid HTML. Please try again." });
      return;
    }

    res.json({ html });
  } catch (err) {
    console.error("[render] AI call failed:", err);
    res.status(500).json({ error: "Failed to generate prototype. Please try again." });
  }
});

export default router;
