export const MAX_INPUT_CHARS = 6000;

export function clampString(value: unknown, max = MAX_INPUT_CHARS): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

const INJECTION_BLOCKLIST = [
  "ignore previous instructions",
  "ignore all previous instructions",
  "disregard your instructions",
  "disregard all instructions",
  "you are now",
  "forget everything",
  "forget all previous",
];

export function sanitizeGoal(
  goal: string,
): { ok: true } | { ok: false; status: number; error: string } {
  const lower = goal.toLowerCase();
  if (INJECTION_BLOCKLIST.some((phrase) => lower.includes(phrase))) {
    return { ok: false, status: 400, error: "Invalid input detected." };
  }
  return { ok: true };
}
