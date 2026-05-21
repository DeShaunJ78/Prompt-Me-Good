// ---------------------------------------------------------------------------
// scoreIntake — POST /api/score
// Analyzes the project intake data and returns a Spec Quality Score.
// ---------------------------------------------------------------------------
export async function scoreIntake({ rawIdea, answers, projectType }) {
  const response = await fetch("/api/score", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ rawIdea, answers, projectType }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Score server returned ${response.status}`);
  }

  return response.json();
}
