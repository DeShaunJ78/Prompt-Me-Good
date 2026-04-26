import { test, expect } from '@playwright/test';
import path from 'path';

test('PromptMeGood App Builder Workflow', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // 1. Visit /
  // Using absolute path to index.html for direct testing
  const filePath = 'file://' + path.resolve('artifacts/promptmegood/index.html');
  await page.goto(filePath);

  // 2. Dismiss onboarding modal if present
  // Based on code: <button class="tour-card-close" type="button" id="tour-skip" ...>×</button>
  const tourSkip = page.locator('#tour-skip');
  if (await tourSkip.isVisible()) {
    await tourSkip.click();
  }

  // 3. Click "Guide Me" button
  await page.click('#guided-mode-btn');

  // 4. In step 1, type goal
  await page.fill('#guided-q-goal', 'I want to grow my dropshipping business and write better email captions');

  // 5. Click Next, leave audience blank, click Next, leave outcome blank, click Next.
  await page.click('#guided-next'); // Step 1 -> 2
  await page.click('#guided-next'); // Step 2 -> 3
  await page.click('#guided-next'); // Step 3 -> 4

  // 6. In step 4, leave constraints blank, click "Done".
  // The button text changes to "Done" on the last step (4)
  const doneBtn = page.locator('#guided-next');
  await expect(doneBtn).toHaveText('Done');
  await doneBtn.click();

  // 7. Verify a toast appears saying "Builder filled"
  // Based on code: showToast('Builder filled. Review and click Generate Prompt.');
  // Usually toast has a class like .toast or .sonner-toast. Looking at index.html styles:
  // .toast { position: fixed; ... }
  const toast = page.locator('.toast');
  await expect(toast).toContainText('Builder filled');

  // 8. Verify the Advanced Options panel (#advanced-options) is now open.
  const advancedOptions = page.locator('#advanced-options');
  await expect(advancedOptions).toHaveAttribute('open', '');

  // 9. Verify that "Suggested" badges appear on Money Mode and Human Voice Mode rows.
  // Code dynamically adds <span class="toggle-suggested-badge">Suggested</span> to the rows.
  const moneyModeRow = page.locator('.toggle-row:has(#moneyMode)');
  const humanVoiceRow = page.locator('.toggle-row:has(#humanTone)');
  
  await expect(moneyModeRow.locator('.toggle-suggested-badge')).toBeVisible();
  await expect(humanVoiceRow.locator('.toggle-suggested-badge')).toBeVisible();

  // 10. Verify the suggestion reason text appears below those toggles.
  // Code adds <div class="toggle-suggestion-reason">...</div>
  await expect(moneyModeRow.locator('.toggle-suggestion-reason')).toBeVisible();
  await expect(humanVoiceRow.locator('.toggle-suggestion-reason')).toBeVisible();

  // 11. Verify the Money Mode and Human Voice Mode checkboxes are now CHECKED.
  await expect(page.locator('#moneyMode')).toBeChecked();
  await expect(page.locator('#humanTone')).toBeChecked();

  // 12. Check the browser console for any JavaScript errors.
  expect(consoleErrors).toEqual([]);

  // 13. Take a screenshot showing the suggested toggles.
  await page.screenshot({ path: 'suggested-toggles.png' });
});
