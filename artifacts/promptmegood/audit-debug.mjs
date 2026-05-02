import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  bypassCSP: true,
  serviceWorkers: 'block',
});
const page = await ctx.newPage();
await page.route('**/*', route => {
  const headers = { ...route.request().headers(), 'cache-control': 'no-cache, no-store' };
  route.continue({ headers });
});
const consoleLogs = [];
page.on('console', m => consoleLogs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => consoleLogs.push(`[err] ${e}`));
page.on('requestfailed', r => consoleLogs.push(`[req-failed] ${r.url()} ${r.failure()?.errorText}`));

await page.goto('http://localhost:80/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);

const diag = await page.evaluate(() => ({
  t24Init: window.__pmgT24Init,
  t24InitCalled: window.__pmgT24InitCalled,
  t24DidStyles: window.__pmgT24DidStyles,
  t24DidConfirm: window.__pmgT24DidConfirm,
  t24DidEyebrow: window.__pmgT24DidEyebrow,
  t24Error: window.__pmgT24Error,
  resultBoxExists: !!document.getElementById('resultBox'),
  dashboardExists: !!document.getElementById('dashboard'),
  confirmExists: !!document.getElementById('pmg-result-confirm'),
  eyebrowExists: !!document.getElementById('pmg-workspace-eyebrow'),
  styleTagExists: !!document.getElementById('pmg-t24-audit-pass-style'),
  pmgUxScriptSrc: Array.from(document.scripts).map(s => s.src).filter(s => s.includes('pmg-ux')),
}));

console.log('=== DIAG ===');
console.log(JSON.stringify(diag, null, 2));
console.log('=== Console ===');
consoleLogs.slice(-20).forEach(l => console.log(l));

await browser.close();
