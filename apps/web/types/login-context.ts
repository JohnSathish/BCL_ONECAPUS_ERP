export type LoginContext = {
  tenantSlug: string;
  institution: {
    displayName: string;
    shortName?: string;
    campusName?: string;
    portalSubtitle?: string;
    address?: string;
    logoUrl?: string;
    faviconUrl?: string;
    badges?: string[];
  };
  theme?: {
    primaryColor?: string;
    accentColor?: string;
    sidebarColor?: string;
  };
  loginBackgroundStyle: 'gradient' | 'solid' | 'mesh';
  showPoweredBy: boolean;
  brandingEnabled: boolean;
  productName?: string;
  productTagline?: string;
  poweredByText?: string;
  /** @deprecated Prefer poweredByText */
  poweredBy?: string;
  loginMethods?: {
    allowBiometricLogin: boolean;
    allowQrLogin: boolean;
    allowRfidLogin: boolean;
  };
};

export type LoginChallenge = {
  token: string;
  expression: string;
};
