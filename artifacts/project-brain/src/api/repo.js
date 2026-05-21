// ---------------------------------------------------------------------------
// repo.js — client-side zip parsing and spec-pack download utilities
// All operations happen in the browser via JSZip — no backend required.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Internal: build nested file tree from a flat list of {path, ...} objects
// ---------------------------------------------------------------------------
function buildFileTree(files) {
  const root = { name: "root", path: "", children: [], isFile: false };

  for (const file of files) {
    const parts = file.path.replace(/^\//, "").split("/").filter(Boolean);
    let cursor = root;

    parts.forEach((part, i) => {
      const isLast = i === parts.length - 1;
      if (isLast) {
        cursor.children.push({ name: part, path: file.path, size: file.size, isFile: true });
      } else {
        let folder = cursor.children.find((c) => c.name === part && !c.isFile);
        if (!folder) {
          folder = { name: part, path: parts.slice(0, i + 1).join("/"), children: [], isFile: false };
          cursor.children.push(folder);
        }
        cursor = folder;
      }
    });
  }

  // Sort: folders first, then files, both alphabetically
  function sortNode(node) {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNode);
  }
  sortNode(root);

  return root;
}

// ---------------------------------------------------------------------------
// Text extensions — we read these as strings; others are skipped
// ---------------------------------------------------------------------------
const TEXT_EXTENSIONS = new Set([
  "js","jsx","ts","tsx","css","scss","sass","less",
  "html","htm","xml","svg","json","jsonc","yaml","yml",
  "md","mdx","txt","sh","bash","env","gitignore","toml",
  "prisma","graphql","gql","py","rb","go","rs","java","c","cpp","h",
]);

function isTextFile(path) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(ext);
}

// ---------------------------------------------------------------------------
// parseZipFile(file: File) → { files, tree, totalFiles, name }
// ---------------------------------------------------------------------------
export async function parseZipFile(file) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);

  const files = [];
  const tasks = [];

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    // Skip common noise
    if (relativePath.includes("node_modules/")) return;
    if (relativePath.includes(".git/")) return;
    if (relativePath.includes("dist/") && !relativePath.endsWith("dist/")) return;

    tasks.push(
      (async () => {
        let content = null;
        if (isTextFile(relativePath)) {
          content = await entry.async("string").catch(() => null);
        }
        files.push({
          path: relativePath,
          content,
          size: entry._data?.uncompressedSize ?? 0,
          isText: content !== null,
        });
      })()
    );
  });

  await Promise.all(tasks);

  // Stable sort by path
  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    name: file.name.replace(/\.zip$/i, ""),
    totalFiles: files.length,
    files,
    tree: buildFileTree(files),
  };
}

// ---------------------------------------------------------------------------
// Mock file tree — used for the GitHub connection mock
// ---------------------------------------------------------------------------
export function buildMockTree(repoName = "my-project") {
  const slug = repoName.split("/").pop() ?? "my-project";
  const mockFiles = [
    { path: `${slug}/src/App.tsx`, size: 1240, isText: true },
    { path: `${slug}/src/main.tsx`, size: 320, isText: true },
    { path: `${slug}/src/index.css`, size: 880, isText: true },
    { path: `${slug}/src/components/Header.tsx`, size: 560, isText: true },
    { path: `${slug}/src/components/Footer.tsx`, size: 420, isText: true },
    { path: `${slug}/src/pages/Home.tsx`, size: 1800, isText: true },
    { path: `${slug}/public/favicon.svg`, size: 512, isText: false },
    { path: `${slug}/index.html`, size: 490, isText: true },
    { path: `${slug}/package.json`, size: 720, isText: true },
    { path: `${slug}/vite.config.ts`, size: 340, isText: true },
    { path: `${slug}/tsconfig.json`, size: 290, isText: true },
    { path: `${slug}/README.md`, size: 1100, isText: true },
  ];
  return {
    name: slug,
    totalFiles: mockFiles.length,
    files: mockFiles,
    tree: buildFileTree(mockFiles),
    isMock: true,
  };
}

// ---------------------------------------------------------------------------
// HOW_TO_APPLY.md — instructions inserted into the download zip
// ---------------------------------------------------------------------------
function buildHowToApply(fileKeys) {
  const fileList = fileKeys.map((k) => `- **${k}** — ${getFileDescription(k)}`).join("\n");
  return `# How to Apply Your Project Brain Spec Pack

Project Brain has generated a structured specification for your project.
Drop this folder into your project root and use the files as described below.

## What's in this folder
${fileList}

## Using with Replit Agent
1. Open your Replit project and start a new Agent session.
2. Paste the contents of **RULES.md** at the top of every prompt — it is your Scope Lock.
3. Begin with the first unchecked phase in **BUILD_PLAN.md**.
4. Reference **SPEC.md** when the agent asks what to build.
5. Check off tasks in **TEST_PLAN.md** before marking a phase complete.

## Using with Cursor / VS Code Copilot
1. Copy **RULES.md** into your \`.cursorrules\` file.
2. Add **SPEC.md** to your workspace context (@ mention it in Cursor).
3. Use each phase from **BUILD_PLAN.md** as a focused session goal.

## Pro tip — Scope Locking
Paste this at the top of any vibe-coding prompt:

\`\`\`
### 🔒 SCOPE LOCK
[paste your current phase from BUILD_PLAN.md here]
DO NOT TOUCH anything outside the listed files.
\`\`\`

---
*Generated by Project Brain · CodeMeGood*
`;
}

function getFileDescription(key) {
  const map = {
    "SPEC.md":                 "Full project specification — what you are building",
    "RULES.md":                "Scope constraints — paste this into every AI prompt",
    "BUILD_PLAN.md":           "Phased build roadmap with checkboxes",
    "TEST_PLAN.md":            "Testing strategy — verify before moving to next phase",
    "APP_MAP.md":              "Architecture: routes, API, and data flow",
    "CONTENT_MAP.md":          "Page structure and content hierarchy",
    "SEO_PLAN.md":             "SEO strategy and technical checklist",
    "GAME_DESIGN_DOC.md":      "Game design document — core loop and mechanics",
    "SYSTEMS_ARCHITECTURE.md": "Game systems: loop, entities, state machine",
    "ASSET_LIST.md":           "Asset checklist: sprites, audio, and UI",
    "FUN_TEST.md":             "Fun test checklist — verify the game is actually fun",
  };
  return map[key] ?? "Spec pack document";
}

// ---------------------------------------------------------------------------
// buildDownloadZip(specPack) → Blob
// Creates a zip with all spec pack files + HOW_TO_APPLY.md
// ---------------------------------------------------------------------------
export async function buildDownloadZip(specPack) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const folder = zip.folder("project-brain-spec");
  const fileKeys = Object.keys(specPack);

  fileKeys.forEach((filename) => {
    folder.file(filename, specPack[filename]);
  });

  folder.file("HOW_TO_APPLY.md", buildHowToApply(fileKeys));

  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

// ---------------------------------------------------------------------------
// downloadBlob(blob, filename) — triggers a browser file download
// ---------------------------------------------------------------------------
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
