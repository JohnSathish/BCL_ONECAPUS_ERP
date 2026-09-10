export const SCHOOL_SIS_PRODUCT = 'SECONDARY_SIS';
/** Official St. Luke's Higher Secondary School emblem (public Next.js asset). */
export const SCHOOL_SIS_LOGO_SRC = '/school-sis/st-lukes-logo.png';
export type SchoolProduct = 'KG_ADMISSIONS' | 'SECONDARY_SIS';

export function getSchoolProduct(
  extras?: {
    institutionType?: string;
    schoolProduct?: string;
  } | null,
): SchoolProduct {
  if (extras?.schoolProduct === SCHOOL_SIS_PRODUCT) return 'SECONDARY_SIS';
  return 'KG_ADMISSIONS';
}

export function isSecondarySchoolSisSession(input?: {
  tenantSlug?: string | null;
  hostname?: string | null;
  extras?: { schoolProduct?: string } | null;
}): boolean {
  if (input?.extras?.schoolProduct === SCHOOL_SIS_PRODUCT) return true;
  if (input?.tenantSlug === 'st-lukes-tura') return true;
  const host = (input?.hostname ?? '').split(':')[0]?.toLowerCase() ?? '';
  return host === 'sls.localhost' || host === 'erp.stlukestura.in';
}

/** Display-only login hero while `/v1/auth/context` is loading or unavailable. */
export function getSecondarySisLoginHeroFallback(): {
  tenantSlug: 'st-lukes-tura';
  institution: {
    displayName: string;
    shortName: string;
    campusName: string;
    portalSubtitle: string;
    address: string;
    logoUrl: string;
    faviconUrl: string;
    badges: string[];
  };
  theme: { primaryColor: string; accentColor: string; sidebarColor: string };
  loginBackgroundStyle: 'gradient';
  showPoweredBy: true;
  brandingEnabled: true;
  productName: string;
  productTagline: string;
  institutionType: 'SCHOOL';
  schoolProduct: 'SECONDARY_SIS';
} {
  return {
    tenantSlug: 'st-lukes-tura',
    institution: {
      displayName: "St. Luke's Secondary School, Tura",
      shortName: 'SLS Tura',
      campusName: 'Walbakgre, Tura, West Garo Hills, Meghalaya',
      portalSubtitle: 'School ERP',
      address: 'Walbakgre, Tura - 794101, West Garo Hills, Meghalaya',
      logoUrl: SCHOOL_SIS_LOGO_SRC,
      faviconUrl: SCHOOL_SIS_LOGO_SRC,
      badges: ['Secondary School, Tura'],
    },
    theme: { primaryColor: '#1a365d', accentColor: '#c5a572', sidebarColor: '#12263f' },
    loginBackgroundStyle: 'gradient',
    showPoweredBy: true,
    brandingEnabled: true,
    productName: "St. Luke's School ERP",
    productTagline: 'Knowledge · Service · Light',
    institutionType: 'SCHOOL',
    schoolProduct: 'SECONDARY_SIS',
  };
}
