export type CareersPortalExtras = {
  principalName?: string;
  principalTitle?: string;
  principalMessage?: string;
  principalPhotoUrl?: string;
  heroImages?: string[];
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
