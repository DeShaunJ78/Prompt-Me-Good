// ---------------------------------------------------------------------------
// analyzeBug — POST /api/debug
// Takes an error message / stack trace and returns a plain-English breakdown
// with a safe fix prompt and a prevention rule.
// ---------------------------------------------------------------------------
export async function analyzeBug({ errorText, projectContext }) {
  const response = await fetch("/api/debug", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ errorText, projectContext }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Debug server returned ${response.status}`);
  }

  return response.json();
}
