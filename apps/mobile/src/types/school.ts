/** Institution entry for universal OneCampus mobile (runtime, not build-time). */
export type SchoolConfig = {
  id: string;
  name: string;
  apiUrl: string;
  tenantSlug: string;
  privacyPolicyUrl?: string;
  supportEmail?: string;
  logoUrl?: string;
};

export type SchoolRegistryEntry = SchoolConfig & {
  region?: string;
  keywords?: string[];
};
