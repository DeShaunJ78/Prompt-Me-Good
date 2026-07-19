/* One-command hero-demo refresh (Task: hero clip can never silently drift).
 *
 * Runs the Playwright recording (scripts/record-hero-demo.mjs) and then the
 * canonical ffmpeg encode pipeline, writing all three landing-page assets
 * into public/assets/:
 *   - hero-demo.mp4         (h264, crf 28, faststart)
 *   - hero-demo.webm        (vp9, crf 40)
 *   - hero-demo-poster.jpg  (last frame of the encoded mp4)
 *
 * Encode contract (the single source of truth — do NOT re-derive from chat):
 *   - trim the first 3 seconds (page settle / mounter noise)
 *   - speed up 1.25x (setpts=PTS/1.25), no audio
 *
 * Usage: pnpm --filter @workspace/promptmegood run refresh-hero-demo
 * Requires the app (localhost:80) + API to be running; the recording hits
 * the real /api/generate endpoint (one cheap model call).
 * Override the target app with PMG_BASE_URL.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, statSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // artifacts/promptmegood
const RAW_DIR = "/tmp/pmg-hero-demo";
const OUT_DIR = join(ROOT, "public", "assets");

const TRIM_SECONDS = "3";
const SPEED_FILTER = "setpts=PTS/1.25";

function run(cmd, args) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit" });
}

// 1. Record a fresh raw clip.
run("node", [join(ROOT, "scripts", "record-hero-demo.mjs")]);

// 2. Pick the newest raw webm Playwright just wrote.
const raw = readdirSync(RAW_DIR)
  .filter((f) => f.endsWith(".webm"))
  .map((f) => join(RAW_DIR, f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
if (!raw) {
  console.error(`No .webm recording found in ${RAW_DIR}`);
  process.exit(1);
}
console.log(`\nRaw recording: ${raw}`);
mkdirSync(OUT_DIR, { recursive: true });

const mp4 = join(OUT_DIR, "hero-demo.mp4");
const webm = join(OUT_DIR, "hero-demo.webm");
const poster = join(OUT_DIR, "hero-demo-poster.jpg");

// 3. Encode mp4 (h264 crf28, trim 3s, 1.25x, faststart, no audio).
run("ffmpeg", [
  "-y", "-ss", TRIM_SECONDS, "-i", raw,
  "-vf", SPEED_FILTER, "-an",
  "-c:v", "libx264", "-crf", "28",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  mp4,
]);

// 4. Encode webm (vp9 crf40, same trim/speed, no audio).
run("ffmpeg", [
  "-y", "-ss", TRIM_SECONDS, "-i", raw,
  "-vf", SPEED_FILTER, "-an",
  "-c:v", "libvpx-vp9", "-crf", "40", "-b:v", "0",
  webm,
]);

// 5. Poster = last frame of the encoded mp4 (matches where the loop ends).
run("ffmpeg", ["-y", "-sseof", "-0.1", "-i", mp4, "-frames:v", "1", "-q:v", "3", "-update", "1", poster]);

console.log("\nDone. Wrote:");
for (const f of [mp4, webm, poster]) {
  console.log(`  ${f} (${(statSync(f).size / 1024).toFixed(0)} KB)`);
}
console.log(
  "\nReminder: index.html references these paths directly — no HTML change needed. " +
    "Run the hero-demo Playwright suite to verify the lazy-load contract still holds.",
);
