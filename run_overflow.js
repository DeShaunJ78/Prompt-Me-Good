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
  await page.waitForTimeout(3000);

  const scanForOverflow = async () => {
    return await page.evaluate(() => {
      const overflowElements = [];
      const windowWidth = window.innerWidth;
      
      const isClipped = (el) => {
        let parent = el.parentElement;
        while (parent) {
          const style = window.getComputedStyle(parent);
          if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX)) {
             const parentRect = parent.getBoundingClientRect();
             const elRect = el.getBoundingClientRect();
             if (elRect.right <= parentRect.right + 1) {
                 return true;
             }
          }
          parent = parent.parentElement;
        }
        return false;
      };

      const getParentChain = (el, depth = 5) => {
        const chain = [];
        let curr = el.parentElement;
        while (curr && chain.length < depth) {
          chain.push({
            tag: curr.tagName.toLowerCase(),
            id: curr.id,
            className: curr.className.slice(0, 50)
          });
          curr = curr.parentElement;
        }
        return chain;
      };

      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        if (rect.right > windowWidth + 1) {
          if (!isClipped(el)) {
            overflowElements.push({
              tag: el.tagName.toLowerCase(),
              id: el.id,
              className: el.className.slice(0, 50),
              rect: {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height
              },
              parentChain: getParentChain(el)
            });
          }
        }
      }

      return {
        overflowElements,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: windowWidth
      };
    });
  };

  const allFindings = [];
  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  
  for (let offset = 0; offset < totalHeight; offset += 500) {
    await page.evaluate((y) => window.scrollTo(0, y), offset);
    await page.waitForTimeout(500); 
    const result = await scanForOverflow();
    allFindings.push({
      offset,
      ...result
    });
  }

  const uniqueElements = new Map();
  allFindings.forEach(finding => {
    finding.overflowElements.forEach(el => {
      const key = `${el.tag}-${el.id}-${el.className}-${Math.round(el.rect.left)}-${Math.round(el.rect.width)}`;
      if (!uniqueElements.has(key)) {
        uniqueElements.set(key, {
            ...el,
            section: finding.offset < totalHeight * 0.33 ? 'top' : (finding.offset < totalHeight * 0.66 ? 'middle' : 'bottom')
        });
      }
    });
  });

  console.log('--- OVERFLOW FINDINGS ---');
  console.log(JSON.stringify({
    documentScrollWidth: allFindings[0]?.scrollWidth || 0,
    windowInnerWidth: 360,
    uniqueOffendingElements: Array.from(uniqueElements.values())
  }, null, 2));

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'overflow-top.png' });
  await page.evaluate((h) => window.scrollTo(0, h / 2), totalHeight);
  await page.screenshot({ path: 'overflow-middle.png' });
  await page.evaluate((h) => window.scrollTo(0, h), totalHeight);
  await page.screenshot({ path: 'overflow-bottom.png' });

  await browser.close();
})();
