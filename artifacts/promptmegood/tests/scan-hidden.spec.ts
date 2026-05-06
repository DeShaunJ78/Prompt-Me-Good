import { test } from '@playwright/test';

test('scan hidden focusable controls', async ({ browser }) => {
  const scanFn = () => {
    return [...document.querySelectorAll('a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"]), [role="button"], [contenteditable="true"]')]
      .filter(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.getAttribute('tabindex') !== '-1')
      .filter(el => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return (r.width === 0 || r.height === 0 || cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null)
          && !el.closest('[hidden]')
          && !el.closest('[inert]');
      })
      .map(el => {
        const p = el.parentElement;
        const gp = p ? p.parentElement : null;
        return [
          el.tagName,
          el.id || '-',
          (typeof el.className === 'string' ? el.className : '').substring(0, 60),
          el.textContent!.trim().substring(0, 30),
          p ? (p.id || '-') : '-',
          p ? (typeof p.className === 'string' ? p.className : '').substring(0, 40) : '-',
          gp ? (gp.id || '-') : '-',
        ].join('\t');
      });
  };

  const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dPage = await dCtx.newPage();
  await dPage.goto('/app', { waitUntil: 'networkidle', timeout: 30000 });
  await dPage.waitForTimeout(3000);
  const dResults = await dPage.evaluate(scanFn);
  console.log('=== DESKTOP (' + dResults.length + ') ===');
  dResults.forEach((r: string, i: number) => console.log('D' + i + '\t' + r));
  await dCtx.close();

  const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mPage = await mCtx.newPage();
  await mPage.goto('/app', { waitUntil: 'networkidle', timeout: 30000 });
  await mPage.waitForTimeout(3000);
  const mResults = await mPage.evaluate(scanFn);
  console.log('=== MOBILE (' + mResults.length + ') ===');
  mResults.forEach((r: string, i: number) => console.log('M' + i + '\t' + r));
  await mCtx.close();
});
