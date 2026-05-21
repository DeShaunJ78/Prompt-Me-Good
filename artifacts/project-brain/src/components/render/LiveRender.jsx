import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import XRayInspector from "./XRayInspector";

const STARTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: #ffffff; color: #111827; padding: 24px; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 8px; }
    p  { color: #6b7280; line-height: 1.6; margin-bottom: 16px; }
    button { background: #14B8A6; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
    button:hover { background: #2DD4BF; }
  </style>
</head>
<body>
  <h1>Hello, World!</h1>
  <p>Paste your HTML, CSS, and JS here and see it rendered live on the right.</p>
  <button onclick="this.textContent='Clicked!'">Click me</button>
</body>
</html>`;

function buildSrcDoc(html, xray) {
  if (!xray) return html;
  const injected = `
<script>
(function() {
  var overlay = null;
  function removeOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
  function highlight(el) {
    removeOverlay();
    var rect = el.getBoundingClientRect();
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;top:'+rect.top+'px;left:'+rect.left+'px;width:'+rect.width+'px;height:'+rect.height+'px;outline:2px solid #6C8EF5;background:rgba(108,142,245,0.08);transition:all 0.1s ease';
    document.body.appendChild(overlay);
  }
  document.addEventListener('mouseover', function(e) { if (e.target !== document.body && e.target !== document.documentElement) highlight(e.target); }, true);
  document.addEventListener('mouseout', function(e) { if (!e.relatedTarget || e.relatedTarget === document.body) removeOverlay(); }, true);
  document.addEventListener('click', function(e) {
    e.preventDefault(); e.stopPropagation();
    window.parent.postMessage({ type:'xray-element', tag:e.target.tagName, id:e.target.id||null, classes:e.target.className||'', rawHtml:e.target.outerHTML }, '*');
  }, true);
})();
<\/script>`;
  const bodyClose = html.lastIndexOf("</body>");
  return bodyClose !== -1 ? html.slice(0, bodyClose) + injected + html.slice(bodyClose) : html + injected;
}

export default function LiveRender() {
  const [code, setCode] = useState(STARTER_HTML);
  const [srcDoc, setSrcDoc] = useState(() => buildSrcDoc(STARTER_HTML, false));
  const [xray, setXray] = useState(false);
  const [inspected, setInspected] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const debounceRef = useRef(null);

  const refresh = useCallback((html, xrayOn) => { setSrcDoc(buildSrcDoc(html, xrayOn)); if (xrayOn) setInspected(null); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => refresh(code, xray), 600);
    return () => clearTimeout(debounceRef.current);
  }, [code, xray, autoRefresh, refresh]);

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "xray-element") {
        setInspected({ tag: (e.data.tag ?? "").toLowerCase(), id: e.data.id, classes: e.data.classes, rawHtml: e.data.rawHtml });
        setShowInspector(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const toggleXray = () => { const next = !xray; setXray(next); setInspected(null); refresh(code, next); };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 bg-surface border-b border-panel">
        <span className="text-xs font-semibold uppercase tracking-widest mr-1 text-subtle">Live Render</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all border",
              autoRefresh ? "bg-primary/12 text-primary border-primary/30" : "bg-elevated text-subtle border-panel hover:text-body"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "animate-pulse bg-primary" : "bg-subtle")} />
            Auto
          </button>

          {!autoRefresh && (
            <button onClick={() => refresh(code, xray)} className="px-2.5 py-1 rounded-lg text-xs transition-all border bg-elevated text-subtle border-panel hover:text-body">
              ↺ Run
            </button>
          )}

          <button
            onClick={toggleXray}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border",
              xray ? "bg-secondary/18 text-secondary border-secondary/40 shadow-glow-secondary" : "bg-elevated text-subtle border-panel hover:text-body"
            )}
          >
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            X-Ray
          </button>

          {xray && (
            <button onClick={() => setShowInspector((v) => !v)} className="px-2.5 py-1 rounded-lg text-xs transition-all border bg-elevated text-subtle border-panel hover:text-body">
              {showInspector ? "Hide" : "Inspector"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className={cn("flex flex-col border-r border-panel", xray && showInspector ? "w-1/3" : "w-2/5")}>
          <div className="px-3 py-1.5 bg-surface border-b border-panel">
            <span className="text-xs text-subtle">HTML / CSS / JS</span>
          </div>
          <textarea
            className="flex-1 text-xs font-mono resize-none focus:outline-none p-3 leading-relaxed bg-canvas text-body caret-primary border-none"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            style={{ tabSize: 2 }}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                const s = e.currentTarget.selectionStart;
                const next = e.currentTarget.value.slice(0, s) + "  " + e.currentTarget.value.slice(e.currentTarget.selectionEnd);
                setCode(next);
                requestAnimationFrame(() => { e.currentTarget.selectionStart = e.currentTarget.selectionEnd = s + 2; });
              }
            }}
          />
        </div>

        <div className="flex flex-col overflow-hidden flex-1">
          <div className="px-3 py-1.5 flex items-center gap-2 bg-surface border-b border-panel">
            <span className="text-xs text-subtle">Preview</span>
            {xray && (
              <span className="text-xs px-2 py-0.5 rounded-full animate-pulse bg-secondary/12 text-secondary border border-secondary/30">
                X-Ray active — click any element
              </span>
            )}
          </div>
          <iframe
            className={cn("flex-1 w-full border-none bg-white", xray ? "cursor-crosshair" : "cursor-default")}
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            title="Live Preview"
          />
        </div>

        {xray && showInspector && (
          <div className="flex flex-col overflow-hidden shrink-0 w-[240px] border-l border-panel bg-surface">
            <div className="px-3 py-1.5 border-b border-panel">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Inspector</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <XRayInspector element={inspected} xrayActive={xray} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
