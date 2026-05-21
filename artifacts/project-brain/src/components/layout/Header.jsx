import { useState } from "react";
import { useUser, useClerk, UserButton } from "@clerk/react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useProjectBrain } from "@/context/ProjectBrainContext";
import { useTier } from "@/context/TierContext";
import { TIER_META } from "@/lib/tiers";
import { getBillingPortalUrl } from "@/api/stripe";

export default function Header() {
  const { project, currentProjectId, saveCurrentProject } = useProjectBrain();
  const { buildProgress, currentStep, name } = project;
  const { isSignedIn, user } = useUser();
  const { signOut }          = useClerk();
  const { tier, isAdmin, isFounderActive, founderDaysLeft } = useTier();
  const tierMeta = TIER_META[tier] ?? TIER_META.free;
  const [, setLocation]      = useLocation();
  const [saving, setSaving]  = useState(false);
  const [saved, setSaved]    = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);

  const handleManageBilling = async () => {
    if (billingLoading) return;
    if (tier === "free") { setLocation("/pricing"); return; }
    setBillingLoading(true);
    try {
      const url = await getBillingPortalUrl();
      window.open(url, "_blank", "noreferrer");
    } catch {
      setLocation("/pricing");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isSignedIn || saving) return;
    setSaving(true);
    try {
      await saveCurrentProject({ userId: user.id });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <header className="h-14 flex items-center px-4 gap-4 shrink-0 bg-surface border-b border-panel">
      {/* Brand + project name */}
      <div className="flex items-center gap-2 min-w-0">
        <a href="/" className="flex items-center shrink-0">
          <img
            src="/CodeMeGood_Logo.png"
            alt="CodeMeGood"
            className="h-7 w-auto object-contain"
            style={{ maxWidth: 140 }}
          />
        </a>
        {isSignedIn && isAdmin && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-semibold hidden sm:block bg-warning/10 text-warning border-warning/30">
            ⚡ Admin
          </span>
        )}
        {isSignedIn && isFounderActive && !isAdmin && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-semibold hidden sm:block bg-primary/10 text-primary border-primary/25">
            🌟 Founding Member
          </span>
        )}
        {isSignedIn && !isAdmin && !isFounderActive && (
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-semibold hidden sm:block", tierMeta.badgeClass)}>
            {tierMeta.badge}
          </span>
        )}
        <span className="text-xs hidden lg:block text-subtle truncate max-w-[80px]">/ {name}</span>
      </div>

      {/* Build GPS */}
      <div className="flex-1 flex items-center gap-2 md:gap-3 max-w-lg min-w-0">
        <span className="text-xs whitespace-nowrap hidden sm:block text-subtle">Build GPS</span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-panel">
          <div
            className="h-full rounded-full transition-all duration-500 bg-progress"
            style={{ width: `${buildProgress}%` }}
          />
        </div>
        <span className="text-xs font-semibold tabular-nums whitespace-nowrap text-primary">
          {buildProgress}%
        </span>
        <span className="text-xs hidden md:block truncate max-w-[120px] text-subtle">
          {currentStep}
        </span>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2 ml-auto">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-primary" />
          <span className="text-xs text-subtle hidden sm:block">Live</span>
        </div>

        {isSignedIn ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                saved
                  ? "bg-success/10 text-success border-success/25"
                  : "bg-elevated text-subtle border-panel hover:text-body hover:border-primary/40"
              )}
            >
              {saving ? (
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "100ms" }} />
                  <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "200ms" }} />
                </span>
              ) : saved ? "✓ Saved" : currentProjectId ? "Update" : "Save"}
            </button>

            <button
              onClick={() => setLocation("/projects")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-panel bg-elevated text-subtle hover:text-body hover:border-primary/40 transition-all hidden md:block"
            >
              My Projects
            </button>

            <button
              onClick={handleManageBilling}
              disabled={billingLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-panel bg-elevated text-subtle hover:text-body hover:border-primary/40 transition-all hidden lg:block disabled:opacity-50"
            >
              {billingLoading ? "…" : tier === "free" ? "Upgrade" : "Billing"}
            </button>

            <UserButton
              afterSignOutUrl={import.meta.env.BASE_URL || "/"}
              appearance={{
                elements: {
                  avatarBox: "w-7 h-7",
                  userButtonPopoverCard: "bg-[#161821] border border-[#1F2937] shadow-xl",
                  userButtonPopoverActionButton: "text-[#E5E7EB] hover:bg-[#1C1E28]",
                  userButtonPopoverActionButtonText: "text-[#E5E7EB]",
                  userButtonPopoverFooter: "hidden",
                },
              }}
            />
          </>
        ) : (
          <>
            <button
              onClick={() => setLocation("/sign-in")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-panel bg-elevated text-subtle hover:text-body hover:border-primary/40 transition-all"
            >
              Sign In
            </button>
            <button
              onClick={() => setLocation("/sign-up")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-all"
            >
              Sign Up
            </button>
          </>
        )}
      </div>
    </header>
  );
}
