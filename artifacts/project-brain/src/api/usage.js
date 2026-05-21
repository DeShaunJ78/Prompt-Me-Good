export async function fetchUsage() {
  const res = await fetch("/api/usage", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch usage");
  return res.json();
}

export async function purchaseTopup(pack) {
  const res = await fetch("/api/stripe/topup", {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ pack }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Top-up purchase failed.");
  }
  return res.json();
}
