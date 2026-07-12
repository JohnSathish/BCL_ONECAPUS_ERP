import { expect, test } from '@playwright/test';
import { hasE2eCredentials, loginViaUi } from './helpers/auth';

/**
 * Restricted admin user must see Access denied (not a blank page) on a
 * module they cannot open. Override path with E2E_DENIED_PATH (default /admin/students).
 */
test.describe('Admin RBAC smoke', () => {
  test.beforeEach(() => {
    test.skip(!hasE2eCredentials(), 'Set E2E_RESTRICTED_EMAIL / E2E_RESTRICTED_PASSWORD to run');
  });

  test('denied admin module shows Access denied UI', async ({ page }) => {
    await loginViaUi(page);

    const deniedPath = process.env.E2E_DENIED_PATH?.trim() || '/admin/students';
    await page.goto(deniedPath);

    const denyHeading = page.getByRole('heading', { name: /access denied/i });
    const denyPanel = page.getByRole('alert').filter({ hasText: /access denied|permission/i });

    await expect(denyHeading.or(denyPanel).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
