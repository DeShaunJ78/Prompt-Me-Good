import { useState } from "react";
import { cn } from "@/lib/utils";

function tagColor(tag) {
  const t = tag?.toLowerCase();
  if (["div", "section", "article", "main", "aside"].includes(t)) return "#6C8EF5";
  if (["p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "label"].includes(t)) return "#8BA4F8";
  if (["button", "a", "input", "select", "textarea"].includes(t)) return "#A8BCF9";
  if (["img", "video", "canvas", "svg"].includes(t)) return "#F5A623";
  if (["ul", "ol", "li", "table", "tr", "td", "th"].includes(t)) return "#E85D5D";
  return "#8A8A9A";
}

function friendlyName(tag) {
  const t = tag?.toLowerCase();
  if (t === "button") return "Interactive Button";
  if (t === "a") return "Hyperlink / Navigation";
  if (t === "input") return "Form Input Field";
  if (t === "textarea") return "Multi-line Text Input";
  if (t === "select") return "Dropdown Selector";
  if (t === "img") return "Image Element";
  if (t === "video") return "Video Player";
  if (t === "svg") return "Inline SVG Graphic";
  if (t === "canvas") return "Canvas Drawing Surface";
  if (["h1","h2","h3","h4","h5","h6"].includes(t)) return `Heading Level ${t.slice(1)}`;
  if (t === "p") return "Paragraph / Body Text";
  if (t === "span") return "Inline Text Wrapper";
  if (t === "label") return "Form Label";
  if (t === "ul") return "Unordered List";
  if (t === "ol") return "Ordered List";
  if (t === "li") return "List Item";
  if (t === "table") return "Data Table";
  if (t === "nav") return "Navigation Region";
  if (t === "header") return "Page / Section Header";
  if (t === "footer") return "Page / Section Footer";
  if (t === "main") return "Main Content Area";
  if (t === "aside") return "Sidebar / Aside Content";
  if (t === "section") return "Thematic Section";
  if (t === "article") return "Standalone Article / Card";
  if (t === "form") return "Form Container";
  return `<${tag}> Element`;
}

function buildFixInstruction(element) {
  const { tag, classes, id, rawHtml } = element;
  const name = friendlyName(tag);
  const idStr = id ? `#${id}` : "";
  const classStr = classes ? `.${classes.trim().split(/\s+/).join(".")}` : "";
  const selector = `${tag}${idStr}${classStr}` || tag;
  return `Fix the following element in my HTML:\n\nElement: ${name}\nTag: <${tag}>\nSelector: ${selector}\n${classes ? `Classes: ${classes}\n` : ""}\nCurrent HTML:\n\`\`\`html\n${rawHtml?.slice(0, 400) ?? `<${tag}></${tag}>`}\n\`\`\`\n\nIssue: [describe what's wrong]\nExpected: [describe the desired behaviour or appearance]`;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button
      onClick={copy}
      className={cn(
        "text-xs px-3 py-1.5 rounded-lg transition-all font-medium border",
        copied ? "bg-primary/15 text-primary border-primary" : "bg-elevated text-muted border-panel hover:text-body"
      )}
    >
      {copied ? "✓ Copied!" : "Copy Fix Instruction"}
    </button>
  );
}

export default function XRayInspector({ element, xrayActive }) {
  if (!xrayActive) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-elevated">
          <svg className="w-4 h-4 text-subtle" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-xs text-subtle">Enable X-Ray to inspect elements</p>
      </div>
    );
  }

  if (!element) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-pulse bg-primary/10 border border-primary/30">
          <svg className="w-4 h-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-xs font-medium text-primary">X-Ray active</p>
        <p className="text-xs text-subtle">Click any element in the preview</p>
      </div>
    );
  }

  const color = tagColor(element.tag);
  const name = friendlyName(element.tag);
  const fixInstruction = buildFixInstruction(element);
  const classArr = element.classes ? element.classes.trim().split(/\s+/).filter(Boolean) : [];

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
      {/* Tag badge — color is computed dynamically from element type, inline style is required */}
      <div className="rounded-xl px-3 py-3 bg-elevated" style={{ border: `1px solid ${color}30` }}>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="px-2 py-0.5 rounded font-mono text-xs font-bold"
            style={{ background: `${color}18`, color }}
          >
            &lt;{element.tag}&gt;
          </span>
          <span className="text-xs font-semibold text-heading">{name}</span>
        </div>
        {element.id && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs text-subtle">id:</span>
            <span className="text-xs font-mono text-secondary">#{element.id}</span>
          </div>
        )}
        {classArr.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {classArr.slice(0, 8).map((c, i) => (
              <span key={i} className="text-xs font-mono px-1.5 py-0.5 rounded bg-canvas text-body border border-panel">.{c}</span>
            ))}
            {classArr.length > 8 && <span className="text-xs text-subtle">+{classArr.length - 8} more</span>}
          </div>
        )}
      </div>

      <div className="rounded-xl overflow-hidden border border-panel">
        <div className="px-3 py-2 bg-surface border-b border-panel">
          <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Raw HTML</span>
        </div>
        <div className="px-3 py-2 text-xs font-mono overflow-x-auto bg-canvas text-body max-h-[100px] whitespace-pre-wrap break-all">
          {element.rawHtml?.slice(0, 300) ?? ""}
          {(element.rawHtml?.length ?? 0) > 300 && <span className="text-subtle">…</span>}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-panel">
        <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-panel">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Fix Instruction</span>
          <CopyButton text={fixInstruction} />
        </div>
        <div className="px-3 py-2 text-xs font-mono overflow-y-auto bg-canvas text-body max-h-[140px] whitespace-pre-wrap">
          {fixInstruction}
        </div>
      </div>
    </div>
  );
}
