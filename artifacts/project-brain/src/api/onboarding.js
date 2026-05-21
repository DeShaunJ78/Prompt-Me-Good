export async function fetchOnboardingStatus() {
  const res = await fetch("/api/onboarding", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch onboarding status");
  return res.json();
}

export async function saveOnboarding(builderType, experienceLevel) {
  const res = await fetch("/api/onboarding", {
    method:      "POST",
    credentials: "include",
    headers:     { "Content-Type": "application/json" },
    body:        JSON.stringify({ builderType, experienceLevel }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to save onboarding.");
  }
  return res.json();
}
