export const TIER_ORDER = ["free", "builder", "pro"];

// Monthly caps per tier — no "unlimited" language anywhere
export const USAGE_LIMITS = {
  free:    { spec_pack: 3,   companion_message: 10,  bug_translator: 3,  question_translator: 3,  feature_builder: 0,  live_render: 0,  repo_doctor: 0  },
  builder: { spec_pack: 30,  companion_message: 100, bug_translator: 30, question_translator: 30, feature_builder: 20, live_render: 5,  repo_doctor: 0  },
  pro:     { spec_pack: 100, companion_message: 500, bug_translator: 100, question_translator: 100, feature_builder: 75, live_render: 50, repo_doctor: 10 },
};

export const FEATURE_USAGE_LABELS = {
  spec_pack:           "Spec Packs",
  companion_message:   "Build Companion messages",
  bug_translator:      "Bug Translator uses",
  question_translator: "AI Question Translator uses",
  feature_builder:     "Feature Builder uses",
  live_render:         "Live Renders",
  repo_doctor:         "Repo Doctor runs",
};

// Top-up packs
export const TOP_UP_PACKS = {
  spec_pack_bundle:     { feature: "spec_pack",         amount: 10, price: "$4.99", label: "Spec Pack Bundle",     description: "+10 Spec Packs" },
  companion_boost:      { feature: "companion_message",  amount: 50, price: "$2.99", label: "Companion Boost",      description: "+50 Build Companion messages" },
  render_pack:          { feature: "live_render",        amount: 10, price: "$4.99", label: "Render Pack",          description: "+10 Live Renders" },
  repo_doctor_run:      { feature: "repo_doctor",        amount: 3,  price: "$5.99", label: "Repo Doctor Run",      description: "+3 Repo Doctor analyses" },
  builder_boost_bundle: { feature: null,                 amount: 0,  price: "$14.99", label: "Builder Boost Bundle", description: "Spec packs + companion + renders + repo doctor" },
};

// Which top-up pack covers each feature (null = upgrade only, no pack)
export const FEATURE_TOPUP_PACK = {
  spec_pack:           "spec_pack_bundle",
  companion_message:   "companion_boost",
  live_render:         "render_pack",
  repo_doctor:         "repo_doctor_run",
  bug_translator:      null,
  question_translator: null,
  feature_builder:     null,
};

export const TIER_META = {
  free: {
    label:       "Free",
    badge:       "Free",
    price:       "$0",
    priceAnnual: "$0",
    priceMonthly:       "Free forever",
    priceAnnualMonthly: "Free forever",
    annualTotal: null,
    savings:     null,
    color:       "text-subtle",
    badgeClass:  "bg-elevated text-subtle border-panel",
    highlight:   false,
    description: "Try CodeMeGood and generate your first specs — no credit card needed.",
    features: [
      { text: "3 Spec Packs / month",                  included: true  },
      { text: "10 Build Companion messages / month",    included: true  },
      { text: "3 Bug Translator uses / month",          included: true  },
      { text: "3 AI Question Translator uses / month",  included: true  },
      { text: "Guided Mode (structured intake)",        included: true  },
      { text: "Markdown export",                        included: true  },
      { text: "Feature Builder",                        included: false },
      { text: "Live Render",                            included: false },
      { text: "Repo Doctor",                            included: false },
    ],
    limits: { specPacksPerMonth: 3 },
    cta: "Get started free",
  },
  builder: {
    label:       "Builder",
    badge:       "Builder",
    price:       "$29",
    priceAnnual: "$23",
    priceMonthly:       "$29 / month",
    priceAnnualMonthly: "$23 / mo · billed $276/yr",
    annualTotal: "$276 / year",
    savings:     "Save $72/yr",
    color:       "text-primary",
    badgeClass:  "bg-primary/10 text-primary border-primary/25",
    highlight:   true,
    description: "Build faster with more spec packs, platform adapters, and quality tools.",
    features: [
      { text: "30 Spec Packs / month",                 included: true  },
      { text: "100 Build Companion messages / month",   included: true  },
      { text: "30 Bug Translator uses / month",         included: true  },
      { text: "30 AI Question Translator uses / month", included: true  },
      { text: "20 Feature Builder uses / month",        included: true  },
      { text: "5 Live Renders / month",                 included: true  },
      { text: "Cursor, Replit & Lovable adapters",      included: true  },
      { text: "Prompt chains",                          included: true  },
      { text: "Spec Quality Score",                     included: true  },
      { text: "Launch checklist",                       included: true  },
      { text: "ZIP & Markdown export",                  included: true  },
      { text: "Repo Doctor",                            included: false },
      { text: "Pro Mode (skip guided intake)",          included: false },
    ],
    limits: { specPacksPerMonth: 30 },
    cta: "Upgrade to Builder",
  },
  pro: {
    label:       "Pro",
    badge:       "Pro",
    price:       "$69",
    priceAnnual: "$55",
    priceMonthly:       "$69 / month",
    priceAnnualMonthly: "$55 / mo · billed $660/yr",
    annualTotal: "$660 / year",
    savings:     "Save $168/yr",
    color:       "text-secondary",
    badgeClass:  "bg-secondary/10 text-secondary border-secondary/30",
    highlight:   false,
    description: "Full power for serious builders: Repo Doctor, Pro Mode, and everything else.",
    features: [
      { text: "100 Spec Packs / month",                     included: true  },
      { text: "500 Build Companion messages / month",        included: true  },
      { text: "100 Bug Translator uses / month",             included: true  },
      { text: "100 AI Question Translator uses / month",     included: true  },
      { text: "75 Feature Builder uses / month",             included: true  },
      { text: "50 Live Renders / month",                     included: true  },
      { text: "10 Repo Doctor runs / month",                 included: true  },
      { text: "Pro Mode — skip guided intake",               included: true  },
      { text: "All adapters (Cursor, Replit, Lovable, Bolt, v0, Generic)", included: true },
      { text: "Full prompt chains",                          included: true  },
      { text: "Spec Quality Score",                          included: true  },
      { text: "Launch checklist",                            included: true  },
      { text: "Flight Recorder",                             included: true  },
      { text: "Version history",                             included: true  },
      { text: "ZIP & GitHub export",                         included: true  },
    ],
    limits: { specPacksPerMonth: 100 },
    cta: "Upgrade to Pro",
  },
};

// Feature → minimum tier required
export const FEATURE_GATES = {
  idea_doctor:     "free",
  spec_pack:       "free",
  launch_coach:    "builder",
  adapters:        "builder",
  prompt_chains:   "builder",
  spec_quality:    "builder",
  feature_builder: "pro",
  flight_recorder: "pro",
  repo_doctor:     "pro",
  debugger:        "pro",
};

export const FEATURE_LABELS = {
  launch_coach:    "Launch Coach",
  adapters:        "Platform Adapters",
  prompt_chains:   "Prompt Chains",
  spec_quality:    "Spec Quality Score",
  feature_builder: "Feature Builder",
  flight_recorder: "Flight Recorder",
  repo_doctor:     "Repo Doctor",
  debugger:        "Debugger",
};

export function canUseFeature(userTier, feature) {
  const required = FEATURE_GATES[feature] ?? "free";
  return TIER_ORDER.indexOf(userTier ?? "free") >= TIER_ORDER.indexOf(required);
}

export function requiredTierForFeature(feature) {
  return FEATURE_GATES[feature] ?? "free";
}

export function tierAtLeast(userTier, minTier) {
  return TIER_ORDER.indexOf(userTier ?? "free") >= TIER_ORDER.indexOf(minTier);
}

// The tier that comes after the given tier
export function nextTier(currentTier) {
  const idx = TIER_ORDER.indexOf(currentTier ?? "free");
  return TIER_ORDER[idx + 1] ?? null;
}
