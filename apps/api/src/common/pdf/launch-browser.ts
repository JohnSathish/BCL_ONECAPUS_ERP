import { existsSync } from 'fs';
import puppeteer, { type Browser } from 'puppeteer';

function resolveChromePath(): string | undefined {
  const fromEnv =
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim() ||
    process.env.CHROME_BIN?.trim() ||
    process.env.CHROMIUM_PATH?.trim();
  if (fromEnv) return fromEnv;

  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];
  return candidates.find((path) => existsSync(path));
}

/**
 * Launch headless Chrome for PDF rendering.
 * Production Docker uses system Chromium (`PUPPETEER_EXECUTABLE_PATH`).
 */
export async function launchPdfBrowser(): Promise<Browser> {
  const executablePath = resolveChromePath();

  return puppeteer.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  });
}
