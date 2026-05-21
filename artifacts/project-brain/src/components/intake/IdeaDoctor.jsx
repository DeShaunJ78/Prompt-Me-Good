import { cn } from "@/lib/utils";

// ===========================================================================
// GAME MODE — unchanged
// ===========================================================================
const GAME_KEYWORDS = [
  "game", "games", "gaming", "arcade", "platformer", "puzzle", "shooter",
  "fps", "rpg", "rts", "mmorpg", "mmo", "indie game", "mobile game",
  "endless runner", "tower defense", "battle royale", "side scroller",
  "top-down", "roguelike", "roguelite", "dungeon crawler", "card game",
  "board game", "strategy game", "simulation game", "clicker", "idle game",
  "fighting game", "racing game", "sports game", "sandbox game",
  "survival game", "horror game", "metroidvania", "action game",
  "adventure game", "level design", "levels", "score", "leaderboard",
  "lives", "health bar", "respawn", "powerup", "power-up", "boss fight",
  "spawn", "enemy", "npc", "sprite", "pixel art", "tilemap",
  "physics engine", "game engine", "phaser", "canvas game", "webgl game",
  "three.js game", "2d game", "3d game",
];

export function detectGameMode(ideaText) {
  const lower = ideaText.toLowerCase();
  return GAME_KEYWORDS.some((kw) => lower.includes(kw));
}

export const GAME_PHASES = [
  {
    id: 1, title: "Game Canvas & Core Loop", status: "done",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Set up the game canvas and implement a stable game loop.\n- **Allowed Files:** \`src/game/Game.js\`, \`src/game/GameLoop.js\`, \`index.html\`\n- **DO NOT TOUCH:** UI components, scoring, enemy spawning, audio.\n- **Rule:** STOP and ask permission before modifying anything outside allowed files.`,
    scopeLock: ["src/game/Game.js", "src/game/GameLoop.js", "index.html"],
    expectedResult: "A canvas renders at 60 fps with a stable, delta-time-aware game loop. State transitions work.",
    manualTests: ["Canvas renders without flicker", "DevTools shows ~16 ms frame time", "Escape toggles PAUSED state"],
    receipt: ["Canvas initialises without errors", "requestAnimationFrame loop runs continuously", "State machine transitions correctly"],
  },
  {
    id: 2, title: "Player & Input System", status: "active",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Implement the player entity and keyboard/touch input.\n- **Allowed Files:** \`src/game/Player.js\`, \`src/game/InputManager.js\`\n- **DO NOT TOUCH:** Game loop, enemy system, scoring, audio.`,
    scopeLock: ["src/game/Player.js", "src/game/InputManager.js"],
    expectedResult: "Player moves smoothly with keyboard input and stays within canvas bounds.",
    manualTests: ["Arrow keys and WASD move the player", "Player cannot leave canvas", "Diagonal movement works"],
    receipt: ["Player class renders on canvas", "InputManager tracks keydown/keyup", "Boundary collision works"],
  },
  {
    id: 3, title: "Core Game Mechanic", status: "pending",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Implement the core gameplay mechanic.\n- **Allowed Files:** \`src/game/Mechanics.js\`, \`src/game/EntityManager.js\`\n- **DO NOT TOUCH:** Game loop, Player class, InputManager, UI, scoring.`,
    scopeLock: ["src/game/Mechanics.js", "src/game/EntityManager.js"],
    expectedResult: "Core mechanic works. Entities spawn, move, collide, and despawn correctly.",
    manualTests: ["Entities spawn correctly", "Collision registers hits", "No memory leak after repeated play"],
    receipt: ["EntityManager tracks all entities", "AABB collision works", "Entities despawn correctly"],
  },
  {
    id: 4, title: "Scoring, Lives & Game Over", status: "pending",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Add scoring, lives/health, and a game-over flow.\n- **Allowed Files:** \`src/game/ScoreSystem.js\`, \`src/ui/HUD.js\`\n- **DO NOT TOUCH:** Game loop, Player, EntityManager, core mechanics.`,
    scopeLock: ["src/game/ScoreSystem.js", "src/ui/HUD.js"],
    expectedResult: "Score increments on success. Lives decrease on failure. Game over at 0 lives. High score persists.",
    manualTests: ["Score increments correctly", "Life counter decreases on damage", "Game over at 0 lives", "High score persists on refresh"],
    receipt: ["ScoreSystem.increment() works", "HUD renders every frame", "GAME_OVER triggers at 0 lives", "localStorage round-trips correctly"],
  },
  {
    id: 5, title: "Juice, Audio & Ship", status: "pending",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Add audio, visual juice, and deploy.\n- **Allowed Files:** \`src/audio/AudioManager.js\`, \`src/game/Particles.js\`, \`vite.config.js\`\n- **DO NOT TOUCH:** Core game loop, Player, EntityManager, ScoreSystem.`,
    scopeLock: ["src/audio/AudioManager.js", "src/game/Particles.js", "vite.config.js"],
    expectedResult: "Game has audio, particles, polished screens, deployed at a public URL.",
    manualTests: ["Sound effects play on key events", "Particles on impact", "Start screen shows", "Deployed URL loads on mobile"],
    receipt: ["AudioManager plays without errors", "Particles run without dropping frames", "Screens transition smoothly", "All FUN_TEST.md items green"],
  },
];

export function GameModeBanner({ visible }) {
  if (!visible) return null;
  return (
    <div className={cn("w-full rounded-xl px-4 py-3 flex items-center gap-3 border", "bg-warning/8 border-warning/30")}>
      <span className="text-2xl shrink-0">🎮</span>
      <div>
        <p className="text-xs font-semibold text-warning">Game Builder Mode activated</p>
        <p className="text-xs text-subtle mt-0.5">
          Your spec pack will include a Game Design Doc, Systems Architecture, Asset List, and Fun Test checklist.
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// WEBSITE MODE — static, content-focused sites (no backend, no user accounts)
// ===========================================================================
const WEBSITE_KEYWORDS = [
  "website", "landing page", "homepage", "portfolio", "personal site",
  "blog", "brochure site", "marketing site", "static site", "content site",
  "company website", "business website", "showcase", "presentation site",
  "web presence", "online presence", "micro site", "one-pager", "one page site",
  "info site", "informational site", "lead gen site", "agency site",
];

export function detectWebsiteMode(ideaText) {
  if (detectGameMode(ideaText)) return false;
  const lower = ideaText.toLowerCase();
  return WEBSITE_KEYWORDS.some((kw) => lower.includes(kw));
}

export const WEBSITE_COMPANION_DEFAULTS = [
  "No backend needed for V1 — deploy static HTML/React to Vercel or Netlify in minutes.",
  "Write all your copy before designing — content shapes the layout, not the other way around.",
  "One primary CTA per page — too many choices = no choices.",
  "Mobile-first layout — 60% of web traffic is mobile; design for the small screen first.",
  "Google Lighthouse score > 90 before launch — performance is an SEO ranking factor.",
];

export const WEBSITE_PHASES = [
  {
    id: 1, title: "Design System & Shell", status: "done",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Set up design tokens, base layout, and reusable components.\n- **Allowed Files:** \`src/styles/tokens.css\`, \`src/components/Layout.jsx\`, \`src/components/Header.jsx\`, \`src/components/Footer.jsx\`\n- **DO NOT TOUCH:** Page content, copy, images, forms.\n- **Safe Default:** Establish font, colour palette, and spacing scale before writing a single line of page content.\n\n**Instructions:**\n1. Define CSS custom properties for colours, fonts, and spacing.\n2. Create a \`Layout\` wrapper with \`Header\` + \`Footer\`.\n3. Create skeleton \`Hero\`, \`FeatureCard\`, and \`CTAButton\` components with placeholder text.\n4. Test responsiveness at 375 px, 768 px, and 1280 px.`,
    scopeLock: ["src/styles/tokens.css", "src/components/Layout.jsx", "src/components/Header.jsx", "src/components/Footer.jsx"],
    expectedResult: "A responsive shell renders correctly at all breakpoints. Design tokens are consistent across all components.",
    manualTests: ["Shell renders at 375 px without horizontal scroll", "Header nav collapses to hamburger on mobile", "Footer links are visible and not clipped"],
    receipt: ["CSS tokens file exists and is imported globally", "Layout wraps all pages", "Responsive breakpoints tested at 3 widths"],
  },
  {
    id: 2, title: "Pages & Content", status: "active",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Build all pages with real copy and images.\n- **Allowed Files:** \`src/pages/\` directory, \`public/images/\`\n- **DO NOT TOUCH:** Design tokens, Layout shell, form logic.\n- **Safe Default:** Write copy in a plain text file first. Never design with "Lorem ipsum" — it fools you into thinking the layout works.\n\n**Instructions:**\n1. Create all pages defined in CONTENT_MAP.md.\n2. Add real headlines, body copy, and images (use Unsplash for placeholders).\n3. Ensure every page has a visible, above-the-fold CTA.\n4. Add social proof (testimonials, logos, stats) on the Home page.`,
    scopeLock: ["src/pages/", "public/images/"],
    expectedResult: "All pages from CONTENT_MAP.md exist with real copy and at least one image per page.",
    manualTests: ["Every page has a visible CTA above the fold", "All images load and are correctly sized", "No Lorem ipsum text remains"],
    receipt: ["All CONTENT_MAP.md pages created", "Real headlines and body copy on every page", "Social proof block visible on Home page"],
  },
  {
    id: 3, title: "Forms & Lead Capture", status: "pending",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Add contact form and lead capture with email delivery.\n- **Allowed Files:** \`src/components/ContactForm.jsx\`, \`src/components/EmailCapture.jsx\`\n- **DO NOT TOUCH:** Page layouts, design tokens, image assets.\n- **Safe Default:** Use Formspree or EmailJS for form submission — no backend required for a static site.\n\n**Instructions:**\n1. Build a contact form (name, email, message) with client-side validation.\n2. Connect to Formspree or EmailJS — zero backend code.\n3. Show a clear success message after submission.\n4. Add honeypot field to prevent spam.`,
    scopeLock: ["src/components/ContactForm.jsx", "src/components/EmailCapture.jsx"],
    expectedResult: "Contact form submits successfully and sends an email. Spam protection is active.",
    manualTests: ["Form submits and shows success state", "Empty required fields show validation errors", "An email arrives after submission", "Honeypot field is hidden from real users"],
    receipt: ["Form renders without errors", "Validation prevents empty submission", "Formspree/EmailJS integration tested", "Success state visible after submit"],
  },
  {
    id: 4, title: "SEO & Performance", status: "pending",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Implement all SEO_PLAN.md items and hit Lighthouse > 90.\n- **Allowed Files:** \`src/components/SEO.jsx\`, \`public/sitemap.xml\`, \`public/robots.txt\`, \`public/\` image assets\n- **DO NOT TOUCH:** Page content, form logic, design tokens.\n- **Safe Default:** Run Lighthouse in an Incognito window — extensions inflate scores.\n\n**Instructions:**\n1. Add unique \`<title>\` and \`<meta description>\` to every page.\n2. Add Open Graph tags (\`og:title\`, \`og:description\`, \`og:image\`).\n3. Generate \`sitemap.xml\` and submit to Google Search Console.\n4. Compress all images to WebP. Aim for < 100 KB per image.\n5. Run Lighthouse — fix all items blocking > 90 score.`,
    scopeLock: ["src/components/SEO.jsx", "public/sitemap.xml", "public/robots.txt"],
    expectedResult: "Every page passes Lighthouse > 90 on Performance, Accessibility, and SEO. sitemap.xml submitted.",
    manualTests: ["Lighthouse Performance > 90 in Incognito", "Lighthouse SEO > 90", "OG image shows correctly when URL is pasted into Slack", "sitemap.xml is reachable at /sitemap.xml"],
    receipt: ["SEO component sets meta tags per page", "sitemap.xml lists all pages", "robots.txt allows crawling", "All images are WebP"],
  },
  {
    id: 5, title: "Deploy & Analytics", status: "pending",
    platform: "Manual",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Deploy to production with a custom domain and analytics.\n- **Allowed Files:** \`vercel.json\` or \`netlify.toml\`, \`src/analytics.js\`\n- **DO NOT TOUCH:** Page content, SEO tags, form logic.\n- **Safe Default:** Vercel is the simplest deploy for React/Vite. Connect your GitHub repo and it deploys automatically on every push.\n\n**Instructions:**\n1. Deploy to Vercel or Netlify (connect GitHub repo).\n2. Add your custom domain in the dashboard.\n3. Install Google Analytics 4 or Plausible (privacy-friendly).\n4. Set up a conversion event for form submission.\n5. Verify the site is indexed by Googling \`site:yourdomain.com\` 24–48 hours after launch.`,
    scopeLock: ["vercel.json", "netlify.toml", "src/analytics.js"],
    expectedResult: "Site is live at a custom domain. Analytics tracking conversions. Google can find it.",
    manualTests: ["Custom domain loads with HTTPS", "Analytics dashboard shows page views", "Form submission registers as a conversion event", "Google Search Console shows the site as submitted"],
    receipt: ["Deploy pipeline connected to GitHub", "Custom domain with HTTPS configured", "Analytics installed and tracking", "sitemap submitted to Search Console"],
  },
];

export function WebsiteModeBanner({ visible }) {
  if (!visible) return null;
  return (
    <div className={cn("w-full rounded-xl px-4 py-3 flex items-center gap-3 border", "bg-primary/8 border-primary/25")}>
      <span className="text-2xl shrink-0">🌐</span>
      <div>
        <p className="text-xs font-semibold text-primary">Website Mode activated</p>
        <p className="text-xs text-subtle mt-0.5">
          No database or backend needed. Your pack includes a Content Map and SEO Plan instead of backend specs.
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// WEB APP MODE — dynamic apps with user accounts, database, and backend logic
// ===========================================================================
const WEBAPP_KEYWORDS = [
  "web app", "web application", "saas", "platform", "tool", "dashboard",
  "user account", "user accounts", "login", "sign up", "sign in", "log in",
  "register", "authentication", "auth", "sign-in", "sign-up",
  "database", "db", "postgresql", "mysql", "sqlite", "mongodb",
  "users can", "members", "membership", "subscription", "subscriptions",
  "checkout", "payment", "stripe", "billing", "invoice",
  "admin panel", "admin dashboard", "user profile", "profile page",
  "notifications", "feed", "activity", "collaboration", "team",
  "api", "backend", "server", "endpoint", "real-time", "realtime",
];

export function detectWebAppMode(ideaText) {
  if (detectGameMode(ideaText)) return false;
  if (detectWebsiteMode(ideaText)) return false;
  const lower = ideaText.toLowerCase();
  return WEBAPP_KEYWORDS.some((kw) => lower.includes(kw));
}

export const WEBAPP_COMPANION_DEFAULTS = [
  "Define your database schema on day 1 — it is very hard to change once real users have data in it.",
  "Build auth before you build any user-facing features — never store user data without working authentication.",
  "Build the core loop for ONE user first — don't add multi-user or teams until the single-user case is solid.",
  "Every API route must validate its inputs — never trust data from the frontend.",
  "Test the happy path end-to-end before adding any error states or edge case handling.",
];

export const WEBAPP_PHASES = [
  {
    id: 1, title: "Foundation: DB Schema & Shell", status: "done",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Define the database schema and create the core app shell.\n- **Allowed Files:** \`db/schema.sql\`, \`src/App.tsx\`, \`src/components/layout/\`\n- **DO NOT TOUCH:** Auth routes, feature pages, business logic.\n- **Safe Default:** Your schema is your contract. Once users have data in it, changing it is painful. Think it through before writing any other code.\n\n**Instructions:**\n1. Write \`db/schema.sql\` — define all tables with columns, types, and foreign keys.\n2. Create the app shell with placeholder routes (no logic yet).\n3. Set up Drizzle ORM or Prisma schema to mirror the SQL.\n4. Seed the DB with 2-3 rows of realistic test data.`,
    scopeLock: ["db/schema.sql", "src/App.tsx", "src/components/layout/"],
    expectedResult: "Database schema is defined and seeded. App shell renders all routes (empty). ORM schema matches SQL schema.",
    manualTests: ["DB seeded — test rows visible in DB viewer", "All route paths render without 404", "ORM query for a test record returns correct data"],
    receipt: ["schema.sql defines all tables", "ORM schema matches SQL", "Seed data is realistic", "All routes render shell without errors"],
  },
  {
    id: 2, title: "Authentication", status: "active",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Implement sign-up, login, sessions, and protected routes.\n- **Allowed Files:** \`src/routes/auth.ts\`, \`src/middleware/auth.ts\`, \`src/pages/Login.tsx\`, \`src/pages/Signup.tsx\`\n- **DO NOT TOUCH:** DB schema, feature pages, business logic.\n- **Safe Default:** Use Replit Auth or Clerk — rolling your own auth is a month of work and full of security holes. Never store plain-text passwords.\n\n**Instructions:**\n1. Implement sign-up (email + password or OAuth).\n2. Implement login and session management (JWTs or HTTP-only cookies).\n3. Create \`requireAuth\` middleware that blocks unauthenticated requests.\n4. Protect all non-public routes with the middleware.\n5. Add a "forgot password" flow.`,
    scopeLock: ["src/routes/auth.ts", "src/middleware/auth.ts", "src/pages/Login.tsx", "src/pages/Signup.tsx"],
    expectedResult: "Users can sign up, log in, and log out. Unauthenticated requests to protected routes return 401. Sessions persist across page refreshes.",
    manualTests: ["Sign up with new email works", "Login with correct credentials works", "Navigating to /dashboard while logged out redirects to /login", "Session persists after page refresh", "Logout clears the session"],
    receipt: ["Sign-up creates a user row in the DB", "Passwords are hashed (bcrypt or Argon2)", "requireAuth middleware returns 401 for missing token", "Logout clears cookie/token", "Protected routes redirect unauthenticated users"],
  },
  {
    id: 3, title: "Core Feature", status: "pending",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Implement the primary user-facing feature (CRUD + business logic).\n- **Allowed Files:** \`src/routes/[feature].ts\`, \`src/pages/[feature]/\`, \`src/components/[feature]/\`\n- **DO NOT TOUCH:** Auth middleware, DB schema, other features.\n- **Safe Default:** Build Create and Read first. Update and Delete can wait. Get the happy path working before adding any error handling.\n\n**Instructions:**\n1. Build API routes for the core resource (Create, Read, Update, Delete).\n2. Build the frontend UI for the primary user flow.\n3. Wire the frontend to the API — real data, not mocks.\n4. Add input validation on both frontend and backend.`,
    scopeLock: ["src/routes/", "src/pages/", "src/components/"],
    expectedResult: "A logged-in user can complete the primary flow end-to-end with real data persisted to the database.",
    manualTests: ["User can create a resource", "Created resource persists after page refresh", "User can view a list of their resources", "User cannot see other users' resources", "Invalid inputs show helpful error messages"],
    receipt: ["API routes return correct status codes", "Input validation rejects bad data", "DB correctly stores and returns user-scoped data", "Frontend shows error states, not blank screens"],
  },
  {
    id: 4, title: "Polish & Edge Cases", status: "pending",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Add loading states, error states, and mobile responsiveness.\n- **Allowed Files:** \`src/components/ui/\`, \`src/hooks/\`, \`src/styles/\`\n- **DO NOT TOUCH:** Auth logic, API routes, DB schema.\n- **Safe Default:** Fix the empty state first — what do users see when they have no data? That's the first thing new users see.\n\n**Instructions:**\n1. Add loading skeletons for all data-fetching components.\n2. Add error states for failed API calls (never show a blank screen).\n3. Add empty states for lists/tables with 0 items.\n4. Verify all pages are usable on a 375 px mobile screen.\n5. Test with slow network (DevTools → Network → Slow 3G).`,
    scopeLock: ["src/components/ui/", "src/hooks/", "src/styles/"],
    expectedResult: "No blank screens on error or load. Empty states guide new users. All pages work on mobile.",
    manualTests: ["Throttle to Slow 3G — loading skeletons appear", "Disconnect network — error state shows, not blank screen", "New account with 0 data — empty state is visible and helpful", "All pages usable on 375 px width"],
    receipt: ["Loading skeleton on every async component", "Error boundary or try/catch on every API call", "Empty state on every list/table", "0 horizontal scroll on mobile"],
  },
  {
    id: 5, title: "Ship: Production & Monitoring", status: "pending",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Deploy to production with a real database, env vars, and monitoring.\n- **Allowed Files:** \`replit.toml\` or deployment config, \`.env.production\`, \`src/monitoring.ts\`\n- **DO NOT TOUCH:** Feature logic, auth, DB schema.\n- **Safe Default:** Never commit secrets to Git. Use environment variables for every API key, DB URL, and secret. Check with a secret scanner before your first deploy.\n\n**Instructions:**\n1. Deploy via Replit Deployments (production DB, production env vars).\n2. Run all database migrations on the production DB.\n3. Set up error monitoring (Sentry free tier).\n4. Add a health check endpoint (\`GET /api/health\`).\n5. Test the full user flow on production before announcing launch.`,
    scopeLock: ["replit.toml", ".env.production", "src/monitoring.ts"],
    expectedResult: "App is live on production with a real DB. Errors are tracked. Health check returns 200.",
    manualTests: ["Sign up and complete core flow on the production URL", "Intentionally trigger an error — it appears in Sentry", "GET /api/health returns 200 with { status: 'ok' }", "No .env secrets visible in public Git repo"],
    receipt: ["Production DB has correct schema and migrations applied", "All env vars set in Replit Deployments secrets", "Sentry DSN connected", "Health check endpoint live"],
  },
];

export function WebAppModeBanner({ visible }) {
  if (!visible) return null;
  return (
    <div className={cn("w-full rounded-xl px-4 py-3 flex items-center gap-3 border", "bg-secondary/8 border-secondary/25")}>
      <span className="text-2xl shrink-0">⚡</span>
      <div>
        <p className="text-xs font-semibold text-secondary">Web App Mode activated</p>
        <p className="text-xs text-subtle mt-0.5">
          Your SPEC.md will include a full database schema and authentication flow. Build auth before any user data.
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// Shared utility — resolves the active mode from an idea string
// ===========================================================================
export function detectMode(ideaText) {
  if (!ideaText) return "standard";
  if (detectGameMode(ideaText))   return "game";
  if (detectWebsiteMode(ideaText)) return "website";
  if (detectWebAppMode(ideaText))  return "webapp";
  return "standard";
}
