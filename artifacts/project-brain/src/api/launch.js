// ---------------------------------------------------------------------------
// launch.js — client for POST /api/launch (Launch Readiness analysis)
//
// Response shape:
// {
//   "LAUNCH_REPORT.md":    string,
//   "LAUNCH_CHECKLIST.md": string,
//   score:      number (0-100),
//   categories: Category[]
// }
//
// Category: { id, label, icon, items: Item[] }
// Item:     { id, label, status, priority, explanation }
//   status:   "done" | "partial" | "missing" | "na"
//   priority: "critical" | "high" | "medium" | "low"
// ---------------------------------------------------------------------------

function buildFallbackLaunchReport({ projectSpec }) {
  const today = new Date().toISOString().split("T")[0];

  const categories = [
    {
      id: "production",
      label: "Production Requirements",
      icon: "⚙️",
      items: [
        {
          id: "env-vars",
          label: "Secrets and API keys stored as environment variables (not in code)",
          status: "missing",
          priority: "critical",
          explanation: "Environment variables are like a secure vault for sensitive info your app needs — API keys, database passwords, and tokens. If these are pasted directly in your code files, anyone who sees your code (on GitHub, for example) can steal them and rack up charges on your accounts. In production, you set these in your hosting provider's dashboard instead.",
        },
        {
          id: "error-monitoring",
          label: "Error monitoring set up (e.g. Sentry, LogRocket, or similar)",
          status: "missing",
          priority: "high",
          explanation: "Error monitoring is like a smoke detector for your app — it alerts you the moment something breaks in production, even if no user reports it. Without it, you'll only find out about crashes when users complain (or stop using your app entirely). Free tiers on most tools cover small apps.",
        },
        {
          id: "prod-build",
          label: "App is running a production build (minified, not dev mode)",
          status: "missing",
          priority: "high",
          explanation: "A development build of your app includes debugging tools and extra code that makes it slow — it's like driving a race car with the hood open. A production build strips all that out, making your app 2–5x faster for real users. Most frameworks do this with a single command like 'npm run build'.",
        },
        {
          id: "custom-domain",
          label: "Custom domain configured (e.g. myapp.com instead of platform URL)",
          status: "missing",
          priority: "medium",
          explanation: "A custom domain makes your app look professional and trustworthy. Users are less likely to share or bookmark a URL that has 'replit.app' or 'vercel.app' in it. You can buy a domain for $10–15/year and connect it in about 15 minutes.",
        },
      ],
    },
    {
      id: "security",
      label: "Security",
      icon: "🔒",
      items: [
        {
          id: "auth",
          label: "User authentication is fully implemented and tested",
          status: "missing",
          priority: "critical",
          explanation: "Authentication is the system that checks who each user is — usually via username/password or social login. Without it, anyone can access any user's data. If your app handles any personal info or user-specific content, this is non-negotiable before launch.",
        },
        {
          id: "https",
          label: "HTTPS is enabled on the production URL",
          status: "missing",
          priority: "critical",
          explanation: "HTTPS encrypts all data traveling between your users' browsers and your server — without it, passwords and personal data travel in plain text that anyone on the same network can read. Modern browsers also show a 'Not Secure' warning for HTTP sites, which will scare users away instantly.",
        },
        {
          id: "cors",
          label: "CORS configured to only allow trusted origins",
          status: "missing",
          priority: "high",
          explanation: "CORS (Cross-Origin Resource Sharing) controls which websites can make requests to your API. If it's wide open, any website on the internet can call your backend and potentially abuse it. You should whitelist only your own frontend URL.",
        },
        {
          id: "input-validation",
          label: "User inputs are validated and sanitized on the server",
          status: "missing",
          priority: "critical",
          explanation: "Input validation means checking that what users submit is safe and expected before your app processes it. Without it, a user could type malicious code into a form field and break your app, steal data, or take it down entirely. This is one of the most common ways apps get hacked.",
        },
        {
          id: "no-secrets-in-code",
          label: "No API keys or passwords are hardcoded in the codebase",
          status: "missing",
          priority: "critical",
          explanation: "If your API keys or database passwords are written directly in your code files, and that code is on GitHub or visible to anyone, they can be used to rack up huge bills on your accounts, access your database, or impersonate your app. Use environment variables instead.",
        },
      ],
    },
    {
      id: "database",
      label: "Database",
      icon: "🗄️",
      items: [
        {
          id: "persistence",
          label: "Data persists between app restarts (not stored in memory only)",
          status: "missing",
          priority: "critical",
          explanation: "If your app stores data in JavaScript variables or memory instead of a real database, that data disappears every time your server restarts or redeploys — which could mean losing all your users' posts, settings, or work instantly. A real database like PostgreSQL or MongoDB keeps data safe permanently.",
        },
        {
          id: "backups",
          label: "Automated database backups are configured",
          status: "missing",
          priority: "high",
          explanation: "Backups are copies of your data stored separately, so if your database crashes, gets corrupted, or you accidentally delete something, you can restore it. Most managed database providers (like Supabase, PlanetScale, or Render) offer automatic daily backups — it usually takes one click to enable.",
        },
        {
          id: "db-creds",
          label: "Database credentials stored in environment variables",
          status: "missing",
          priority: "critical",
          explanation: "Your database URL, username, and password should never appear in your code files. If they do and your repo is public (or gets leaked), anyone can connect to your database directly and read, modify, or delete all your data. Store them as environment variables in your hosting dashboard.",
        },
        {
          id: "migrations",
          label: "All database migrations have been run in production",
          status: "missing",
          priority: "high",
          explanation: "Migrations are changes to your database structure (like adding a new column or table). If you ran them locally but not in production, your app in production is missing tables or columns it needs — causing crashes for real users. Always run migrations as part of your deployment process.",
        },
      ],
    },
    {
      id: "legal",
      label: "Legal / Policy",
      icon: "⚖️",
      items: [
        {
          id: "terms",
          label: "Terms of Service page exists and is linked from the footer",
          status: "missing",
          priority: "high",
          explanation: "Terms of Service is a legal document that defines the rules for using your app — what users can and can't do, and what they agree to by using it. Without it, you have little protection if a user misuses your service or takes legal action. Many free templates exist online you can customize in an hour.",
        },
        {
          id: "privacy-policy",
          label: "Privacy Policy page exists and explains data collection",
          status: "missing",
          priority: "high",
          explanation: "A Privacy Policy tells users what personal data you collect (email, name, usage data) and how you use it. It's legally required in most countries if you collect any user data — including just email addresses. App stores, ad platforms, and many third-party services also require one to use their services.",
        },
        {
          id: "cookie-consent",
          label: "Cookie consent banner shown to users (if using tracking cookies)",
          status: "na",
          priority: "medium",
          explanation: "If your app uses cookies for analytics, advertising, or tracking users across sessions, EU law (GDPR) requires you to get explicit consent before setting those cookies. A simple banner asking 'Accept cookies?' is usually sufficient, and many free plugins handle this automatically.",
        },
        {
          id: "data-deletion",
          label: "Users can delete their account and all associated data",
          status: "missing",
          priority: "medium",
          explanation: "Privacy laws like GDPR (EU) and CCPA (California) give users the right to have all their data permanently deleted on request. This means building a 'Delete my account' feature that removes their records from your database. It's both a legal requirement and a trust signal for users.",
        },
      ],
    },
    {
      id: "mobile",
      label: "Mobile / Responsive",
      icon: "📱",
      items: [
        {
          id: "viewport-meta",
          label: "Viewport meta tag is present in the HTML <head>",
          status: "missing",
          priority: "high",
          explanation: "The viewport meta tag (<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">) tells mobile browsers how to scale your page correctly. Without it, your app will appear tiny and zoomed out on phones — like a desktop website shrunk to phone size. It's a one-line fix.",
        },
        {
          id: "responsive",
          label: "Layout is fully responsive — no horizontal scrolling on mobile",
          status: "missing",
          priority: "high",
          explanation: "Responsive design means your layout adapts to different screen sizes — phones, tablets, and desktops. If users have to scroll sideways on their phone to see your content, most of them will immediately leave. Over 50% of web traffic today comes from mobile devices.",
        },
        {
          id: "touch-targets",
          label: "Buttons and links are large enough to tap (minimum 44×44px)",
          status: "missing",
          priority: "medium",
          explanation: "On touchscreens, buttons and links need to be big enough for a fingertip to tap accurately — Apple and Google both recommend at least 44×44 pixels. Tiny buttons frustrate mobile users and lead to accidental taps on the wrong thing. This is an easy CSS fix using padding.",
        },
        {
          id: "mobile-tested",
          label: "App has been tested on a real mobile device or browser emulator",
          status: "missing",
          priority: "high",
          explanation: "Desktop preview in browser dev tools is helpful but doesn't catch everything — font sizes, scroll behavior, and hover states all behave differently on real devices. Testing on an actual phone (or using BrowserStack's free trial) before launch catches issues that would frustrate your first real users.",
        },
      ],
    },
  ];

  // Calculate score from statuses/priorities
  let score = 100;
  for (const cat of categories) {
    for (const item of cat.items) {
      if (item.status === "na") continue;
      const deductions = { critical: 15, high: 8, medium: 3, low: 1 };
      const d = deductions[item.priority] ?? 3;
      if (item.status === "missing") score -= d;
      else if (item.status === "partial") score -= Math.round(d / 2);
    }
  }
  score = Math.max(0, score);

  const totalItems   = categories.flatMap((c) => c.items).filter((i) => i.status !== "na").length;
  const doneItems    = categories.flatMap((c) => c.items).filter((i) => i.status === "done").length;
  const criticalLeft = categories.flatMap((c) => c.items).filter((i) => i.priority === "critical" && i.status !== "done" && i.status !== "na").length;

  const scoreLabel = score >= 81 ? "Launch Ready!" : score >= 61 ? "Almost Ready" : score >= 31 ? "Needs Work" : "Not Ready";

  return {
    "LAUNCH_REPORT.md": `# LAUNCH_REPORT.md — Launch Readiness Report

## 🚀 Launch Readiness Score: ${score}% — ${scoreLabel}

> _Generated: ${today} | ${doneItems}/${totalItems} items complete | ${criticalLeft} critical blockers_

---

## Summary

${
  score >= 81
    ? `Your app is **ready to launch**! A few polish items remain but nothing blocking.`
    : score >= 61
    ? `Your app is **almost ready** — address the critical items below before going live.`
    : score >= 31
    ? `Your app **needs work** before launch. Several critical items must be resolved first.`
    : `Your app is **not ready to launch** yet. Multiple critical blockers need attention.`
}

## Critical Blockers (Must Fix Before Launch)
${categories
  .flatMap((c) => c.items)
  .filter((i) => i.priority === "critical" && i.status !== "done")
  .map((i) => `- ⛔ **${i.label}**`)
  .join("\n") || "✅ No critical blockers"}

## High Priority (Should Fix Before Launch)
${categories
  .flatMap((c) => c.items)
  .filter((i) => i.priority === "high" && i.status !== "done")
  .map((i) => `- 🟠 ${i.label}`)
  .join("\n") || "✅ All high-priority items addressed"}

## What's Looking Good
${categories
  .flatMap((c) => c.items)
  .filter((i) => i.status === "done")
  .map((i) => `- ✅ ${i.label}`)
  .join("\n") || "_Complete the checklist to show completed items here._"}

---
_Use the Launch Checklist in your Build Companion to track progress as you fix each item._
`,

    "LAUNCH_CHECKLIST.md": `# LAUNCH_CHECKLIST.md — Launch Readiness Checklist

**Score: ${score}% — ${scoreLabel}** | ${doneItems}/${totalItems} complete

---

${categories
  .map(
    (cat) =>
      `## ${cat.icon} ${cat.label}\n${cat.items
        .map((i) => `- [${i.status === "done" ? "x" : " "}] ${i.label} _(${i.priority})_`)
        .join("\n")}`,
  )
  .join("\n\n")}
`,

    score,
    categories,
  };
}

// ---------------------------------------------------------------------------
// generateLaunchReport — calls POST /api/launch
// ---------------------------------------------------------------------------
export async function generateLaunchReport({ projectSpec }) {
  try {
    const response = await fetch("/api/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectSpec }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Launch server returned ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      console.warn("[generateLaunchReport] API server unreachable, using fallback:", err.message);
      return buildFallbackLaunchReport({ projectSpec });
    }
    throw err;
  }
}
