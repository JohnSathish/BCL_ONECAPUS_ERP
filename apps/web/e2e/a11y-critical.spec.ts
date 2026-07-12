import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { hasE2eCredentials, loginViaUi } from './helpers/auth';

test.describe('Critical path accessibility', () => {
  test('login page has no serious or critical axe violations', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#identifier')).toBeVisible({ timeout: 30_000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('authenticated shell has no serious or critical axe violations', async ({ page }) => {
    test.skip(!hasE2eCredentials(), 'Set E2E_RESTRICTED_EMAIL / E2E_RESTRICTED_PASSWORD to run');

    await loginViaUi(page);
    await page.goto(process.env.E2E_A11Y_PATH?.trim() || '/admin');
    await expect(page.locator('body')).toBeVisible();
    // Wait for permission/bootstrap chrome to settle
    await page.waitForTimeout(1500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast']) // theme tokens vary; keep structural a11y gated
      .analyze();

    const blocking = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
