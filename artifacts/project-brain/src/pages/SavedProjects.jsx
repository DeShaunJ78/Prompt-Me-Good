import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { listProjects, deleteProject } from "@/api/projects";
import { useProjectBrain } from "@/context/ProjectBrainContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MODE_META = {
  spec:    { icon: "📋", label: "New Project", color: "text-primary bg-primary/8 border-primary/25"       },
  feature: { icon: "🧩", label: "Feature",     color: "text-secondary bg-secondary/8 border-secondary/25" },
  launch:  { icon: "🚀", label: "Launch",      color: "text-success bg-success/8 border-success/25"       },
};

function formatDate(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000)          return "just now";
  if (diff < 3_600_000)       return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000)      return `${Math.round(diff / 3_600_000)}h ago`;
  if (diff < 86_400_000 * 7)  return `${Math.round(diff / 86_400_000)}d ago`;
  const d = new Date(ts);
  return d.toLocaleDateString([], {
    month: "short", day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

// ---------------------------------------------------------------------------
// Project card
// ---------------------------------------------------------------------------
function ProjectCard({ project, onOpen, onDelete, isDeleting }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = MODE_META[project.mode] ?? MODE_META.spec;

  return (
    <div className="rounded-xl border border-panel bg-surface p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-heading truncate text-sm leading-tight">{project.name}</h3>
          <p className="text-[11px] text-subtle mt-0.5">{formatDate(project.updatedAt)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-semibold", meta.color)}>
            {meta.icon} {meta.label}
          </span>
          {project.launchScore != null && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full border font-bold",
              project.launchScore >= 81 ? "text-success bg-success/8 border-success/25" :
              project.launchScore >= 61 ? "text-primary bg-primary/8 border-primary/25" :
              project.launchScore >= 31 ? "text-warning bg-warning/8 border-warning/25" :
              "text-error bg-error/8 border-error/25"
            )}>
              {project.launchScore}%
            </span>
          )}
        </div>
      </div>

      {/* Idea summary */}
      {project.ideaText && (
        <p className="text-xs text-muted leading-relaxed line-clamp-2">{project.ideaText}</p>
      )}

      {/* Flight log entry count */}
      {Array.isArray(project.flightLog) && project.flightLog.length > 0 && (
        <p className="text-[10px] text-subtle">
          🗒️ {project.flightLog.length} event{project.flightLog.length !== 1 ? "s" : ""} in flight log
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={() => onOpen(project)}
          className="flex-1 py-2 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-all"
        >
          Open Project →
        </button>
        <button
          onClick={() => {
            if (confirmDelete) {
              onDelete(project.id);
            } else {
              setConfirmDelete(true);
              setTimeout(() => setConfirmDelete(false), 3000);
            }
          }}
          disabled={isDeleting}
          className={cn(
            "px-3 py-2 rounded-lg text-xs font-semibold border transition-all",
            confirmDelete
              ? "bg-error text-white border-error cursor-pointer"
              : "text-subtle border-panel hover:text-error hover:border-error/40 cursor-pointer"
          )}
        >
          {confirmDelete ? "Confirm" : "🗑"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ onNew }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="w-14 h-14 rounded-full bg-elevated border border-panel flex items-center justify-center text-3xl">
        📭
      </div>
      <div>
        <p className="text-base font-semibold text-heading mb-1">No saved projects yet</p>
        <p className="text-sm text-subtle max-w-xs leading-relaxed">
          Projects are saved automatically when you generate a spec, add a feature, or score a launch — while signed in.
        </p>
      </div>
      <button
        onClick={onNew}
        className="mt-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-cta text-inverse hover:opacity-90 transition-all"
      >
        Create your first project
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved Projects dashboard
// ---------------------------------------------------------------------------
export default function SavedProjects() {
  const [, setLocation] = useLocation();
  const { restoreProject } = useProjectBrain();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn:  listProjects,
  });

  const deleteMut = useMutation({
    mutationFn: deleteProject,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const handleOpen = (project) => {
    restoreProject(project);
    setLocation("/cockpit");
  };

  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="max-w-3xl mx-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/")}
              className="text-xs text-subtle hover:text-body transition-colors"
            >
              ← Back
            </button>
            <span className="text-panel text-xs">|</span>
            <h1 className="font-bold text-lg text-heading tracking-tight">Saved Projects</h1>
            {!isLoading && projects.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-elevated text-subtle border border-panel">
                {projects.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-cta text-inverse hover:opacity-90 transition-all"
          >
            + New Project
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <p className="text-sm text-subtle">Loading your projects…</p>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="rounded-xl border border-error/20 bg-error/6 px-6 py-8 text-center">
            <p className="text-sm font-semibold text-heading mb-1">Something went wrong</p>
            <p className="text-xs text-muted mb-4">We couldn't load your projects right now. Your work is safe — try refreshing.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-elevated border border-panel text-subtle hover:text-body hover:border-primary/40 transition-all"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && projects.length === 0 && (
          <EmptyState onNew={() => setLocation("/")} />
        )}

        {/* Project grid */}
        {!isLoading && !error && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={handleOpen}
                onDelete={(id) => deleteMut.mutate(id)}
                isDeleting={deleteMut.isPending && deleteMut.variables === p.id}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
