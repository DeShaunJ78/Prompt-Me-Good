import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 800 } });
const p = await ctx.newPage();
p.on('console', m => console.log('CON', m.type(), m.text()));
p.on('pageerror', e => console.log('PAGEERR', e.message));
const res = await p.goto('http://localhost:80/app', { waitUntil: 'domcontentloaded', timeout: 15000 });
console.log('status', res?.status());
await p.waitForTimeout(3500);
const probe = await p.evaluate(() => ({
  cmdk: typeof window.__pmgCommandPalette,
  surprise: typeof window.__pmgSurpriseMe,
  ux: typeof window.PMG_UX,
  splash: !!document.getElementById('pmg-splash'),
  splashClass: document.documentElement.className,
  scripts: Array.from(document.scripts).filter(s=>s.src).map(s=>s.src).slice(-10),
  bodyClasses: document.body.className,
}));
console.log(JSON.stringify(probe, null, 2));
await b.close();
