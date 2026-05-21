// ---------------------------------------------------------------------------
// generateRenderHtml — POST /api/render
// Generates or refines a single-file HTML/CSS/JS prototype from a spec pack.
// ---------------------------------------------------------------------------
export async function generateRenderHtml({ specPack, ideaText, previousHtml, message }) {
  const response = await fetch("/api/render", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ specPack, ideaText, previousHtml, message }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Render server returned ${response.status}`);
  }

  const data = await response.json();
  return data.html;
}
