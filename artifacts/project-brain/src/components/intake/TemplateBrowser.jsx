import { useState } from "react";
import { cn } from "@/lib/utils";
import { TEMPLATES, CATEGORY_LABELS, CATEGORY_EMOJIS, COMPLEXITY_COLORS } from "@/lib/templates";

const CATEGORIES = ["all", "web_app", "website", "game", "mobile", "ai"];

// ── Individual template card ──────────────────────────────────────────────
function TemplateCard({ template, onSelect }) {
  return (
    <button
      onClick={() => onSelect(template)}
      className={cn(
        "flex flex-col gap-3 p-4 rounded-2xl border text-left transition-all group",
        "border-panel bg-surface hover:border-primary/40 hover:bg-elevated active:scale-[0.98]",
      )}
    >
      {/* Emoji + type badge */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl leading-none">{template.emoji}</span>
        <span className={cn(
          "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0",
          COMPLEXITY_COLORS[template.complexity],
        )}>
          {template.complexity}
        </span>
      </div>

      {/* Name + description */}
      <div className="flex-1 flex flex-col gap-1">
        <p className="text-sm font-bold text-heading leading-snug group-hover:text-primary transition-colors">
          {template.name}
        </p>
        <p className="text-xs text-muted leading-relaxed">
          {template.description}
        </p>
      </div>

      {/* Category badge */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{CATEGORY_EMOJIS[template.category]}</span>
        <span className="text-[10px] font-semibold text-subtle">
          {template.categoryLabel}
        </span>
      </div>
    </button>
  );
}

// ── Main TemplateBrowser ──────────────────────────────────────────────────
export default function TemplateBrowser({ onSelect, onBack }) {
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered = activeCategory === "all"
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === activeCategory);

  return (
    <div className="fixed inset-0 z-40 bg-canvas flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-panel px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-xs text-subtle hover:text-body transition-colors shrink-0"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-base font-bold text-heading leading-none">Template Library</h2>
            <p className="text-[11px] text-muted mt-0.5">{TEMPLATES.length} starter templates — pick one and customize it</p>
          </div>
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div className="shrink-0 border-b border-panel px-4 overflow-x-auto">
        <div className="flex gap-1 py-3 min-w-max">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                activeCategory === cat
                  ? "bg-primary text-white"
                  : "text-subtle hover:text-body hover:bg-elevated",
              )}
            >
              {cat !== "all" && <span className="mr-1">{CATEGORY_EMOJIS[cat]}</span>}
              {CATEGORY_LABELS[cat]}
              {activeCategory === cat && (
                <span className="ml-1.5 text-white/70 font-normal">
                  {filtered.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Template grid ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
