export type ProposalPricingLine = {
  label: string;
  amount: number;
};

export type ProposalSectionToggle = {
  key: string;
  enabled: boolean;
};

export type ProposalCustomization = {
  institutionName?: string;
  logoUrl?: string;
  proposalVersion?: string;
  proposalDate?: string;
  studentStrength?: number;
  perStudentSubscriptionRate?: number;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine?: string;
  primaryColor?: string;
  secondaryColor?: string;
  proposalTheme?: string;
  backgroundImageUrl?: string;
  dashboardScreenshotUrl?: string;
  mobileScreenshotUrl?: string;
  signatureUrl?: string;
  qrCodeUrl?: string;
  pricingLines?: ProposalPricingLine[];
  sectionToggles?: ProposalSectionToggle[];
  copyOverrides?: Record<string, string>;
};

export type ProposalDefaults = {
  institutionName: string;
  proposalVersion: string;
  studentStrength: number;
  perStudentSubscriptionRate: number;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
  primaryColor?: string;
  secondaryColor?: string;
  pricingLines?: ProposalPricingLine[];
  sectionKeys?: Array<{ key: string; label: string }>;
};

export type ProposalPreset = {
  id: string;
  tenantId: string;
  name: string;
  data: ProposalCustomization;
  createdAt: string;
  updatedAt: string;
};
