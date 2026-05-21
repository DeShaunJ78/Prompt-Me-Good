import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { analyzeIdea } from "@/api/analyze";
import { sendCompanionMessage, translateCompanionQuestion } from "@/api/companion";
import { scoreIntake } from "@/api/score";
import SpecScoreGate from "@/components/intake/SpecScoreGate";
import TemplateBrowser from "@/components/intake/TemplateBrowser";
import { useTier } from "@/context/TierContext";

// ─── Stage IDs ────────────────────────────────────────────────────────────────
const S = { MANIFESTO: 0, RAW_IDEA: 1, DEEP_DIVE: 2, CLARIFY: 3, PREVIEW: 4, SCORE: 5 };

const STAGE_NAMES = ["", "Raw Idea", "Deep Dive", "Clarification", "Spec Preview", "Spec Score"];

// ─── Questions ────────────────────────────────────────────────────────────────
const UNIVERSAL_Q = [
  { id: "target_user", q: "Who is this for? Describe your ideal user — their age, their situation, what they struggle with, and what they want." },
  { id: "feel",        q: "What should it feel like to use? (e.g., fast and no-nonsense, warm and encouraging, premium and polished, fun and playful)" },
  { id: "must_do",     q: "What is the one thing your app absolutely must do well? If it only did one thing perfectly, what would that be?" },
  { id: "inspiration", q: "What apps or products have you seen that gave you inspiration? What did you like about them?" },
  { id: "worries",     q: "What are you most worried about? What could go wrong with this build?" },
];

const TYPE_Q = {
  app: [
    { id: "auth",        q: "Will users need to create accounts and log in?" },
    { id: "persistence", q: "Does your app need to store data that persists between sessions? (e.g., user profiles, saved items, history)" },
    { id: "payments",    q: "Will money change hands? Do you need payments, subscriptions, or a marketplace?" },
    { id: "competitors", q: "Who are your competitors? What will make yours different?" },
  ],
  game: [
    { id: "game_loop",   q: "What is the core game loop? What does the player do over and over?" },
    { id: "win_cond",    q: "What is the win condition or goal? How does a player know they are doing well?" },
    { id: "multiplayer", q: "Single player or multiplayer?" },
    { id: "visual",      q: "What is the visual style? (e.g., pixel art, cartoon, minimal, realistic)" },
  ],
  website: [
    { id: "cta",         q: "What is the primary action you want a visitor to take when they land on your site?" },
    { id: "features",    q: "Do you need a blog, portfolio, booking system, or e-commerce?" },
    { id: "brand",       q: "Do you have existing brand colors, fonts, or a logo?" },
    { id: "competitors", q: "Who are your competitors? What do their sites do well or poorly?" },
  ],
  ai: [
    { id: "inputs",    q: "What data or inputs will the AI work with?" },
    { id: "output",    q: "What does a perfect output look like? Give me an example." },
    { id: "frequency", q: "How often will this run — on demand, on a schedule, or triggered by an event?" },
    { id: "audience",  q: "Who will use this — just you, your team, or the public?" },
  ],
};

// ─── Warm acknowledgements (rotated) ─────────────────────────────────────────
const WARM_ACKS = [
  "That's really helpful. Knowing who this is for makes everything sharper.",
  "Great. That feeling is the product vision in one sentence — hold onto it.",
  "That's the core value proposition right there. Really useful.",
  "Interesting. A focused scope like that usually builds better.",
  "Smart to flag that early. A lot of projects hit exactly that wall.",
  "Good. That competitive awareness shapes a lot of decisions.",
  "Solid. That technical decision affects everything downstream.",
  "Perfect. Knowing the business model upfront prevents a lot of pivots.",
  "Really useful context. That's going straight into your spec.",
  "That's an honest answer, and those are often the most valuable ones.",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function detectType(analysis) {
  const label = (analysis?.appMeta?.label ?? "").toLowerCase();
  if (/game/.test(label))                       return "game";
  if (/website|landing|portfolio|blog/.test(label)) return "website";
  if (/ai|automation|bot|ml/.test(label))       return "ai";
  return "app";
}

async function callCompanion(prompt) {
  const data = await sendCompanionMessage({
    messages:    [{ role: "user", content: prompt }],
    projectBrain: {},
    action:      "chat",
  });
  return data;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function CompanionBubble({ role, text }) {
  return (
    <div className={cn("text-xs leading-relaxed rounded-xl px-3 py-2.5", {
      "bg-elevated border border-panel text-body":          role === "assistant",
      "bg-primary/10 border border-primary/20 text-primary font-semibold": role === "question",
      "bg-canvas border border-panel text-muted ml-3":      role === "user",
    })}>
      {text}
    </div>
  );
}

// ─── Translation result card ──────────────────────────────────────────────────
function TranslationResult({ result, onReset }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.exactResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (result.error) {
    return (
      <div className="flex flex-col gap-2">
        <div className="px-3 py-2.5 rounded-xl bg-error/10 border border-error/25 text-xs text-error leading-relaxed">
          {result.message ?? "We couldn't simplify that question right now — try again in a moment."}
        </div>
        <button onClick={onReset} className="text-[10px] text-subtle hover:text-body transition-colors self-start">
          ← Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* What it's asking */}
      <div className="rounded-xl bg-elevated border border-panel p-3 flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-subtle">🔍 What it's asking</span>
        <p className="text-[11px] text-body leading-relaxed">{result.translation}</p>
      </div>

      {/* Recommendation */}
      <div className="rounded-xl bg-elevated border border-panel p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-subtle">💡 Recommendation</span>
          {result.specBased && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-bold">
              From your spec
            </span>
          )}
        </div>
        <p className="text-[11px] text-body leading-relaxed">{result.recommendation}</p>
      </div>

      {/* Exact Response — highlighted, copyable */}
      <div className="rounded-xl bg-primary/5 border border-primary/30 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">📋 Paste this back</span>
          <button
            onClick={handleCopy}
            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 transition-all"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
        <pre className="text-[11px] text-primary/90 font-mono leading-relaxed whitespace-pre-wrap break-words bg-canvas rounded-lg px-2.5 py-2 border border-primary/15">
          {result.exactResponse}
        </pre>
      </div>

      <button onClick={onReset} className="text-[10px] text-subtle hover:text-body transition-colors self-start">
        ← Translate another question
      </button>
    </div>
  );
}

function ProgressDots({ current, total }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn("rounded-full transition-all duration-300", {
            "bg-primary w-5 h-1.5": i === current,
            "bg-primary/60 w-2 h-1.5": i < current,
            "bg-panel w-2 h-1.5":   i > current,
          })}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function IdeaFlow({ onComplete, userId, loading: specLoading }) {
  const [stage, setStage]       = useState(S.MANIFESTO);
  const { can, showUpgrade, isAdmin } = useTier();
  const [, setLocation]         = useLocation();

  // Builder mode: always starts null so the selector always appears on each new project session.
  // localStorage stores the *last* choice only to highlight the preferred card — not to skip the screen.
  const [builderMode, setBuilderMode] = useState(null);
  const savedMode = (() => {
    try { return localStorage.getItem("cmg_builder_mode") || null; } catch { return null; }
  })();

  // Stage 1
  const [rawIdea, setRawIdea]       = useState("");
  const [analyzing, setAnalyzing]   = useState(false);
  const [analysis, setAnalysis]     = useState(null);
  const [projectType, setProjectType] = useState(() => {
    try {
      const BUILDER_TYPE_MAP = { web_app: "app", website: "website", mobile: "app", game: "game", ai: "ai" };
      const saved = localStorage.getItem("cmg_builder_type");
      return (saved && BUILDER_TYPE_MAP[saved]) || "app";
    } catch { return "app"; }
  });

  // Stage 2
  const [allQuestions, setAllQuestions]   = useState([]);
  const [questionIdx, setQuestionIdx]     = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [answers, setAnswers]             = useState([]);   // [{id, q, a}]
  const [conversation, setConversation]   = useState([]);   // companion log
  const [ackIdx, setAckIdx]               = useState(0);

  // Stage 3
  const [gapQuestions, setGapQuestions] = useState([]);
  const [gapAnswers, setGapAnswers]     = useState({});     // {index: string}
  const [loadingGaps, setLoadingGaps]   = useState(false);

  // Template selection
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);
  const [selectedTemplate,    setSelectedTemplate]    = useState(null);

  // Stage 4
  const [specSummary, setSpecSummary]       = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Stage 5 — Spec Score Gate
  const [scoreData, setScoreData]           = useState(null);
  const [loadingScore, setLoadingScore]     = useState(false);
  const [gapFixMode, setGapFixMode]         = useState(false);
  const [gapFixMessages, setGapFixMessages] = useState([]);
  const [gapFixInput, setGapFixInput]       = useState("");
  const [gapFixIdx, setGapFixIdx]           = useState(0);
  const [gapFixAnswers, setGapFixAnswers]   = useState([]);

  const conversationEndRef = useRef(null);
  const answerRef          = useRef(null);
  const rawIdeaRef         = useRef(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  useEffect(() => {
    if (stage === S.RAW_IDEA) rawIdeaRef.current?.focus();
    if (stage === S.DEEP_DIVE) setTimeout(() => answerRef.current?.focus(), 80);
  }, [stage, questionIdx]);

  // ── Template selection ────────────────────────────────────────────────────
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setProjectType(template.projectType);
    setRawIdea(template.starterIdea);
    setShowTemplateBrowser(false);
    handleSetBuilderMode("guided");
    setStage(S.RAW_IDEA);
  };

  // ── Stage 0 → 1 ──────────────────────────────────────────────────────────
  const startPlanning = () => setStage(S.RAW_IDEA);

  // ── Stage 1 → 2 ──────────────────────────────────────────────────────────
  const handleRawIdeaContinue = async () => {
    if (rawIdea.trim().length < 100 || analyzing) return;
    setAnalyzing(true);
    try {
      const result = await analyzeIdea(rawIdea);
      const det    = result.analysis ?? {};
      setAnalysis(det);
      const type  = detectType(det);
      setProjectType(type);
      const qs    = [...UNIVERSAL_Q, ...(TYPE_Q[type] ?? TYPE_Q.app)];
      setAllQuestions(qs);
      setConversation([
        { role: "assistant", text: "Thanks for sharing that. I'm going to ask you a series of targeted questions — one at a time — so we can build the best possible spec. Take your time with each answer." },
        { role: "question",  text: qs[0].q },
      ]);
      setStage(S.DEEP_DIVE);
    } catch {
      const qs = [...UNIVERSAL_Q, ...TYPE_Q.app];
      setAllQuestions(qs);
      setConversation([
        { role: "assistant", text: "Thanks for sharing that. Let me ask a few targeted questions to sharpen your spec." },
        { role: "question",  text: qs[0].q },
      ]);
      setProjectType("app");
      setStage(S.DEEP_DIVE);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Stage 2: submit answer ────────────────────────────────────────────────
  const handleSubmitAnswer = useCallback(() => {
    const trimmed = currentAnswer.trim();
    if (trimmed.length < 5) return;

    const question   = allQuestions[questionIdx];
    const newAnswers = [...answers, { id: question.id, q: question.q, a: trimmed }];
    setAnswers(newAnswers);

    const ack     = WARM_ACKS[ackIdx % WARM_ACKS.length];
    const nextIdx = questionIdx + 1;
    setAckIdx((i) => i + 1);

    if (nextIdx < allQuestions.length) {
      setConversation((prev) => [
        ...prev,
        { role: "user",      text: trimmed },
        { role: "assistant", text: ack },
        { role: "question",  text: allQuestions[nextIdx].q },
      ]);
      setQuestionIdx(nextIdx);
      setCurrentAnswer("");
    } else {
      setConversation((prev) => [
        ...prev,
        { role: "user",      text: trimmed },
        { role: "assistant", text: "You've answered everything I needed. Brilliant work. Let me review your answers for any gaps before we write your spec..." },
      ]);
      setCurrentAnswer("");
      enterStage3(newAnswers);
    }
  }, [currentAnswer, allQuestions, questionIdx, answers, ackIdx]);

  // ── Stage 2 → 3 ──────────────────────────────────────────────────────────
  const enterStage3 = async (finalAnswers) => {
    setLoadingGaps(true);
    setStage(S.CLARIFY);

    const answersText = finalAnswers.map((a) => `Q: ${a.q}\nA: ${a.a}`).join("\n\n");
    const templateBlock = selectedTemplate
      ? `\nTemplate context: The user started from the "${selectedTemplate.name}" template. ${selectedTemplate.systemHint}\n`
      : "";

    const prompt = `INTAKE FLOW — Gap Analysis
${templateBlock}
You are reviewing a project intake interview. Based on the raw idea and all the answers below, identify exactly 2–4 important things that are still unclear, ambiguous, or potentially contradictory. Return ONLY a numbered list of specific, targeted questions — no preamble, no explanation.

User's raw idea:
${rawIdea}

Deep dive answers:
${answersText}

Return ONLY a numbered list like:
1. [Question]
2. [Question]
3. [Question]`;

    try {
      const response = await callCompanion(prompt);
      const lines    = (response ?? "").split("\n").filter((l) => /^\d+[.)]\s/.test(l.trim()));
      const qs       = lines.map((l) => l.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean).slice(0, 4);
      setGapQuestions(qs.length > 0 ? qs : [
        "What is your primary business model — how will this make money or deliver value?",
        "What happens on day one — what's the minimum viable version that would be useful?",
      ]);
    } catch {
      setGapQuestions([
        "What is the most critical feature that must work on launch day?",
        "How will you know this product is successful after 30 days?",
      ]);
    } finally {
      setLoadingGaps(false);
    }
  };

  // ── Stage 3 → 4 ──────────────────────────────────────────────────────────
  const handleGapContinue = async () => {
    setLoadingPreview(true);
    setStage(S.PREVIEW);

    const answersText = answers.map((a) => `Q: ${a.q}\nA: ${a.a}`).join("\n\n");
    const gapText     = gapQuestions.map((q, i) => `Q: ${q}\nA: ${gapAnswers[i] ?? "(not answered)"}`).join("\n\n");

    const templateBlock2 = selectedTemplate
      ? `Template context: The user started from the "${selectedTemplate.name}" template. ${selectedTemplate.systemHint}\n\n`
      : "";

    const prompt = `INTAKE FLOW — Spec Summary

${templateBlock2}Write a 3–5 paragraph plain-English spec summary for this project. Address the user directly (second person: "Your app will..."). Describe: what the product is, who it's for, its core features, the user experience, and any important technical or business considerations. Be specific and concrete. Sound like a senior developer confidently explaining the plan.

Raw idea:
${rawIdea}

Deep dive answers:
${answersText}

Clarification answers:
${gapText}

Write the summary now. No heading, no title — just the paragraphs.`;

    try {
      const summary = await callCompanion(prompt);
      setSpecSummary(summary ?? "Unable to generate summary. Please try again.");
    } catch {
      setSpecSummary(
        `Your app is a ${projectType} project. Based on your answers, the core focus is ${answers[2]?.a ?? "delivering a focused, high-quality experience"}. ${answers[0]?.a ? `It's built for ${answers[0].a}.` : ""} A detailed spec will be generated covering all the requirements you've described.`,
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  // ── Stage 4: approve → go to scoring ────────────────────────────────────
  const handleApprove = () => enterStage5();

  const handleClarify = () => {
    setConversation((prev) => [
      ...prev,
      { role: "assistant", text: "Of course — let's refine your answers. You can update your response to the last question, or start the deep dive from the beginning." },
    ]);
    setStage(S.DEEP_DIVE);
    setQuestionIdx(Math.max(0, allQuestions.length - 1));
  };

  const handleStartOver = () => {
    setStage(S.RAW_IDEA);
    setRawIdea(""); setAnalysis(null); setAllQuestions([]); setQuestionIdx(0);
    setCurrentAnswer(""); setAnswers([]); setConversation([]);
    setGapQuestions([]); setGapAnswers({}); setSpecSummary("");
    setScoreData(null); setGapFixMode(false); setGapFixMessages([]);
    setGapFixInput(""); setGapFixIdx(0); setGapFixAnswers([]);
    setSelectedTemplate(null);
  };

  const goBackStage = () => setStage((s) => Math.max(S.RAW_IDEA, s - 1));

  // ── AI Question Translator ────────────────────────────────────────────────
  const [translateMode, setTranslateMode]       = useState(false);
  const [translateInput, setTranslateInput]     = useState("");
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateResult, setTranslateResult]   = useState(null);

  const handleTranslate = async () => {
    if (!translateInput.trim() || translateLoading) return;
    setTranslateLoading(true);
    setTranslateResult(null);
    try {
      const specContext = [
        ...answers.map((a) => `${a.id}: ${a.a}`),
        ...Object.entries(gapAnswers).filter(([, v]) => v?.trim()).map(([k, v]) => `gap_${k}: ${v}`),
      ].join("\n");
      const result = await translateCompanionQuestion({
        question: translateInput,
        rawIdea,
        specContext,
        projectType,
      });
      setTranslateResult(result);
    } catch (err) {
      setTranslateResult({ error: true, message: "We couldn't simplify that question right now — try again in a moment." });
    } finally {
      setTranslateLoading(false);
    }
  };

  const handleTranslateClose = () => {
    setTranslateMode(false);
    setTranslateInput("");
    setTranslateResult(null);
  };

  const handleTranslateReset = () => {
    setTranslateInput("");
    setTranslateResult(null);
  };

  // ── Mode selector ─────────────────────────────────────────────────────────
  const handleSetBuilderMode = (mode) => {
    if (mode === "pro" && !can("feature_builder")) {
      showUpgrade("feature_builder");
      return;
    }
    setBuilderMode(mode);
    if (mode !== null) {
      try { localStorage.setItem("cmg_builder_mode", mode); } catch {}
    }
  };

  // Pro Mode: jump directly from brief to scoring
  const handleProGenerate = () => enterStage5();

  // ── Stage 4 → 5: score gate ───────────────────────────────────────────────
  const enterStage5 = async () => {
    setStage(S.SCORE);
    setLoadingScore(true);
    setGapFixMode(false);
    const compiled = {};
    answers.forEach((a)         => { compiled[a.id] = a.a; });
    gapQuestions.forEach((q, i) => { if (gapAnswers[i]?.trim()) compiled[`gap_${i}`] = gapAnswers[i]; });
    try {
      const result = await scoreIntake({ rawIdea, answers: compiled, projectType });
      setScoreData(result);
    } catch {
      setScoreData({
        score: 65,
        breakdown: { clarity: 13, userFlow: 12, dataModel: 13, auth: 13, edgeCases: 14 },
        gaps: ["Scoring failed — review your spec before generating."],
        summary: "Could not score automatically. Review your answers and generate when ready.",
      });
    } finally {
      setLoadingScore(false);
    }
  };

  // ── Stage 5: gap-fix companion chat ──────────────────────────────────────
  const openGapFix = () => {
    const gaps = scoreData?.gaps ?? [];
    setGapFixMode(true);
    setGapFixIdx(0);
    setGapFixAnswers([]);
    setGapFixMessages([{
      role: "assistant",
      text: gaps.length
        ? `I found ${gaps.length} gap${gaps.length > 1 ? "s" : ""} to address. Let's go through them. First: ${gaps[0]}`
        : "Let's review your spec. What would you like to improve?",
    }]);
  };

  const handleGapFixSend = () => {
    const answer  = gapFixInput.trim();
    const gaps    = scoreData?.gaps ?? [];
    if (!answer) return;
    const newAnswers  = [...gapFixAnswers, answer];
    const newMessages = [
      ...gapFixMessages,
      { role: "user",      text: answer },
    ];
    const nextIdx = gapFixIdx + 1;
    if (nextIdx < gaps.length) {
      newMessages.push({ role: "assistant", text: `Got it. Next gap: ${gaps[nextIdx]}` });
      setGapFixIdx(nextIdx);
    } else {
      newMessages.push({ role: "assistant", text: "You've addressed all the gaps. Your spec is in great shape — go ahead and generate." });
    }
    setGapFixMessages(newMessages);
    setGapFixAnswers(newAnswers);
    setGapFixInput("");
  };

  // ── Stage 5: final generate ───────────────────────────────────────────────
  const handleGenerateFinal = () => {
    const compiled = {};
    answers.forEach((a)         => { compiled[a.id] = a.a; });
    gapQuestions.forEach((q, i) => { if (gapAnswers[i]?.trim())  compiled[`gap_${i}`]   = gapAnswers[i]; });
    gapFixAnswers.forEach((a, i) => { if (a)                      compiled[`fix_${i}`]   = a; });
    onComplete({ rawIdea, analysis, answers: compiled, isGameMode: projectType === "game", projectType });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // ── Template Browser overlay ──────────────────────────────────────────────
  if (showTemplateBrowser) {
    return (
      <TemplateBrowser
        onSelect={handleTemplateSelect}
        onBack={() => setShowTemplateBrowser(false)}
      />
    );
  }

  // ── Mode Selector (always appears first, every new project session) ────────
  if (builderMode === null) {
    const proUnlocked = can("feature_builder");

    return (
      <div className="flex-1 flex items-center justify-center px-4 py-10 bg-canvas">
        <div className="w-full max-w-2xl flex flex-col gap-8">

          {/* Heading */}
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-heading">
              How do you want to build your spec?
            </h1>
            <p className="text-sm text-muted">Choose the path that fits how you work.</p>
          </div>

          {/* Cards — stack on mobile, side-by-side on sm+ */}
          <div className="flex flex-col sm:flex-row gap-4">

            {/* ── Guided Mode ── */}
            <button
              onClick={() => handleSetBuilderMode("guided")}
              className={cn(
                "flex-1 flex flex-col gap-4 p-6 rounded-2xl border-2 text-left active:scale-[0.99] transition-all",
                savedMode === "guided"
                  ? "border-primary bg-primary/8 shadow-lg shadow-primary/10"
                  : "border-primary/50 bg-primary/5 hover:bg-primary/10 hover:border-primary",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                    Recommended
                  </span>
                  {savedMode === "guided" && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-primary/70">
                      ← last used
                    </span>
                  )}
                </div>
                <span className="text-xl">🧭</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-heading mb-1.5">Guide me through it</h2>
                <p className="text-sm text-body leading-relaxed">
                  Answer a few questions and we'll build your spec together. Takes 5–10 minutes and produces the best results.
                </p>
              </div>
              <span className="text-xs font-semibold text-primary mt-auto">Start guided flow →</span>
            </button>

            {/* ── Pro Mode ── */}
            <button
              onClick={() => handleSetBuilderMode("pro")}
              className={cn(
                "flex-1 flex flex-col gap-4 p-6 rounded-2xl border text-left active:scale-[0.99] transition-all",
                proUnlocked
                  ? savedMode === "pro"
                    ? "border-primary/50 bg-elevated shadow-lg shadow-primary/5"
                    : "border-panel bg-elevated hover:border-primary/40 hover:bg-surface"
                  : "border-panel bg-elevated opacity-80 hover:border-panel/80 cursor-pointer",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                    proUnlocked
                      ? "bg-elevated text-subtle border-panel"
                      : "bg-elevated text-muted border-panel",
                  )}>
                    {proUnlocked ? "Pro" : "🔒 Pro"}
                  </span>
                  {savedMode === "pro" && proUnlocked && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-subtle">
                      ← last used
                    </span>
                  )}
                </div>
                <span className="text-xl">⚡</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-heading mb-1.5">I know what I'm building</h2>
                <p className="text-sm text-body leading-relaxed">
                  Skip the questions. Write your own brief and we'll generate your spec directly. Best for experienced builders with a clear vision.
                </p>
              </div>
              <span className={cn("text-xs font-semibold mt-auto", proUnlocked ? "text-subtle" : "text-muted")}>
                {proUnlocked ? "Write your brief →" : "Upgrade to Pro to unlock →"}
              </span>
            </button>

          </div>

          {/* Template Library — full-width card */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-panel" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-subtle">or</span>
              <div className="flex-1 h-px bg-panel" />
            </div>

            <button
              onClick={() => setShowTemplateBrowser(true)}
              className="w-full flex items-center justify-between gap-4 p-5 rounded-2xl border border-panel bg-surface hover:border-primary/30 hover:bg-elevated text-left active:scale-[0.99] transition-all group"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">📚</span>
                <div>
                  <h2 className="text-base font-bold text-heading mb-0.5">Start from a Template</h2>
                  <p className="text-sm text-body">
                    Pick a starter project type — {16} templates across web, mobile, game & AI.
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-subtle group-hover:text-primary transition-colors shrink-0 hidden sm:block">
                Browse templates →
              </span>
            </button>
          </div>

          {/* Subtle hint when a previous choice exists */}
          {savedMode && (
            <p className="text-center text-[11px] text-muted">
              Your last session used {savedMode === "guided" ? "Guided Mode" : "Pro Mode"} — both options are always available.
            </p>
          )}

          {/* ── Admin bypass ── */}
          {isAdmin && (
            <div className="border-t border-panel pt-4 flex flex-col items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-warning/80">Admin Mode</p>
              <button
                onClick={() => setLocation("/projects")}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-warning/10 border border-warning/30 text-warning text-xs font-bold hover:bg-warning/20 transition-all"
              >
                ⚡ Skip to Dashboard →
              </button>
            </div>
          )}

        </div>
      </div>
    );
  }

  // Spec generation in progress overlay
  if (specLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-canvas">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-heading">Generating your Spec Pack…</p>
          <p className="text-xs text-subtle">This takes about 30 seconds. Your plan is being crafted.</p>
        </div>
        <div className="flex flex-col gap-1.5 w-48 mt-2">
          {["Analyzing your idea", "Writing the spec", "Building the plan", "Creating test cases"].map((s, i) => (
            <div key={s} className="flex items-center gap-2 text-xs text-subtle">
              <span className="w-3 h-3 border border-primary/50 border-t-transparent rounded-full animate-spin" style={{ animationDelay: `${i * 200}ms` }} />
              {s}…
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Pro Mode: Brief Screen ────────────────────────────────────────────────
  if (builderMode === "pro" && stage === S.MANIFESTO) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10 bg-canvas">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          <div className="flex flex-col gap-1">
            <button
              onClick={() => handleSetBuilderMode(null)}
              className="text-xs text-subtle hover:text-body transition-colors self-start mb-2"
            >
              ← Switch mode
            </button>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-elevated text-subtle border border-panel">
                ⚡ Pro Mode
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-heading">Write your project brief.</h1>
            <p className="text-sm text-body leading-relaxed mt-1">
              Tell us everything about what you want to build. The more detail you provide, the better your spec will be. No format required — just write.
            </p>
          </div>

          <textarea
            aria-label="Project brief"
            className="w-full min-h-[180px] md:min-h-[280px] bg-elevated border border-panel rounded-xl px-4 py-4 text-sm text-body placeholder:text-muted resize-none focus:outline-none focus:border-primary/50 leading-relaxed transition-colors"
            placeholder="Describe your project in full. Who is it for? What does it do? What makes it different? What should it feel like to use?"
            value={rawIdea}
            onChange={(e) => setRawIdea(e.target.value)}
            autoFocus
          />

          <div className="flex items-center justify-between">
            <span className={cn("text-xs transition-colors", rawIdea.length >= 150 ? "text-success" : "text-subtle")}>
              {rawIdea.length} / 150 minimum
            </span>
            <button
              onClick={handleProGenerate}
              disabled={rawIdea.trim().length < 150}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-40 hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Generate My Spec →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Stage 0: Manifesto (Guided Mode) ─────────────────────────────────────
  if (stage === S.MANIFESTO) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="w-full max-w-2xl flex flex-col gap-6 sm:gap-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20 text-warning text-[11px] font-bold uppercase tracking-widest">
              ⚠ Read this first
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-heading leading-tight">
              "The #1 reason AI-built apps fail<br className="hidden sm:block" /> is not bad code.<br />It is a bad plan."
            </h1>
          </div>

          <div className="flex flex-col gap-3 text-sm sm:text-[15px] text-body leading-relaxed">
            <p>Your AI IDE will build exactly what you tell it to. If your instructions are vague, it will make assumptions. If your spec is incomplete, it will fill in the gaps — usually wrong. If you skip the planning phase, you will spend weeks fixing problems that a good spec would have prevented in 10 minutes.</p>
            <p>At CodeMeGood, we do not let you skip the planning phase. We are going to ask you some questions first. Take your time. The more honest and specific you are here, the better your app will be.</p>
            <p className="text-heading font-semibold text-base">This is the most important part of the whole process.</p>
          </div>

          <button
            onClick={startPlanning}
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base tracking-wide hover:opacity-90 active:scale-[0.99] transition-all shadow-lg"
          >
            I understand. Let's plan my project. →
          </button>
        </div>
      </div>
    );
  }

  // ── Stages 1–5: split layout ──────────────────────────────────────────────
  return (
    <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">

      {/* ── LEFT: Stage Content ── */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-canvas min-h-0">
        <div className="flex-1 flex flex-col gap-5 px-4 py-5 md:px-6 md:py-8 max-w-2xl mx-auto w-full">

          {/* ── Stage 1: Raw Idea ── */}
          {stage === S.RAW_IDEA && (
            <>
              {/* Template badge */}
              {selectedTemplate && (
                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{selectedTemplate.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 leading-none mb-0.5">Template</p>
                      <p className="text-xs font-semibold text-primary truncate">{selectedTemplate.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTemplateBrowser(true)}
                    className="text-[10px] font-semibold text-primary/60 hover:text-primary transition-colors shrink-0 whitespace-nowrap"
                  >
                    Change →
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">Stage 1 — The Raw Idea</span>
                </div>
                <h2 className="text-lg md:text-2xl font-bold text-heading leading-snug">
                  {selectedTemplate ? `Customize your ${selectedTemplate.name}.` : "Tell me everything about what you want to build."}
                </h2>
                <p className="text-sm text-body leading-relaxed">
                  {selectedTemplate
                    ? "We've pre-filled a starting idea from your template. Edit it to describe your specific take — who it's for, what makes it different, and what you need."
                    : "Don't worry about being technical. Just describe it like you're explaining it to a friend. What is it? Who is it for? What problem does it solve? What should it feel like to use?"}
                </p>
              </div>

              <textarea
                ref={rawIdeaRef}
                aria-label="Describe your project idea"
                className="w-full min-h-[120px] md:min-h-[180px] bg-elevated border border-panel rounded-xl px-4 py-3 text-sm text-body placeholder:text-muted resize-none focus:outline-none focus:border-primary/50 leading-relaxed transition-colors"
                placeholder="Describe what you want to build — be as specific as you like. Who is it for? What should it do? What problem does it solve?"
                value={rawIdea}
                onChange={(e) => setRawIdea(e.target.value)}
              />

              <div className="flex items-center justify-between">
                <span className={cn("text-xs transition-colors", rawIdea.length >= 100 ? "text-success" : "text-subtle")}>
                  {rawIdea.length} / 100 minimum
                </span>
                <button
                  onClick={handleRawIdeaContinue}
                  disabled={rawIdea.trim().length < 100 || analyzing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-40 hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  {analyzing ? (
                    <><span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" /> Analyzing…</>
                  ) : "Continue →"}
                </button>
              </div>
            </>
          )}

          {/* ── Stage 2: Deep Dive ── */}
          {stage === S.DEEP_DIVE && allQuestions.length > 0 && (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">Stage 2 — Creative Deep Dive</span>
                </div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-heading shrink-0">
                    Question {questionIdx + 1} of {allQuestions.length}
                  </h2>
                  <div className="flex-1 h-1.5 rounded-full bg-panel overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${((questionIdx) / allQuestions.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-elevated border border-panel rounded-xl px-5 py-4">
                <p className="text-base font-semibold text-heading leading-relaxed">{allQuestions[questionIdx]?.q}</p>
              </div>

              <div className="flex flex-col gap-3">
                <textarea
                  ref={answerRef}
                  className="w-full min-h-[110px] md:min-h-[140px] bg-elevated border border-panel rounded-xl px-4 py-3 text-sm text-body placeholder:text-muted resize-none focus:outline-none focus:border-primary/50 leading-relaxed transition-colors"
                  placeholder="Your answer…"
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmitAnswer(); }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-subtle hidden sm:block">⌘ Enter to continue</span>
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={currentAnswer.trim().length < 5}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-40 hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    {questionIdx < allQuestions.length - 1 ? "Next Question →" : "Finish Deep Dive →"}
                  </button>
                </div>
              </div>

              {/* Answered so far */}
              {answers.length > 0 && (
                <details className="group">
                  <summary className="text-xs text-subtle cursor-pointer hover:text-body transition-colors list-none flex items-center gap-1.5">
                    <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                    {answers.length} answered so far
                  </summary>
                  <div className="mt-3 flex flex-col gap-3 pl-4 border-l-2 border-panel">
                    {answers.map((a, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <p className="text-[11px] text-subtle leading-snug">{a.q}</p>
                        <p className="text-xs text-body">{a.a}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          {/* ── Stage 3: Clarify ── */}
          {stage === S.CLARIFY && (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">3</div>
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">Stage 3 — Clarification Round</span>
                </div>
                <h2 className="text-lg md:text-2xl font-bold text-heading">Almost there — a few final questions.</h2>
                <p className="text-sm text-body">I found a few things I'm still not sure about. Help me nail these before we write your spec.</p>
              </div>

              {loadingGaps ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-subtle">Reviewing your answers for gaps…</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {gapQuestions.map((q, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <p className="text-sm font-semibold text-heading leading-snug">
                        <span className="text-primary mr-1">{i + 1}.</span> {q}
                      </p>
                      <textarea
                        className="w-full min-h-[80px] bg-elevated border border-panel rounded-xl px-4 py-3 text-sm text-body placeholder:text-muted resize-none focus:outline-none focus:border-primary/50 transition-colors"
                        placeholder="Your answer…"
                        value={gapAnswers[i] ?? ""}
                        onChange={(e) => setGapAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                      />
                    </div>
                  ))}

                  {!loadingGaps && gapQuestions.length > 0 && (
                    <div className="flex justify-end">
                      <button
                        onClick={handleGapContinue}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
                      >
                        Continue to Spec Preview →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Stage 5: Score Gate ── */}
          {stage === S.SCORE && (
            <SpecScoreGate
              scoreData={scoreData}
              loading={loadingScore}
              onGenerate={handleGenerateFinal}
              onFixGaps={openGapFix}
            />
          )}

          {/* ── Stage 4: Preview ── */}
          {stage === S.PREVIEW && (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-success text-white text-xs font-bold flex items-center justify-center shrink-0">✓</div>
                  <span className="text-xs font-bold uppercase tracking-widest text-success">Stage 4 — Spec Preview</span>
                </div>
                <h2 className="text-lg md:text-2xl font-bold text-heading">Here's what we're about to build.</h2>
                <p className="text-sm text-body">Does this sound right?</p>
              </div>

              {loadingPreview ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-8 h-8 border-2 border-success border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-subtle">Writing your spec summary…</p>
                </div>
              ) : (
                <>
                  <div className="bg-elevated border border-panel rounded-xl p-6 flex flex-col gap-4">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-subtle">Spec Summary</span>
                    <div className="text-sm text-body leading-relaxed whitespace-pre-wrap">{specSummary}</div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleApprove}
                      className="w-full py-3.5 rounded-xl bg-success text-white font-bold text-sm hover:opacity-90 active:scale-[0.99] transition-all shadow-md"
                    >
                      ✓ Yes, this is exactly right. Generate my Spec.
                    </button>
                    <button
                      onClick={handleClarify}
                      className="w-full py-3 rounded-xl border border-panel bg-elevated text-body font-semibold text-sm hover:border-primary/40 hover:text-heading transition-all"
                    >
                      Almost — let me clarify a few things.
                    </button>
                    <button
                      onClick={handleStartOver}
                      className="w-full py-2.5 text-subtle text-sm hover:text-body transition-colors"
                    >
                      Start over
                    </button>
                  </div>
                </>
              )}
            </>
          )}

        </div>
      </div>

      {/* ── RIGHT: Companion Panel ── */}
      <div className="flex flex-col border-t border-panel md:border-t-0 md:border-l bg-surface overflow-hidden h-56 md:h-auto w-full md:w-72 md:shrink-0">

        {/* Header */}
        <div className="px-4 py-3 shrink-0 border-b border-panel">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">💬</span>
              <p className="text-xs font-bold uppercase tracking-widest text-subtle">Build Companion</p>
            </div>
            <button
              onClick={translateMode ? handleTranslateClose : () => setTranslateMode(true)}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all",
                translateMode
                  ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                  : "bg-elevated text-subtle border-panel hover:text-body hover:border-primary/30",
              )}
            >
              {translateMode ? "← Done" : "🔤 Translate"}
            </button>
          </div>
          {translateMode ? (
            <p className="text-[10px] text-subtle">Paste a confusing AI IDE question</p>
          ) : builderMode === "pro" ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-elevated text-subtle border border-panel">⚡ Pro Mode</span>
              <span className="text-[10px] text-subtle">Spec Score</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ProgressDots current={stage - 1} total={5} />
              <span className="text-[10px] text-subtle">{STAGE_NAMES[stage]}</span>
            </div>
          )}
        </div>

        {/* Message feed */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 min-h-0">

          {/* ── Translate mode ── */}
          {translateMode && (
            translateResult ? (
              <TranslationResult result={translateResult} onReset={handleTranslateReset} />
            ) : (
              <>
                <CompanionBubble role="assistant" text="Paste the confusing question your AI IDE asked you. I'll translate it and tell you exactly what to paste back." />
                <div className="flex flex-col gap-2 mt-1">
                  <textarea
                    className="w-full min-h-[80px] bg-canvas border border-panel rounded-xl px-2.5 py-2 text-xs text-body placeholder:text-muted resize-none focus:outline-none focus:border-primary/50 leading-relaxed transition-colors"
                    placeholder={'e.g. "Should we use a relational or document database?"'}
                    value={translateInput}
                    onChange={(e) => setTranslateInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTranslate(); } }}
                    autoFocus
                  />
                  <button
                    onClick={handleTranslate}
                    disabled={!translateInput.trim() || translateLoading}
                    className="flex items-center justify-center gap-2 py-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-40 hover:opacity-90 transition-all"
                  >
                    {translateLoading ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                        Translating…
                      </>
                    ) : "Translate →"}
                  </button>
                </div>
              </>
            )
          )}

          {/* ── Normal stage content ── */}
          {!translateMode && stage === S.RAW_IDEA && (
            <CompanionBubble role="assistant" text="Take your time here. The more you tell me, the better your spec will be. There are no wrong answers." />
          )}

          {!translateMode && stage === S.DEEP_DIVE && conversation.map((msg, i) => (
            <CompanionBubble key={i} role={msg.role} text={msg.text} />
          ))}

          {!translateMode && stage === S.CLARIFY && !loadingGaps && (
            <CompanionBubble role="assistant" text="Great work on the deep dive. I found a few things that are still a bit fuzzy. Answer these and your spec will be rock solid." />
          )}

          {!translateMode && stage === S.PREVIEW && !loadingPreview && (
            <CompanionBubble role="assistant" text="Read through your spec summary carefully. If something feels off, click 'Almost — let me clarify' and we'll fix it. Only generate the spec when you're confident this is right." />
          )}

          {!translateMode && stage === S.SCORE && !loadingScore && !gapFixMode && scoreData && (
            <>
              {builderMode === "pro" && scoreData.score < 80 ? (
                <>
                  <CompanionBubble role="assistant" text={`Your brief scored ${scoreData.score}%. Here are the gaps I found. Want me to help fill them in?`} />
                  <CompanionBubble role="question" text="Click 'Fix these gaps with Build Companion' and I'll walk you through each one." />
                </>
              ) : (
                <>
                  <CompanionBubble role="assistant" text={scoreData.summary} />
                  {scoreData.score < 80 && (
                    <CompanionBubble role="question" text="Click 'Fix these gaps with Build Companion' and I'll walk you through each issue one at a time." />
                  )}
                </>
              )}
            </>
          )}

          {!translateMode && stage === S.SCORE && gapFixMode && (
            <>
              {gapFixMessages.map((m, i) => (
                <CompanionBubble key={i} role={m.role} text={m.text} />
              ))}
              {gapFixAnswers.length < (scoreData?.gaps?.length ?? 0) && (
                <div className="flex gap-1.5 mt-1">
                  <input
                    className="flex-1 bg-canvas border border-panel rounded-lg px-2.5 py-1.5 text-xs text-body placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors"
                    placeholder="Your answer…"
                    value={gapFixInput}
                    onChange={(e) => setGapFixInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleGapFixSend(); }}
                    autoFocus
                  />
                  <button
                    onClick={handleGapFixSend}
                    disabled={!gapFixInput.trim()}
                    className="px-2.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-40 hover:opacity-90 transition-all"
                  >
                    →
                  </button>
                </div>
              )}
              {gapFixAnswers.length >= (scoreData?.gaps?.length ?? 0) && (
                <button
                  onClick={handleGenerateFinal}
                  className="w-full mt-1 py-2 rounded-lg bg-success text-white text-xs font-bold hover:opacity-90 transition-all"
                >
                  ✓ Generate my Spec Pack
                </button>
              )}
            </>
          )}

          <div ref={conversationEndRef} />
        </div>

        {/* Back button */}
        {!translateMode && stage > S.RAW_IDEA && stage < S.SCORE && !loadingGaps && !loadingPreview && !loadingScore && (
          <div className="px-3 py-2.5 border-t border-panel shrink-0">
            <button
              onClick={goBackStage}
              className="w-full text-xs text-subtle border border-panel rounded-lg py-1.5 hover:text-body transition-all"
            >
              ← Back to previous stage
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
