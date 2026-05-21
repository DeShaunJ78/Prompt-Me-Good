const BASE = "/api";

// Make the signed-in user an admin.
// Works only while zero admins exist in the DB (first-use bootstrap).
// Optionally pass a bootstrapSecret header if BOOTSTRAP_SECRET is set on the server.
export async function bootstrapAdmin(bootstrapSecret) {
  const headers = { "Content-Type": "application/json" };
  if (bootstrapSecret) headers["x-bootstrap-secret"] = bootstrapSecret;

  const res = await fetch(`${BASE}/admin/bootstrap`, {
    method:  "POST",
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Bootstrap failed.");
  }
  return res.json();
}

// Grant founder access to a specific userId (admin-only).
export async function setFounderAccess(targetUserId, daysFromNow = 30) {
  const res = await fetch(`${BASE}/admin/set-founder`, {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ targetUserId, daysFromNow }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to set founder access.");
  }
  return res.json();
}

// Claim founder access for the signed-in user.
// Works during the launch window — call this on sign-up for open-access launch.
export async function claimFounderAccess(daysFromNow = 30) {
  const res = await fetch(`${BASE}/admin/claim-founder`, {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ daysFromNow }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to claim founder access.");
  }
  return res.json();
}
