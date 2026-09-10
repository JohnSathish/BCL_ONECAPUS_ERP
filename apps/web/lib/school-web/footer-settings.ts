export type SchoolFooterSettings = {
  visitorCounterEnabled: boolean;
  visitorCounterLabel: string;
  visitorTimeoutMinutes: number;
  visitorAnalyticsEnabled: boolean;
  visitorRetentionDays: number;
  showDeveloperCredit: boolean;
  developerCreditText: string;
  developerUrl: string;
};

export const DEFAULT_SCHOOL_FOOTER_SETTINGS: SchoolFooterSettings = {
  visitorCounterEnabled: true,
  visitorCounterLabel: 'Visitors Online',
  visitorTimeoutMinutes: 10,
  visitorAnalyticsEnabled: true,
  visitorRetentionDays: 365,
  showDeveloperCredit: true,
  developerCreditText: 'Powered by BaseCode Labs Pvt. Ltd.',
  developerUrl: 'https://basecodelabs.com/',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function schoolFooterSettings(extrasJson: unknown): SchoolFooterSettings {
  const footer = asRecord(asRecord(extrasJson).footer);
  const timeout = Number(footer.visitorTimeoutMinutes);
  const retention = Number(footer.visitorRetentionDays);
  const url = String(footer.developerUrl || DEFAULT_SCHOOL_FOOTER_SETTINGS.developerUrl).trim();
  const credit = String(footer.developerCreditText || '').trim();
  return {
    visitorCounterEnabled: footer.visitorCounterEnabled !== false,
    visitorCounterLabel:
      String(
        footer.visitorCounterLabel || DEFAULT_SCHOOL_FOOTER_SETTINGS.visitorCounterLabel,
      ).trim() || DEFAULT_SCHOOL_FOOTER_SETTINGS.visitorCounterLabel,
    visitorTimeoutMinutes: Number.isFinite(timeout)
      ? Math.min(30, Math.max(5, Math.round(timeout)))
      : 10,
    visitorAnalyticsEnabled: footer.visitorAnalyticsEnabled !== false,
    visitorRetentionDays: Number.isFinite(retention)
      ? Math.min(1825, Math.max(30, Math.round(retention)))
      : 365,
    showDeveloperCredit: footer.showDeveloperCredit !== false,
    developerCreditText: credit || DEFAULT_SCHOOL_FOOTER_SETTINGS.developerCreditText,
    developerUrl: /^https?:\/\//i.test(url) ? url : DEFAULT_SCHOOL_FOOTER_SETTINGS.developerUrl,
  };
}
