# System Prompt Audit — `/api/generate` (and siblings)

Source: `artifacts/api-server/src/routes/ai.ts`
Scope: `SYSTEM_PROMPT` used by `/generate` and `/generate-stream` (the headline "build me a prompt" path the homepage textarea hits). Notes also cover `IMAGE_PROMPT_ENHANCER`, `RUN_SYSTEM_PROMPT`, and the secondary `/generate-prompt` system message, since they share the same surface area.

---

## 1. Read-through: what the current prompt actually says

Current `SYSTEM_PROMPT` (verbatim):

> You are an expert prompt engineer. Your job is to take the user's goal and settings and write the most effective, structured AI prompt possible.
>
> Always include:
> - A role assignment ("Act as...")
> - The user's goal stated clearly
> - Specific constraints (tone, experience level, output format)
> - Instructions to avoid vague or generic advice
> - A closing instruction to end with the top 3 next actions
>
> If Money Mode is active: prioritize fast, practical, income-focused execution. Avoid theory.
> If Human Voice Mode is active: write in a natural, conversational tone. Avoid robotic phrasing.
> If Clarity Boost is active: add extra structure, headers, and explicit formatting instructions.
> If Expert Mode is active: skip simplified explanations. Assume advanced knowledge.
>
> Personality instructions:
> - Bold & Persuasive: write with confidence and conviction
> - Friendly & Conversational: warm, approachable, encouraging
> - Direct & Straightforward: no preamble, action-first
> - Faith-Based & Convicting: grounded in purpose and values
> - Street-Smart & Practical: real-world, no-nonsense
> - Luxury Brand Voice: elevated, aspirational, premium
> - Viral Social Media Voice: punchy, hook-driven, shareable
>
> Output ONLY the finished prompt text the user can paste directly into ChatGPT, Claude, Gemini, or another AI tool. No markdown fences, no preamble, no headers like 'Prompt:', no commentary.

The user message it is paired with is built by `buildUserMessageFromPayload` and looks like:

```
Goal: <500 chars>
Category: ...
Experience level: ...
Tone: ...
Output format: ...
Output language: ...
Personality: ...
Extra details: ...
Avoid: ...
Active modes: Money Mode, Clarity Boost
```

Generation runs against `gpt-4o-mini`, capped at 600 output tokens, no temperature set.

---

## 2. Weaknesses

### W1 — Conflates "the meta-prompt" with "the produced prompt"
The instruction "end with the top 3 next actions" is a rule the produced prompt should impose on the *downstream* model. But the way it's written, the meta-model can just as easily interpret it as "end YOUR output with 3 next actions" — i.e., write 3 actions itself rather than instructing the downstream AI to. The `Output ONLY` rule at the bottom partially corrects this, but the contradiction is real and shows up in outputs.

### W2 — "Always include" is a one-size-fits-all checklist
A user typing "write me a haiku about my dog" gets back a prompt with role assignment, constraints block, output format, and a "top 3 next actions" footer. That's bloated for short creative tasks and reads like ceremony. There's no instruction to *scale* prompt length and structure to the goal's complexity.

### W3 — Mode and personality flags are silently ignored when absent
The system prompt lists what to do *if* a mode is active. It never says what the default behavior is when none are active, and it never says "ignore modes that aren't listed in the user message." The model is left to infer this. In practice gpt-4o-mini handles it fine, but it's a fragile contract.

### W4 — No guidance on the produced prompt's *shape* or *length*
The system prompt tells the model what *sections* to include but never says how long the result should be, whether to use headers, whether to use second person ("You are…") or imperative voice, whether to inline examples, or whether to leave placeholders like `[YOUR_PRODUCT]`. Different runs produce wildly different shapes — sometimes 4 lines, sometimes 25 with H2s. Output token cap of 600 quietly truncates the long ones mid-sentence.

### W5 — No anti-pattern list
Prompt engineers know the things that make a prompt bad: hedging language ("try to", "if possible"), nested conditionals, vague qualifiers ("high-quality", "comprehensive"), restating the goal three times, asking the AI to "be creative." The current prompt says "avoid vague or generic advice" but only as something the produced prompt should tell the downstream AI — not as a rule for the meta-model itself. The prompts it writes still contain these tells.

### W6 — Personality bullets are too thin to differentiate output
"Bold & Persuasive: write with confidence and conviction" is barely an instruction. Without anchoring examples or banned words, gpt-4o-mini collapses several personalities (bold / direct / street-smart) toward the same baseline assertive register. Users picking different pills don't see meaningfully different prompts.

### W7 — No instruction on language/locale handling
`Output language` is passed through in the user message, but the system prompt never says "write the produced prompt in the requested output language, including the role assignment and section labels." Result: bilingual outputs where the structure is English and only the body is translated.

### W8 — The meta-model has no identity beyond "expert prompt engineer"
There's no mention of *who* the produced prompt is for (paste-into-chat use), no audience model (the user is non-technical, building side hustles, marketing copy, image prompts, etc.), and no quality bar to aim for. "Expert prompt engineer" is the same opener that ships in every public prompt-builder tool.

### W9 — Output cleanliness rule is repeated but not anchored
"No markdown fences, no preamble, no headers like 'Prompt:'" is good but lives only in the closing line. Outputs still occasionally start with `Sure! Here's your prompt:` or wrap the whole thing in ```` ``` ````. Repeating the cleanliness rule first AND last, or marking it with explicit "Hard rules:" framing, would catch more drift.

### W10 — No use of model-side parameters
`temperature` is unset (defaults to 1.0), `top_p` unset, no `response_format`. For a "produce a structured artifact" task this is loose. A lower temperature (0.4–0.6) would tighten consistency without losing the personality differentiation (which is driven by instructions, not sampling).

### Smaller issues
- `RUN_SYSTEM_PROMPT` is one line ("be specific, practical, and thorough") and doesn't tell the model that the user's prompt is *the whole instruction* — leading to occasional "Sure, I'll help with that…" preambles before the actual answer.
- `IMAGE_PROMPT_ENHANCER` enumerates good descriptors but never enforces a length ceiling; gpt-image-1 silently truncates at ~1000 chars.
- `/generate-prompt` (the secondary route at line 589) has its *own* differently-worded system prompt with similar intent. Two sources of truth that drift apart over time.

---

## 3. Proposed improvements

Each is independent. Pick any subset.

### P1 — Reframe as "compose a prompt FOR another AI", with explicit audience and quality bar
**Change:** Replace the opening with something like:

> You write prompts that a non-technical user will paste into ChatGPT, Claude, Gemini, or Perplexity. Your output IS the finished prompt — never an explanation of one. Optimize for: (1) the downstream AI producing a useful first answer with no follow-up questions, (2) the user being able to read and edit the prompt themselves.

**Rationale:** Gives the model a clear north star and an audience. Resolves W1 and W8 directly, helps W2 (a good first answer for "haiku" doesn't need 6 sections).
**Risk:** Very low. Pure instruction quality improvement.
**Scope:** ~6 lines changed in `SYSTEM_PROMPT`. No code change.

### P2 — Replace the "Always include" checklist with a length-scaled structure rule
**Change:**

> Match the prompt's structure to the goal's complexity:
> - Simple/creative goals (one task, no constraints): a single tight paragraph in second person.
> - Standard goals: role line, goal line, 2–4 bullet constraints, output format line.
> - Complex/multi-step goals: add a short context block and a numbered step plan.
>
> Only include a "next actions" closer when the goal is advisory or strategic. Do not append it to creative, code, or single-answer prompts.

**Rationale:** Fixes W2 and W4 — output stops feeling like a Mad Lib. Prevents the 600-token truncation by suppressing ceremony on short goals.
**Risk:** Low–medium. Some users may *like* the always-on next-actions footer; consider keeping it under "Clarity Boost" instead.
**Scope:** Replaces the 5-bullet block. No code change.

### P3 — Add a "Hard rules" / "Avoid" section for the meta-model itself
**Change:** Add a clearly-labeled block at the end:

> Hard rules — apply to YOUR output, not the produced prompt:
> - No preamble, no sign-off, no "Here's your prompt:".
> - No markdown code fences around the whole prompt.
> - No hedging words in the prompt you write: "try to", "if possible", "maybe", "high-quality", "comprehensive".
> - Do not restate the user's goal verbatim more than once.
> - Write in the user's requested output language end-to-end, including any role line and section labels.

**Rationale:** Hits W5, W7, W9 in one stroke. The "apply to YOUR output, not the produced prompt" framing also clarifies W1 (the closing-actions confusion).
**Risk:** Low. Adds ~7 lines.
**Scope:** Append to `SYSTEM_PROMPT`.

### P4 — Anchor each personality with a 1-line voice example
**Change:** Replace the thin personality bullets with concrete anchors, e.g.:

> - Bold & Persuasive: declarative, urgency-driven. Example opener: "You will…". Banned: "could", "might".
> - Friendly & Conversational: contractions, second person, light warmth. Example: "Let's…". Banned: "shall", "kindly".
> - Direct & Straightforward: imperative verbs, no adjectives. Example: "List 5…".
> - Luxury Brand Voice: long vowels, restraint, no exclamation marks. Example: "Crafted for…".
> - Viral Social Media Voice: hook-question opener, ≤14-word sentences. Example: "What if…".
>   …(etc for faith / street)

**Rationale:** Fixes W6. Even on gpt-4o-mini, anchoring + bans produces audibly different outputs. This is the highest-leverage qualitative improvement for users who toggle personalities.
**Risk:** Low. Slightly larger prompt (~12 extra lines), well within budget.
**Scope:** Rewrites the personality block. No code change.

### P5 — Lower `temperature` and add a `developer`-tier consistency hint
**Change:** Set `temperature: 0.5` on the `openai.chat.completions.create` call in `/generate` and `/generate-stream`. Optionally add `top_p: 0.9`.

**Rationale:** Addresses W10. Tighter sampling makes the structure-rules from P2 and the bans from P3/P4 actually stick. Personality differentiation comes from instructions, not entropy, so this doesn't flatten voice.
**Risk:** Low. Reversible in one line. A/B-able by the user.
**Scope:** 2 lines per call site. Smallest code change of the set.

### P6 (optional, larger) — Consolidate `/generate-prompt` and `/generate` onto one shared system prompt constant
**Change:** Extract `SYSTEM_PROMPT` to a shared module, have both routes import it. Delete the divergent inline string in `/generate-prompt`.

**Rationale:** Fixes the smaller "two sources of truth" issue. Prevents future audits from finding three drifted versions.
**Risk:** Low; minor regression risk if the two prompts were intentionally different (they don't appear to be — both want a paste-ready prompt).
**Scope:** ~10 lines, one new file or a top-of-file export.

---

## 4. Recommended starter bundle

If you want to ship the smallest high-impact change first: **P1 + P3 + P5** together. They're all low-risk, touch only the system prompt string and one parameter, and address the most visible quality issues (preambles, hedging language, English-shaped output in non-English runs, run-to-run inconsistency).

Add **P4** next if users are actively using personality pills — that's where the perceived-quality win is biggest.

Hold **P2** for last; it changes output *shape* and may surprise existing users, so it benefits from being its own release.

---

*Implementation is intentionally out of scope for this task — pick which of P1–P6 (or subsets) you want and the next task can apply them.*
