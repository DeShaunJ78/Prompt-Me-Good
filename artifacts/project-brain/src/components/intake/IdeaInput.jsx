import { useState } from "react";
import { cn } from "@/lib/utils";

export default function IdeaInput({ onSubmit, loading }) {
  const [idea, setIdea] = useState("");

  const handleSubmit = () => {
    if (!idea.trim() || loading) return;
    onSubmit(idea.trim());
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
  };

  const canSubmit = idea.trim() && !loading;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5">
      <div className="relative">
        <textarea
          className="w-full rounded-2xl px-6 py-5 text-base leading-relaxed resize-none min-h-[160px] bg-surface border-[1.5px] border-panel text-heading placeholder:text-subtle caret-primary focus:outline-none focus:border-primary transition-colors duration-200 disabled:opacity-50"
          placeholder={"Describe what you want to build — be as vague or specific as you like.\n\nExample: \"A platform where dog owners can book local pet sitters\""}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
          autoFocus
        />
        <div className={cn("absolute bottom-4 right-4 text-xs text-subtle transition-opacity", idea.length > 20 ? "opacity-100" : "opacity-0")}>
          ⌘↵ to submit
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          "w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2",
          canSubmit
            ? "bg-cta text-inverse cursor-pointer shadow-glow-primary hover:opacity-90"
            : "bg-elevated text-subtle cursor-not-allowed"
        )}
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Analyzing your idea…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            Diagnose My Idea
          </>
        )}
      </button>
    </div>
  );
}
