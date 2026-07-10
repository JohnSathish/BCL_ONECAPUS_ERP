import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import QRCode from 'qrcode';

export const BCL_COMPANY = {
  name: 'BaseCode Labs Pvt. Ltd.',
  tagline: 'Your Technology Growth Partner',
  email: 'contact@basecodelabs.com',
  phone: '+91 95663 63655',
  website: 'https://basecodelabs.com',
  websiteLabel: 'basecodelabs.com',
} as const;

let cachedLogoDataUri: string | null | undefined;
let cachedInstitutionLogoDataUri: string | null | undefined;
let cachedWebsiteQrCodeDataUri: string | null | undefined;
let cachedCoverCompositeDataUri: string | null | undefined;
let cachedPrincipalDashboardDataUri: string | null | undefined;

function resolveAssetDataUri(
  fileName: string,
  cache: { value: string | null | undefined },
): string | null {
  if (cache.value !== undefined) return cache.value ?? null;
  // Prefer src assets over dist so transparent logo updates are picked up
  // even when dist copies are stale/empty.
  const candidates = [
    join(process.cwd(), 'src', 'modules', 'proposals', 'assets', fileName),
    join(__dirname, '..', 'assets', fileName),
    join(process.cwd(), 'dist', 'modules', 'proposals', 'assets', fileName),
  ];
  for (const assetPath of candidates) {
    if (!existsSync(assetPath)) continue;
    try {
      const buffer = readFileSync(assetPath);
      if (!buffer.length) continue;
      const ext = fileName.toLowerCase().endsWith('.jpg') ? 'jpeg' : 'png';
      cache.value = `data:image/${ext};base64,${buffer.toString('base64')}`;
      return cache.value ?? null;
    } catch {
      // try next candidate
    }
  }
  cache.value = null;
  return cache.value ?? null;
}

export function resolveBclLogoDataUri(): string | null {
  return resolveAssetDataUri('bcl-logo-official.png', {
    get value() {
      return cachedLogoDataUri;
    },
    set value(v: string | null | undefined) {
      cachedLogoDataUri = v;
    },
  });
}

export function resolveInstitutionLogoDataUri(): string | null {
  return resolveAssetDataUri('don-bosco-college-tura.png', {
    get value() {
      return cachedInstitutionLogoDataUri;
    },
    set value(v: string | null | undefined) {
      cachedInstitutionLogoDataUri = v;
    },
  });
}

export function resolveCoverCompositeDataUri(): string | null {
  return resolveAssetDataUri('cover-dashboard-mobile-composite.png', {
    get value() {
      return cachedCoverCompositeDataUri;
    },
    set value(v: string | null | undefined) {
      cachedCoverCompositeDataUri = v;
    },
  });
}

export function resolvePrincipalDashboardDataUri(): string | null {
  return resolveAssetDataUri('principal-dashboard-screenshot.png', {
    get value() {
      return cachedPrincipalDashboardDataUri;
    },
    set value(v: string | null | undefined) {
      cachedPrincipalDashboardDataUri = v;
    },
  });
}

export async function generateWebsiteQrCodeDataUri(
  url: string,
): Promise<string | null> {
  if (cachedWebsiteQrCodeDataUri !== undefined)
    return cachedWebsiteQrCodeDataUri;
  try {
    cachedWebsiteQrCodeDataUri = await QRCode.toDataURL(url, {
      margin: 1,
      width: 196,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return cachedWebsiteQrCodeDataUri ?? null;
  } catch {
    cachedWebsiteQrCodeDataUri = null;
    return cachedWebsiteQrCodeDataUri;
  }
}

export function buildSubscriptionPricing(
  studentStrength: number,
  perStudentRate: number,
) {
  const subscription = studentStrength * perStudentRate;
  return [
    {
      label: `Annual ERP Subscription (₹${perStudentRate.toLocaleString('en-IN')}/student/academic year)`,
      amount: subscription,
    },
    { label: 'Implementation & Onboarding (one-time)', amount: 250000 },
    { label: 'Support & Success Program', amount: 180000 },
  ];
}
