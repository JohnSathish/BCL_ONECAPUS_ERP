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
  poweredBy: 'BCL OneCampus ERP';
};

export type LoginChallenge = {
  token: string;
  expression: string;
};
