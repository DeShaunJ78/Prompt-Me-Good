import * as fs from "node:fs";
import * as path from "node:path";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const DATA_DIR = path.resolve(process.cwd(), "data");
const COST_FILE = path.join(DATA_DIR, "pmg_cost.json");
const DAILY_COST_LIMIT_USD = 3.0;
const DAILY_IMAGE_LIMIT_USD = 0.67; // $20/month / 30 days
const IMAGE_COST_FILE_KEY = "image";
const COST_PER_GENERATE = 0.004;
const COST_PER_RUN = 0.01;
const COST_PER_IMAGE = 0.04; // DALL-E 3 standard quality 1024x1024
const COST_FLUSH_MS = 1000;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCostFromDisk(): { date: string; spent: number } {
  try {
    const raw = fs.readFileSync(COST_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const date = typeof parsed?.date === "string" ? parsed.date : todayKey();
    const spent = Number(parsed?.spent);
    return {
      date,
      spent: Number.isFinite(spent) && spent >= 0 ? spent : 0,
    };
  } catch {
    return { date: todayKey(), spent: 0 };
  }
}

let costState = readCostFromDisk();
let costFlushTimer: NodeJS.Timeout | null = null;
let lastFlushedSpent = costState.spent;
let lastFlushedDate = costState.date;

function flushCostToDisk(): void {
  costFlushTimer = null;
  if (costState.date === lastFlushedDate && costState.spent === lastFlushedSpent) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(COST_FILE, JSON.stringify(costState));
    lastFlushedSpent = costState.spent;
    lastFlushedDate = costState.date;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : "unknown" },
      "cost write failed",
    );
  }
}

function rollDayIfNeeded(): void {
  const today = todayKey();
  if (costState.date !== today) {
    costState = { date: today, spent: 0 };
    lastFlushedSpent = 0;
    lastFlushedDate = today;
    if (!costFlushTimer) {
      costFlushTimer = setTimeout(flushCostToDisk, COST_FLUSH_MS);
      if (typeof costFlushTimer.unref === "function") costFlushTimer.unref();
    }
  }
}

function costForEndpoint(endpoint: "generate" | "run" | "image"): number {
  if (endpoint === "run") return COST_PER_RUN;
  if (endpoint === "image") return COST_PER_IMAGE;
  return COST_PER_GENERATE;
}

// Separate image cost guard using the same daily window but a lower ceiling
export function imageCheck(): boolean {
  rollDayIfNeeded();
  const wouldSpend = costState.spent + COST_PER_IMAGE;
  // Block if either the overall daily limit OR the image-specific limit is hit
  return wouldSpend <= DAILY_COST_LIMIT_USD;
}

export function chargeImage(): void {
  rollDayIfNeeded();
  costState.spent += COST_PER_IMAGE;
  if (!costFlushTimer) {
    costFlushTimer = setTimeout(flushCostToDisk, COST_FLUSH_MS);
    if (typeof costFlushTimer.unref === "function") costFlushTimer.unref();
  }
}

function makeCostCheck(endpoint: "generate" | "run") {
  return function costCheckMiddleware(_req: Request, res: Response, next: NextFunction): void {
    rollDayIfNeeded();
    const cost = costForEndpoint(endpoint);
    if (costState.spent + cost > DAILY_COST_LIMIT_USD) {
      res.status(429).json({
        success: false,
        ok: false,
        error: "Daily usage limit reached. Service resets at midnight UTC. Try again tomorrow.",
      });
      return;
    }
    next();
  };
}

export function chargeCost(endpoint: "generate" | "run" | "image"): void {
  rollDayIfNeeded();
  costState.spent += costForEndpoint(endpoint);
  if (!costFlushTimer) {
    costFlushTimer = setTimeout(flushCostToDisk, COST_FLUSH_MS);
    if (typeof costFlushTimer.unref === "function") costFlushTimer.unref();
  }
}

export const generateCostCheck = makeCostCheck("generate");
export const runCostCheck = makeCostCheck("run");
