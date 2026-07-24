import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('homepage presents core public content', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: /Don Bosco College, Tura/i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Admissions open 2026/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Principal's Message/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Read full message/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Upcoming Events/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Notice Board/i })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Inspired by the Vision of St\. John Bosco/i }),
  ).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.locator('footer').getByRole('heading', { name: /Quick links/i })).toBeVisible();
  await expect(
    page.locator('footer').getByRole('link', { name: /BaseCode Labs Pvt\. Ltd/i }),
  ).toBeVisible();
  await expect(page.locator('footer').getByText(/Visitors/i)).toBeVisible();
});

test('critical pages have no serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? ''),
    ),
  ).toEqual([]);
});

test('mobile drawer opens and navigates', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only behaviour');
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const drawer = page.getByRole('complementary', { name: 'Mobile navigation' });
  await expect(drawer).toBeVisible();
  const academics = drawer.getByText('Academics', { exact: true });
  await academics.evaluate((element) => (element as HTMLButtonElement).click());
  const programmes = drawer.getByRole('link', { name: 'Programmes' });
  await expect(programmes).toBeVisible();
  await programmes.evaluate((element) => (element as HTMLAnchorElement).click());
  await expect(page).toHaveURL(/academics\/programmes/);
});

test('contact form reports unconfigured delivery clearly', async ({ page }) => {
  await page.goto('/contact');
  await page.getByLabel('Full Name').fill('Test Visitor');
  await page.getByLabel('Email Address').fill('visitor@example.com');
  await page.getByLabel('Subject').selectOption('Campus visit');
  await page.getByLabel('Message').fill('I would like to arrange a visit to the campus.');
  await page.getByRole('button', { name: /Send Message/i }).click();
  await expect(
    page.getByText('Online message delivery is not configured. Please email the college directly.'),
  ).toBeVisible();
});
