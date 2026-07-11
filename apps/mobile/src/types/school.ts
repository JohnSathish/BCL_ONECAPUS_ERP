/** Institution entry for universal OneCampus mobile (runtime, not build-time). */
export type SchoolConfig = {
  id: string;
  name: string;
  apiUrl: string;
  /** Sent as X-Tenant-Slug to the ERP API. */
  tenantSlug: string;
  /** Short campus code shown in the picker (falls back to tenantSlug). */
  code?: string;
  privacyPolicyUrl?: string;
  supportEmail?: string;
  logoUrl?: string;
};

export type SchoolRegistryEntry = SchoolConfig & {
  region?: string;
  keywords?: string[];
};
