import { useState } from "react";
import { cn } from "@/lib/utils";

export default function ClarifyingQuestions({ questions, onComplete }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [inputValue, setInputValue] = useState("");
  const [animating, setAnimating] = useState(false);

  const currentQuestion = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;
  const progress = (currentIdx / questions.length) * 100;

  const advance = (answer) => {
    if (animating) return;
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    setInputValue("");
    if (isLast) { onComplete(newAnswers); return; }
    setAnimating(true);
    setTimeout(() => { setCurrentIdx((i) => i + 1); setAnimating(false); }, 300);
  };

  const handleSubmit = () => { if (!inputValue.trim()) return; advance(inputValue.trim()); };
  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1 rounded-full overflow-hidden bg-panel">
          <div
            className="h-full rounded-full transition-all duration-500 bg-progress"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs tabular-nums shrink-0 text-subtle">
          {currentIdx + 1} / {questions.length}
        </span>
      </div>

      <div className="transition-opacity duration-300" style={{ opacity: animating ? 0 : 1 }}>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-primary">
            Clarifying Question {currentIdx + 1}
          </p>
          <p className="text-xl font-semibold leading-snug text-heading">
            {currentQuestion.text}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl px-4 py-3 text-sm bg-surface border-[1.5px] border-panel text-heading placeholder:text-subtle caret-primary focus:outline-none focus:border-primary transition-colors"
              placeholder="Your answer…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
            />
            <button
              onClick={handleSubmit}
              disabled={!inputValue.trim()}
              className={cn(
                "px-4 py-3 rounded-xl text-sm font-semibold transition-all shrink-0",
                inputValue.trim()
                  ? "bg-cta text-inverse cursor-pointer hover:opacity-90"
                  : "bg-elevated text-subtle cursor-not-allowed"
              )}
            >
              {isLast ? "Finish →" : "Next →"}
            </button>
          </div>

          <button
            onClick={() => advance(`[Safe Default] ${currentQuestion.safeDefault}`)}
            className="w-full py-3 px-4 rounded-xl text-sm transition-all text-left bg-secondary/6 border border-secondary/20 text-secondary hover:bg-secondary/12 hover:border-secondary/40"
          >
            <span className="font-semibold">🛡 I don't know — use safe default</span>
            <span className="block text-xs mt-0.5 opacity-80">{currentQuestion.safeDefault}</span>
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 justify-center">
        {questions.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i < currentIdx ? "bg-primary" : i === currentIdx ? "bg-teal-hover" : "bg-panel"
            )}
            style={{ width: i === currentIdx ? "24px" : "6px" }}
          />
        ))}
      </div>
    </div>
  );
}
