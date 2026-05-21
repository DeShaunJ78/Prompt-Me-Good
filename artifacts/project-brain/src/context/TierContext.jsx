import { createContext, useContext, useState, useCallback } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { canUseFeature, requiredTierForFeature, FEATURE_LABELS, TIER_META, nextTier } from "@/lib/tiers";
import { fetchUsage } from "@/api/usage";
import { fetchOnboardingStatus, saveOnboarding } from "@/api/onboarding";

const fetchTier = () =>
  fetch("/api/tier", { credentials: "include" }).then((r) => {
    if (r.status === 401) return { tier: "free", specPacksThisMonth: 0, specPacksLimit: 3, canGenerateSpec: true, isAdmin: false, hasFullAccess: false, isFounderActive: false, founderDaysLeft: 0 };
    if (!r.ok) throw new Error("Failed to fetch tier");
    return r.json();
  });

const setTierApi = (tier) =>
  fetch("/api/tier", {
    method:  "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ tier }),
  }).then((r) => r.json());

const incrementUsageApi = () =>
  fetch("/api/tier/increment-usage", {
    method: "POST",
    credentials: "include",
  }).then((r) => {
    if (!r.ok) return r.json().then((b) => Promise.reject(b));
    return r.json();
  });

const TierContext = createContext(null);

export function TierProvider({ children }) {
  const { isSignedIn } = useUser();
  const queryClient    = useQueryClient();

  // ── Upgrade modal (tier gate) ──────────────────────────────────────────────
  const [upgradeModal, setUpgradeModal] = useState({ open: false, feature: null });

  // ── Top-up modal (usage cap reached) ──────────────────────────────────────
  const [topupModal, setTopupModal] = useState({
    open:    false,
    feature: null,
    label:   null,
    used:    0,
    limit:   0,
    credits: 0,
  });

  // ── Smart upgrade nudge banner ─────────────────────────────────────────────
  const [upgradeNudge, setUpgradeNudgeState] = useState({ show: false, message: "" });

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: tierData } = useQuery({
    queryKey:    ["tier"],
    queryFn:     fetchTier,
    enabled:     !!isSignedIn,
    staleTime:   60_000,
    placeholderData: { tier: "free", specPacksThisMonth: 0, specPacksLimit: 3, canGenerateSpec: true, isAdmin: false, hasFullAccess: false, isFounderActive: false, founderDaysLeft: 0 },
  });

  const { data: usageData, refetch: refetchUsage } = useQuery({
    queryKey:  ["usage"],
    queryFn:   fetchUsage,
    enabled:   !!isSignedIn,
    staleTime: 30_000,
  });

  const { data: onboardingData } = useQuery({
    queryKey:   ["onboarding"],
    queryFn:    fetchOnboardingStatus,
    enabled:    !!isSignedIn,
    staleTime:  Infinity,
    gcTime:     Infinity,
  });

  // showOnboarding: true when signed in AND onboarding not yet completed (admins skip it)
  const isAdmin         = tierData?.isAdmin         ?? false;
  const hasFullAccess   = tierData?.hasFullAccess    ?? false;
  const isFounderActive = tierData?.isFounderActive  ?? false;
  const founderDaysLeft = tierData?.founderDaysLeft  ?? 0;
  const founderAccessExpiry = tierData?.founderAccessExpiry ?? null;

  const showOnboarding = !!isSignedIn && !isAdmin && onboardingData !== undefined && onboardingData !== null && onboardingData.onboardingComplete === false;

  const setTierMut = useMutation({
    mutationFn: setTierApi,
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ["tier"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
    },
  });

  const incrementMut = useMutation({
    mutationFn: incrementUsageApi,
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ["tier"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
    },
  });

  const tier           = tierData?.tier ?? "free";
  const specPacksUsed  = tierData?.specPacksThisMonth ?? 0;
  const specPacksLimit = tierData?.specPacksLimit ?? 3;
  const canGenerateSpec = tierData?.canGenerateSpec ?? true;
  const tierMeta       = TIER_META[tier] ?? TIER_META.free;

  // ── Tier gate helpers — full access bypasses everything ────────────────────
  const can = useCallback((feature) => {
    if (hasFullAccess) return true;
    return canUseFeature(tier, feature);
  }, [tier, hasFullAccess]);

  const gate = useCallback((feature) => {
    if (hasFullAccess) return true;
    if (canUseFeature(tier, feature)) return true;
    setUpgradeModal({ open: true, feature });
    return false;
  }, [tier, hasFullAccess]);

  const showUpgrade  = useCallback((feature) => setUpgradeModal({ open: true, feature }), []);
  const closeUpgrade = useCallback(() => setUpgradeModal({ open: false, feature: null }), []);

  // ── Top-up modal helpers ───────────────────────────────────────────────────
  const showTopup = useCallback((feature, label, used, limit, credits) => {
    setTopupModal({ open: true, feature, label, used, limit, credits });
  }, []);

  const closeTopup = useCallback(() => {
    setTopupModal({ open: false, feature: null, label: null, used: 0, limit: 0, credits: 0 });
    queryClient.invalidateQueries({ queryKey: ["usage"] });
    queryClient.invalidateQueries({ queryKey: ["tier"] });
  }, [queryClient]);

  // ── Smart nudge ────────────────────────────────────────────────────────────
  const setUpgradeNudge = useCallback((message) => {
    setUpgradeNudgeState({ show: true, message });
    setTimeout(() => setUpgradeNudgeState({ show: false, message: "" }), 30_000);
  }, []);

  const clearNudge = useCallback(() => setUpgradeNudgeState({ show: false, message: "" }), []);

  // ── Onboarding ─────────────────────────────────────────────────────────────
  const finishOnboarding = useCallback(async (builderType, experienceLevel) => {
    await saveOnboarding(builderType, experienceLevel);
    queryClient.setQueryData(["onboarding"], {
      onboardingComplete: true,
      builderType,
      experienceLevel,
    });
  }, [queryClient]);

  // ── Tier mutation ──────────────────────────────────────────────────────────
  const setTier = (newTier) => setTierMut.mutate(newTier);

  // ── Spec pack usage ────────────────────────────────────────────────────────
  const recordSpecPackUsage = async () => {
    if (!isSignedIn) return true;
    if (hasFullAccess)  return true;  // admin/founder — always allowed
    try {
      await incrementMut.mutateAsync();
      return true;
    } catch (err) {
      if (err?.tier) {
        showTopup(
          "spec_pack",
          "Spec Packs",
          specPacksUsed,
          specPacksLimit,
          0,
        );
      }
      return false;
    }
  };

  return (
    <TierContext.Provider value={{
      tier,
      tierMeta,
      specPacksUsed,
      specPacksLimit,
      canGenerateSpec,
      can,
      gate,
      showUpgrade,
      upgradeModal,
      closeUpgrade,
      topupModal,
      showTopup,
      closeTopup,
      upgradeNudge,
      setUpgradeNudge,
      clearNudge,
      setTier,
      recordSpecPackUsage,
      requiredTierForFeature,
      FEATURE_LABELS,
      usageData,
      refetchUsage,
      showOnboarding,
      finishOnboarding,
      onboardingData,
      isAdmin,
      hasFullAccess,
      isFounderActive,
      founderDaysLeft,
      founderAccessExpiry,
      nextTier: nextTier(tier),
    }}>
      {children}
    </TierContext.Provider>
  );
}

export function useTier() {
  const ctx = useContext(TierContext);
  if (!ctx) throw new Error("useTier must be used within TierProvider");
  return ctx;
}
