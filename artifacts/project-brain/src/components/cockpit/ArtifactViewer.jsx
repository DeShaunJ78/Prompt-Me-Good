import { useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useProjectBrain } from "@/context/ProjectBrainContext";

// ---------------------------------------------------------------------------
// File metadata — standard, game, website, feature, and launch files
// ---------------------------------------------------------------------------
const FILE_META = {
  // Standard / Web App
  "SPEC.md":                 { icon: "📋", colorClass: "text-primary" },
  "RULES.md":                { icon: "📏", colorClass: "text-secondary" },
  "BUILD_PLAN.md":           { icon: "🗺️",  colorClass: "text-teal-hover" },
  "TEST_PLAN.md":            { icon: "✅", colorClass: "text-secondary-soft" },
  "APP_MAP.md":              { icon: "🔗", colorClass: "text-bright" },
  // Game
  "GAME_DESIGN_DOC.md":      { icon: "🎮", colorClass: "text-warning" },
  "SYSTEMS_ARCHITECTURE.md": { icon: "⚙️",  colorClass: "text-primary" },
  "ASSET_LIST.md":           { icon: "🖼️",  colorClass: "text-secondary" },
  "FUN_TEST.md":             { icon: "🕹️",  colorClass: "text-secondary-soft" },
  // Website
  "CONTENT_MAP.md":          { icon: "🗺️",  colorClass: "text-primary" },
  "SEO_PLAN.md":             { icon: "🔍", colorClass: "text-secondary" },
  // Feature Builder
  "FEATURE_SPEC.md":         { icon: "🧩", colorClass: "text-secondary" },
  "SCOPE_LOCK.md":           { icon: "🔒", colorClass: "text-error" },
  "INTEGRATION_PLAN.md":     { icon: "🔗", colorClass: "text-primary" },
  "CONFLICT_WARNINGS.md":    { icon: "⚠️",  colorClass: "text-warning" },
  // Launch Coach
  "LAUNCH_REPORT.md":        { icon: "🚀", colorClass: "text-success" },
  "LAUNCH_CHECKLIST.md":     { icon: "✅", colorClass: "text-primary" },
};

const STANDARD_FILE_ORDER = ["SPEC.md", "RULES.md", "BUILD_PLAN.md", "TEST_PLAN.md", "APP_MAP.md"];
const GAME_FILE_ORDER     = ["GAME_DESIGN_DOC.md", "SYSTEMS_ARCHITECTURE.md", "ASSET_LIST.md", "FUN_TEST.md"];
const WEBSITE_FILE_ORDER  = ["SPEC.md", "RULES.md", "CONTENT_MAP.md", "SEO_PLAN.md", "BUILD_PLAN.md"];
const FEATURE_FILE_ORDER  = ["CONFLICT_WARNINGS.md", "SCOPE_LOCK.md", "FEATURE_SPEC.md", "INTEGRATION_PLAN.md"];
const LAUNCH_FILE_ORDER   = ["LAUNCH_REPORT.md", "LAUNCH_CHECKLIST.md"];

const GAME_FILE_KEYS    = new Set(GAME_FILE_ORDER);
const WEBSITE_FILE_KEYS = new Set(["CONTENT_MAP.md", "SEO_PLAN.md"]);
const FEATURE_FILE_KEYS = new Set(FEATURE_FILE_ORDER);
const LAUNCH_FILE_KEYS  = new Set(LAUNCH_FILE_ORDER);

function detectPackMode(pack) {
  if (!pack) return "standard";
  const keys = Object.keys(pack);
  if (keys.some((k) => LAUNCH_FILE_KEYS.has(k)))   return "launch";
  if (keys.some((k) => GAME_FILE_KEYS.has(k)))     return "game";
  if (keys.some((k) => FEATURE_FILE_KEYS.has(k)))  return "feature";
  if (keys.some((k) => WEBSITE_FILE_KEYS.has(k)))  return "website";
  return "standard";
}

const MODE_META = {
  game:     { label: "Game Pack",    badge: "🎮 Game Mode",    badgeClass: "bg-warning/12 text-warning border-warning/25" },
  website:  { label: "Site Pack",    badge: "🌐 Website Mode", badgeClass: "bg-primary/10 text-primary border-primary/25" },
  feature:  { label: "Feature Pack", badge: "🧩 Feature Mode", badgeClass: "bg-secondary/10 text-secondary border-secondary/25" },
  launch:   { label: "Launch Pack",  badge: "🚀 Launch Mode",  badgeClass: "bg-success/10 text-success border-success/25" },
  standard: { label: "Spec Pack",    badge: null,              badgeClass: "" },
};

// ---------------------------------------------------------------------------
// Markdown modal
// ---------------------------------------------------------------------------
function MarkdownModal({ filename, content, onClose }) {
  const meta = FILE_META[filename] ?? { icon: "📄", colorClass: "text-muted" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden bg-surface border border-panel">
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-panel">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{meta.icon}</span>
            <span className={cn("font-semibold text-sm font-mono", meta.colorClass)}>{filename}</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-sm bg-elevated text-subtle hover:bg-panel hover:text-body">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 className="text-heading text-xl font-bold mb-3 mt-4">{children}</h1>,
              h2: ({ children }) => <h2 className="text-heading text-base font-semibold mb-2 mt-5 pb-1 border-b border-panel">{children}</h2>,
              h3: ({ children }) => <h3 className="text-body text-sm font-semibold mb-1.5 mt-4">{children}</h3>,
              p:  ({ children }) => <p className="text-body text-sm leading-relaxed mb-3">{children}</p>,
              ul: ({ children }) => <ul className="text-body text-sm pl-5 mb-3 leading-relaxed list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="text-body text-sm pl-5 mb-3 leading-relaxed list-decimal">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              strong: ({ children }) => <strong className="text-heading font-semibold">{children}</strong>,
              code: ({ inline, children }) =>
                inline
                  ? <code className="bg-elevated text-primary px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                  : <code className="block bg-canvas-deep text-body px-4 py-3 rounded-lg text-xs font-mono leading-relaxed mb-3 border border-panel whitespace-pre-wrap">{children}</code>,
              pre: ({ children }) => <div className="mb-3">{children}</div>,
              table: ({ children }) => <div className="overflow-x-auto mb-3"><table className="w-full border-collapse text-xs">{children}</table></div>,
              th: ({ children }) => <th className="text-heading px-3 py-2 text-left bg-elevated border-b border-panel font-semibold">{children}</th>,
              td: ({ children }) => <td className="text-body px-3 py-2 border-b border-panel">{children}</td>,
              hr: () => <hr className="border-none border-t border-panel my-4" />,
              blockquote: ({ children }) => <blockquote className="border-l-4 border-secondary pl-4 text-secondary-soft italic my-3">{children}</blockquote>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function SkeletonFile() {
  return (
    <div className="mx-2 mb-1 px-3 py-2.5 rounded-lg animate-pulse bg-elevated">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-4 h-4 rounded bg-panel" />
        <div className="h-3 rounded flex-1 bg-panel" />
      </div>
      <div className="h-2 rounded w-1/2 bg-panel" />
    </div>
  );
}

export default function ArtifactViewer() {
  const { specPack, specPackLoading, runtimeArtifacts, generatePreview, previewLoading } = useProjectBrain();
  const [, setLocation] = useLocation();
  const [openFile, setOpenFile]           = useState(null);
  const [launching, setLaunching]         = useState(false);

  const handlePreview = async () => {
    if (!specPack || launching) return;
    setLaunching(true);
    setLocation("/preview");
    try {
      await generatePreview();
    } finally {
      setLaunching(false);
    }
  };

  const packMode = detectPackMode(specPack);
  const modeMeta = MODE_META[packMode] ?? MODE_META.standard;

  const fileOrder =
    packMode === "game"    ? GAME_FILE_ORDER :
    packMode === "website" ? WEBSITE_FILE_ORDER :
    packMode === "feature" ? FEATURE_FILE_ORDER :
    packMode === "launch"  ? LAUNCH_FILE_ORDER :
    STANDARD_FILE_ORDER;

  const files = specPack
    ? fileOrder
        .filter((f) => specPack[f])
        .map((name) => ({ name, content: specPack[name], ...(FILE_META[name] ?? { icon: "📄", colorClass: "text-muted" }) }))
    : [];

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-panel flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-subtle">Artifact Viewer</h2>
          {modeMeta.badge && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", modeMeta.badgeClass)}>
              {modeMeta.badge}
            </span>
          )}
          {specPack && (
            <button
              onClick={handlePreview}
              disabled={launching || previewLoading}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border bg-primary/10 text-primary border-primary/25 hover:bg-primary/20 transition-all disabled:opacity-50"
            >
              {launching ? (
                <><span className="w-2.5 h-2.5 border border-primary border-t-transparent rounded-full animate-spin" /> Building…</>
              ) : (
                <>⚡ Preview</>
              )}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {(specPack || specPackLoading) && (
            <div className="pt-2 pb-1">
              <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-subtle">
                {modeMeta.label}
              </p>
              {specPackLoading
                ? fileOrder.map((f) => <SkeletonFile key={f} />)
                : files.map((file) => (
                    <button
                      key={file.name}
                      onClick={() => setOpenFile(file)}
                      className="w-full px-5 py-2.5 text-left transition-all group flex items-center gap-2.5 hover:bg-elevated"
                    >
                      <span className="text-sm shrink-0">{file.icon}</span>
                      <span className={cn("text-xs font-mono font-medium truncate flex-1 text-muted transition-colors group-hover:", file.colorClass)}>
                        {file.name}
                      </span>
                      <svg className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-subtle" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                      </svg>
                    </button>
                  ))}
            </div>
          )}

          {!specPack && !specPackLoading && (
            <div className="px-4 py-8 text-center flex flex-col items-center gap-3">
              <span className="text-2xl">📋</span>
              <p className="text-xs text-subtle leading-relaxed max-w-[180px]">
                Your spec documents will appear here once you've described your project.
              </p>
            </div>
          )}

          <div className={cn("pt-2 pb-1", (specPack || specPackLoading) && "border-t border-panel mt-1")}>
            {(specPack || specPackLoading) && (
              <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-subtle">Services</p>
            )}
            {runtimeArtifacts.map((artifact) => (
              <div key={artifact.id} className="mx-2 mb-1 px-3 py-2.5 rounded-lg bg-elevated">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate text-heading">{artifact.label}</span>
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0 ml-2",
                    artifact.status === "running" ? "bg-success" : artifact.status === "stopped" ? "bg-error" : "bg-subtle")} />
                </div>
                <span className={cn("text-xs font-mono", artifact.status === "running" ? "text-primary" : "text-subtle")}>
                  {artifact.kind} · {artifact.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-3 py-2 border-t border-panel">
          <button className="w-full text-xs rounded py-1 transition-all text-subtle border border-panel hover:text-body hover:border-panel/60">
            + Add Artifact
          </button>
        </div>
      </div>

      {openFile && <MarkdownModal filename={openFile.name} content={openFile.content} onClose={() => setOpenFile(null)} />}
    </>
  );
}
