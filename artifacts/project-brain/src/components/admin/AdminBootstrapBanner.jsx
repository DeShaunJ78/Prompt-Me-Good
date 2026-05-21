import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useTier } from "@/context/TierContext";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminBootstrapBanner() {
  const { isSignedIn } = useUser();
  const { isAdmin } = useTier();
  const queryClient = useQueryClient();

  const [hasAdmin, setHasAdmin]   = useState(true);   // optimistic: assume admin exists
  const [checked, setChecked]     = useState(false);
  const [claiming, setClaiming]   = useState(false);
  const [claimed, setClaimed]     = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError]         = useState("");

  // Check once whether any admin exists in the DB
  useEffect(() => {
    if (!isSignedIn || isAdmin || checked) return;
    fetch("/api/admin/check")
      .then((r) => r.json())
      .then(({ hasAdmin: h }) => { setHasAdmin(h); setChecked(true); })
      .catch(() => setChecked(true));
  }, [isSignedIn, isAdmin, checked]);

  const handleClaim = async () => {
    setClaiming(true);
    setError("");
    try {
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Bootstrap failed.");
      setClaimed(true);
      // Refresh tier data so admin badge + hasFullAccess update instantly
      await queryClient.invalidateQueries({ queryKey: ["tier"] });
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  };

  // Don't show if: not signed in, already admin, no bootstrap needed, or dismissed
  if (!isSignedIn || isAdmin || hasAdmin || dismissed) return null;
  if (!checked) return null;

  if (claimed) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-warning/10 border border-warning/40 shadow-xl backdrop-blur-sm">
        <span className="text-lg">⚡</span>
        <div>
          <p className="text-sm font-bold text-warning">Admin access granted!</p>
          <p className="text-xs text-warning/70">Reload the page to see your admin badge.</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="ml-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-warning text-black hover:opacity-90 transition-all"
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-md">
      <div className="flex flex-col gap-2 px-5 py-4 rounded-2xl bg-surface border border-warning/40 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl shrink-0">⚡</span>
            <div>
              <p className="text-sm font-bold text-heading">First-run setup</p>
              <p className="text-xs text-muted leading-snug">No admin exists yet. Claim admin access to unlock all features and manage the app.</p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-subtle hover:text-body text-xs transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="text-xs text-error px-1">{error}</p>
        )}

        <button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full py-2.5 rounded-xl text-sm font-bold bg-warning/90 text-black hover:bg-warning transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {claiming ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Claiming…
            </>
          ) : "Claim admin access →"}
        </button>
      </div>
    </div>
  );
}
