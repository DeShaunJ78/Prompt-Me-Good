// ---------------------------------------------------------------------------
// Stripe client helpers
// All calls use Clerk session cookie for auth (credentials: "include").
// ---------------------------------------------------------------------------

// POST /api/stripe/checkout
// Initiates a checkout session for the given tier/billing period.
// Stub: upgrades tier in DB immediately; real flow redirects to Stripe Checkout.
export async function createCheckoutSession({ tier, billing, email, name }) {
  const response = await fetch("/api/stripe/checkout", {
    method:      "POST",
    credentials: "include",
    headers:     { "Content-Type": "application/json" },
    body:        JSON.stringify({ tier, billing, email, name }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Checkout server returned ${response.status}`);
  }

  return response.json();
}

// GET /api/stripe/portal
// Returns the URL of the Stripe Customer Portal (placeholder until keys are set).
export async function getBillingPortalUrl() {
  const response = await fetch("/api/stripe/portal", {
    method:      "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Portal server returned ${response.status}`);
  }

  const data = await response.json();
  return data.url;
}
