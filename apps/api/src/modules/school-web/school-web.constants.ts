export const SCHOOL_WEB_PERMISSION_READ = 'website:read';
export const SCHOOL_WEB_PERMISSION_MANAGE = 'website:manage';
export const SCHOOL_WEB_PERMISSION_PUBLISH = 'website:publish';
export const SCHOOL_WEB_PERMISSION_MEDIA = 'website:media';
export const SCHOOL_WEB_PERMISSION_ENQUIRIES = 'website:enquiries';
export const SCHOOL_WEB_HERO_SLIDE_MAX = 15;
export const SCHOOL_WEB_FLASH_NEWS_MAX = 24;

/** Apex/public hosts that must not be ERP login domains. */
export const SCHOOL_WEB_PUBLIC_HOST_SLUGS: Record<string, string> = {
  'stlukestura.in': 'st-lukes-tura',
  'www.stlukestura.in': 'st-lukes-tura',
  'school.localhost': 'st-lukes-tura',
};

export const SCHOOL_WEB_MENU_LOCATIONS = ['MAIN', 'FOOTER', 'QUICK'] as const;
