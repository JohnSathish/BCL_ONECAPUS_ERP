import { expect, type Page } from '@playwright/test';

/** Parse login human-verification equation (e.g. "3 + 2", "7 − 1", "4 × 3"). */
export function solveChallengeExpression(text: string): number {
  const normalized = text
    .replace(/[=\s]/g, ' ')
    .replace(/[×xX]/g, '*')
    .replace(/[−–—]/g, '-')
    .trim();
  const match = normalized.match(/(-?\d+)\s*([+\-*])\s*(-?\d+)/);
  if (!match) {
    throw new Error(`Could not parse verification equation: ${text}`);
  }
  const a = Number(match[1]);
  const b = Number(match[3]);
  const op = match[2];
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  return a * b;
}

export function hasE2eCredentials(): boolean {
  return Boolean(
    process.env.E2E_RESTRICTED_EMAIL?.trim() && process.env.E2E_RESTRICTED_PASSWORD?.trim(),
  );
}

export async function loginViaUi(
  page: Page,
  opts?: { email?: string; password?: string },
): Promise<void> {
  const email = opts?.email ?? process.env.E2E_RESTRICTED_EMAIL?.trim();
  const password = opts?.password ?? process.env.E2E_RESTRICTED_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error('E2E_RESTRICTED_EMAIL and E2E_RESTRICTED_PASSWORD are required');
  }

  await page.goto('/login');
  await expect(page.locator('#identifier')).toBeVisible({ timeout: 30_000 });
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill(password);

  const equation = page.locator('.login-verification-equation');
  await expect(equation).toContainText(/\d/, { timeout: 30_000 });
  const answer = solveChallengeExpression(await equation.innerText());
  await page.locator('#challengeAnswer').fill(String(answer));

  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45_000 });
}
