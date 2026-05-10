import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    // Dev-only middleware: rewrite /app and /app/ → /app.html so the dev
    // experience matches production (server.mjs does the same rewrite).
    {
      name: "pmg-app-route-rewrite",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const u = req.url;
          if (!u) return next();
          if (u === "/app" || u === "/app/" || u === "/app/index.html") {
            req.url = "/app.html";
          } else if (u.startsWith("/app?")) {
            req.url = "/app.html" + u.slice("/app".length);
          } else if (u.startsWith("/app/?") || u.startsWith("/app/index.html?")) {
            const qIdx = u.indexOf("?");
            req.url = "/app.html" + u.slice(qIdx);
          }
          next();
        });
      },
    },
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // `main` (index.html) is the marketing landing page. The workstation
        // lives at `app.html` and is served at `/app` by server.mjs.
        main: path.resolve(import.meta.dirname, "index.html"),
        app: path.resolve(import.meta.dirname, "app.html"),
        guide: path.resolve(import.meta.dirname, "guide.html"),
        manual: path.resolve(import.meta.dirname, "manual.html"),
        pricing: path.resolve(import.meta.dirname, "pricing.html"),
        // review.html is a dev-only Code Review page that triggers the
        // /api/review backend endpoint. Removed from the public build
        // (audit brief 12) so curious users / bots cannot trigger it.
        // The file is kept in the repo for local dev use; add it back to
        // `input` temporarily if you need to access it via the dev server.
        privacy: path.resolve(import.meta.dirname, "privacy.html"),
        terms: path.resolve(import.meta.dirname, "terms.html"),
        help: path.resolve(import.meta.dirname, "help.html"),
        contact: path.resolve(import.meta.dirname, "contact.html"),
        notfound: path.resolve(import.meta.dirname, "404.html"),
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
