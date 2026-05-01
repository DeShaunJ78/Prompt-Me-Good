const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  } catch (e) {
    console.error("Failed to launch browser:", e.message);
    process.exit(1);
  }
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 }
  });
  const page = await context.newPage();

  const filePath = 'file://' + path.resolve('artifacts/promptmegood/index.html');
  console.log('Navigating to:', filePath);
  
  await page.goto(filePath);
  await page.waitForLoadState('networkidle');
  console.log('Waiting 2s for dynamic JS injection...');
  await page.waitForTimeout(2000);

  const initialMetrics = await page.evaluate(() => {
    return {
      docW: document.documentElement.scrollWidth,
      htmlClientW: document.documentElement.clientWidth,
      bodyW: document.body.scrollWidth,
      winW: window.innerWidth
    };
  });
  console.log('Initial Metrics:', JSON.stringify(initialMetrics));

  const scanElements = async () => {
    return await page.evaluate(() => {
      const winW = window.innerWidth;
      const offenders = [];
      const all = document.querySelectorAll('*');
      
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        
        // Right edge > winW + 1 OR Left edge < -1
        if (rect.right > winW + 1 || rect.left < -1) {
          const style = window.getComputedStyle(el);
          
          // Exclusion: display:none, visibility:hidden, opacity:0
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
          
          // Exclusion: position:fixed and pointer-events:none
          if (style.position === 'fixed' && style.pointerEvents === 'none') continue;
          
          // Exclusion: any ancestor has computed overflowX in (hidden, clip, auto, scroll)
          let hasOverflowAncestor = false;
          let parent = el.parentElement;
          while (parent) {
            const pStyle = window.getComputedStyle(parent);
            if (['hidden', 'clip', 'auto', 'scroll'].includes(pStyle.overflowX)) {
              hasOverflowAncestor = true;
              break;
            }
            parent = parent.parentElement;
          }
          if (hasOverflowAncestor) continue;
          
          const ancestors = [];
          let p = el.parentElement;
          for (let i = 0; i < 4 && p; i++) {
            ancestors.push((p.tagName + (p.id ? '#' + p.id : '') + (p.className ? '.' + p.className.split(' ').join('.') : '')).slice(0, 50));
            p = p.parentElement;
          }
          
          offenders.push({
            tag: el.tagName,
            id: el.id,
            classNameSnippet: el.className.slice(0, 50),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            top: Math.round(rect.top + window.scrollY),
            roundedTop: Math.round(rect.top + window.scrollY),
            ancestors
          });
        }
      }
      return offenders;
    });
  };

  let allOffenders = new Map();
  const addOffenders = (list) => {
    for (const o of list) {
      const key = `${o.tag}|${o.id}|${o.classNameSnippet}|${o.roundedTop}`;
      if (!allOffenders.has(key)) {
        allOffenders.set(key, o);
      }
    }
  };

  // Initial scan
  addOffenders(await scanElements());

  // Scroll scan
  const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < fullHeight; y += 600) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(200);
    addOffenders(await scanElements());
  }
  
  // Final scan at bottom
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  addOffenders(await scanElements());

  // Screenshots
  const screenshotPoints = [0, 1500, 3000, 5000, 8000];
  for (const y of screenshotPoints) {
    if (y < fullHeight) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(200);
      await page.screenshot({ path: `overflow_scroll_${y}.png`, fullPage: false });
    }
  }
  await page.screenshot({ path: `overflow_bottom_full.png`, fullPage: true });

  const finalMetrics = await page.evaluate(() => {
    return {
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth
    };
  });

  const offendersList = Array.from(allOffenders.values());
  const widest = [...offendersList].sort((a, b) => b.width - a.width).slice(0, 5);
  const top30 = offendersList.slice(0, 30);

  const result = {
    metrics: finalMetrics,
    totalUniqueOffenders: offendersList.length,
    top30,
    widest,
    raw: offendersList
  };

  console.log('---RESULT_START---');
  console.log(JSON.stringify(result, null, 2));
  console.log('---RESULT_END---');

  await browser.close();
})();
