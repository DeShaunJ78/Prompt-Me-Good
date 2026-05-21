# CodeMeGood

> **You bring the vision. We bring the plan. The rest is history.**

CodeMeGood is a structured build companion for vibe-coders — people who have great ideas but need a clear, actionable plan before they start building. It guides you through a structured planning flow that produces a full Spec Pack (spec, user stories, test cases, a to-do list, and a live prototype) in under 10 minutes. Stop winging it and start shipping with intention.

---

## Builder Modes

| Mode | Description |
|------|-------------|
| 🧠 **Architect** | The core intake flow. Answer targeted questions and get a full Spec Pack for your project. |
| ➕ **Feature Builder** | Add a new feature to an existing project. Describe what you want to add and get a structured feature spec. |
| 🚀 **Launch Coach** | Generate a go-to-market plan for your project — SEO copy, landing page structure, launch checklist. |
| 🐛 **Debugger** | Paste an error message and get a plain-English explanation plus a step-by-step fix. |
| 📂 **Repo Doctor** | Upload your project zip and get a full code audit — structure, issues, and recommended improvements. |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, Tailwind CSS v4 |
| **Routing** | Wouter |
| **Backend** | Node.js, Express |
| **ORM** | Drizzle ORM |
| **Database** | PostgreSQL |
| **Auth** | Clerk |
| **Package Manager** | pnpm (monorepo workspace) |
| **Build** | esbuild (API), Vite (frontend) |

---

## Project Structure

```
/
├── artifacts/
│   ├── project-brain/   # React + Vite frontend
│   └── api-server/      # Express API backend
├── lib/
│   └── db/              # Drizzle schema + migrations
├── pnpm-workspace.yaml
└── package.json
```

---

## Running Locally

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database

### Setup

```bash
# Install dependencies
pnpm install

# Push the database schema
cd lib/db && pnpm push

# Run the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Run the frontend (separate terminal)
pnpm --filter @workspace/project-brain run dev
```

---

## Environment Variables

Create a `.env` file in `artifacts/api-server/` with the following variables (values not included — set these yourself):

```
DATABASE_URL
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY
OPENAI_API_KEY
```

Create a `.env` file in `artifacts/project-brain/` with:

```
VITE_CLERK_PUBLISHABLE_KEY
VITE_API_URL
```

---

## License

Private — all rights reserved.
