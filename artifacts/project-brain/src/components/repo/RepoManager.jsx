import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useProjectBrain } from "@/context/ProjectBrainContext";
import { parseZipFile, buildMockTree, buildDownloadZip, downloadBlob } from "@/api/repo";

// ---------------------------------------------------------------------------
// File extension → icon
// ---------------------------------------------------------------------------
function fileIcon(name) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["js","jsx","ts","tsx"].includes(ext))         return "⚡";
  if (["css","scss","sass","less"].includes(ext))     return "🎨";
  if (["json","jsonc"].includes(ext))                 return "{}";
  if (["md","mdx"].includes(ext))                     return "📝";
  if (["html","htm"].includes(ext))                   return "🌐";
  if (["png","jpg","jpeg","svg","gif","webp"].includes(ext)) return "🖼️";
  if (["py"].includes(ext))                           return "🐍";
  if (["sh","bash"].includes(ext))                    return "⚙️";
  if (["prisma","sql"].includes(ext))                 return "🗄️";
  return "📄";
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(0)}KB`;
}

// ---------------------------------------------------------------------------
// Recursive file tree node
// ---------------------------------------------------------------------------
function TreeNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);

  if (node.isFile) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-elevated group cursor-default"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <span className="text-xs shrink-0 opacity-70">{fileIcon(node.name)}</span>
        <span className="text-xs text-body truncate flex-1">{node.name}</span>
        {node.size > 0 && (
          <span className="text-xs text-subtle opacity-0 group-hover:opacity-100 shrink-0">
            {formatSize(node.size)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-elevated text-left"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <span className="text-xs text-subtle shrink-0 w-3">
          {open ? "▼" : "▶"}
        </span>
        <span className="text-xs font-medium text-muted truncate flex-1">{node.name}/</span>
        {node.children && (
          <span className="text-xs text-subtle shrink-0">{node.children.length}</span>
        )}
      </button>
      {open && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RepoManager
// ---------------------------------------------------------------------------
export default function RepoManager() {
  const { specPack } = useProjectBrain();

  // Upload state
  const [uploadState, setUploadState]   = useState("idle"); // idle | parsing | ready
  const [repo, setRepo]                 = useState(null);
  const [uploadError, setUploadError]   = useState(null);
  const [isDragOver, setIsDragOver]     = useState(false);
  const fileInputRef                    = useRef(null);

  // GitHub mock state
  const [githubOpen, setGithubOpen]     = useState(false);
  const [githubUrl, setGithubUrl]       = useState("");
  const [githubState, setGithubState]   = useState("idle"); // idle | connecting | done

  // Push state
  const [pushLoading, setPushLoading]   = useState(false);
  const [pushDone, setPushDone]         = useState(false);

  // -------------------------------------------------------------------------
  // Upload handlers
  // -------------------------------------------------------------------------
  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith(".zip")) {
      setUploadError("Please upload a .zip file.");
      return;
    }
    setUploadError(null);
    setUploadState("parsing");
    try {
      const result = await parseZipFile(file);
      setRepo(result);
      setUploadState("ready");
      setGithubOpen(false);
    } catch (err) {
      console.error("[RepoManager] zip parse failed:", err);
      setUploadError("Couldn't parse the zip — is it a valid project archive?");
      setUploadState("idle");
    }
  }, []);

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);

  // -------------------------------------------------------------------------
  // GitHub mock
  // -------------------------------------------------------------------------
  const handleGithubConnect = async () => {
    if (!githubUrl.trim()) return;
    setGithubState("connecting");
    await new Promise((r) => setTimeout(r, 1500));
    const slug = githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "").trim() || "my-project";
    const mockResult = buildMockTree(slug);
    setRepo(mockResult);
    setUploadState("ready");
    setGithubState("done");
    setGithubOpen(false);
  };

  // -------------------------------------------------------------------------
  // Push changes
  // -------------------------------------------------------------------------
  const handlePushChanges = async () => {
    if (!specPack) return;
    setPushLoading(true);
    setPushDone(false);
    try {
      const blob = await buildDownloadZip(specPack);
      const projectName = repo?.name ?? "my-project";
      downloadBlob(blob, `${projectName}-spec-pack.zip`);
      setPushDone(true);
      setTimeout(() => setPushDone(false), 4000);
    } catch (err) {
      console.error("[RepoManager] push failed:", err);
    } finally {
      setPushLoading(false);
    }
  };

  const clearRepo = () => {
    setRepo(null);
    setUploadState("idle");
    setUploadError(null);
    setGithubState("idle");
    setGithubUrl("");
    setPushDone(false);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📂</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-subtle">
            Repo Manager
          </span>
        </div>
        {repo && (
          <button
            onClick={clearRepo}
            className="text-xs text-subtle hover:text-error transition-colors"
            title="Clear repo"
          >
            ✕
          </button>
        )}
      </div>

      <div className="px-3 pb-3 flex flex-col gap-2">
        {/* ---------------------------------------------------------------- */}
        {/* IDLE STATE — Upload zone + GitHub button                         */}
        {/* ---------------------------------------------------------------- */}
        {uploadState === "idle" && (
          <>
            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-4 cursor-pointer transition-all",
                isDragOver
                  ? "border-primary bg-primary/8 scale-[1.01]"
                  : "border-panel hover:border-primary/50 hover:bg-elevated"
              )}
            >
              <span className="text-lg">{isDragOver ? "📥" : "📦"}</span>
              <p className="text-xs font-medium text-body text-center leading-snug">
                {isDragOver ? "Drop to upload" : "Upload project .zip"}
              </p>
              <p className="text-xs text-subtle text-center leading-snug">
                click or drag & drop
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleInputChange}
              />
            </div>

            {uploadError && (
              <p className="text-xs text-error px-1">{uploadError}</p>
            )}

            {/* GitHub mock */}
            {!githubOpen ? (
              <button
                onClick={() => setGithubOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-panel text-xs text-subtle hover:text-body hover:border-panel/60 transition-all"
              >
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                Connect GitHub instead
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-panel bg-elevated p-3">
                <label className="text-xs font-medium text-body">Repository URL</label>
                <input
                  type="text"
                  placeholder="github.com/user/repo"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGithubConnect()}
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-canvas border border-panel text-body placeholder:text-subtle focus:outline-none focus:border-primary transition-colors"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleGithubConnect}
                    disabled={!githubUrl.trim() || githubState === "connecting"}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      githubState === "connecting"
                        ? "bg-primary/30 text-primary cursor-wait"
                        : "bg-primary text-inverse hover:opacity-90"
                    )}
                  >
                    {githubState === "connecting" ? "Connecting…" : "Connect"}
                  </button>
                  <button
                    onClick={() => { setGithubOpen(false); setGithubUrl(""); setGithubState("idle"); }}
                    className="px-3 py-1.5 rounded-lg text-xs text-subtle border border-panel hover:text-body transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-subtle leading-snug">
                  ⚠️ Full sync coming soon — this loads a mock structure.
                </p>
              </div>
            )}
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* PARSING STATE                                                    */}
        {/* ---------------------------------------------------------------- */}
        {uploadState === "parsing" && (
          <div className="flex items-center gap-2.5 rounded-xl border border-panel bg-elevated px-3 py-3">
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
            <p className="text-xs text-body">Parsing zip…</p>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* READY STATE — Connected badge + file tree                        */}
        {/* ---------------------------------------------------------------- */}
        {uploadState === "ready" && repo && (
          <>
            {/* Connected badge */}
            <div className="flex items-center gap-2 rounded-lg bg-elevated border border-panel px-2.5 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-body truncate">{repo.name}</p>
                <p className="text-xs text-subtle">
                  {repo.totalFiles} file{repo.totalFiles !== 1 ? "s" : ""}
                  {repo.isMock ? " · mock" : ""}
                </p>
              </div>
            </div>

            {/* File tree */}
            <div className="rounded-xl border border-panel bg-canvas overflow-hidden">
              <div className="max-h-48 overflow-y-auto py-1">
                {repo.tree.children.map((node) => (
                  <TreeNode key={node.path} node={node} depth={0} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* PUSH CHANGES — available whenever specPack exists                */}
        {/* ---------------------------------------------------------------- */}
        {specPack && (
          <button
            onClick={handlePushChanges}
            disabled={pushLoading}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all border",
              pushDone
                ? "bg-success/12 text-success border-success/25"
                : pushLoading
                ? "bg-primary/15 text-primary border-primary/20 cursor-wait"
                : "bg-primary/10 text-primary border-primary/25 hover:bg-primary/18 hover:border-primary/40"
            )}
          >
            {pushLoading ? (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Building zip…
              </>
            ) : pushDone ? (
              <>✅ Downloaded!</>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Push Changes as .zip
              </>
            )}
          </button>
        )}

        {!specPack && uploadState === "ready" && (
          <p className="text-xs text-subtle text-center px-1 leading-snug">
            Complete the Idea Doctor flow to enable Push Changes.
          </p>
        )}
      </div>
    </div>
  );
}
