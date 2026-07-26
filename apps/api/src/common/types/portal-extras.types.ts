export type CareersPortalExtras = {
  principalName?: string;
  principalTitle?: string;
  principalMessage?: string;
  principalPhotoUrl?: string;
  heroImages?: string[];
  /** Public careers portal WhatsApp support number (e.g. +91 6909722989) */
  whatsappSupport?: string;
};

export type PortalExtrasJson = {
  careersPortal?: CareersPortalExtras;
};

export function parsePortalExtras(value: unknown): PortalExtrasJson {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as PortalExtrasJson;
}

export function mergePortalExtras(
  existing: unknown,
  patch: PortalExtrasJson | undefined,
): PortalExtrasJson {
  if (!patch) return parsePortalExtras(existing);
  const base = parsePortalExtras(existing);
  return {
    ...base,
    careersPortal: {
      ...base.careersPortal,
      ...patch.careersPortal,
    },
  };
}
