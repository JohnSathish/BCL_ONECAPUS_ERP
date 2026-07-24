/**
 * Canonical homepage section registry for Website CMS.
 * college-web and admin must stay in sync with these keys.
 *
 * Order matches the public homepage composition.
 * `upcomingEvents` is kept as a registry key for payload hydration only —
 * the visible UI lives beside Principal's Message (not as a second block).
 */
export const HOMEPAGE_SECTION_KEYS = [
  'hero',
  'statistics',
  'aboutCollege',
  'principalMessage',
  'upcomingEvents',
  'noticeBoard',
  'departments',
  'programmes',
  'campusLife',
  'studentSupport',
  'shortTermCourses',
  'news',
  'gallery',
  'coatOfArms',
  'researchLinks',
  'testimonials',
  'placement',
  'footer',
] as const;

export type HomepageSectionKey = (typeof HOMEPAGE_SECTION_KEYS)[number];

export const HOMEPAGE_SECTION_CATALOG: Array<{
  key: HomepageSectionKey;
  label: string;
  description: string;
  defaultEnabled: boolean;
}> = [
  {
    key: 'hero',
    label: 'Hero',
    description: 'Homepage hero slider',
    defaultEnabled: true,
  },
  {
    key: 'statistics',
    label: 'Statistics',
    description: 'Quick institutional stats',
    defaultEnabled: false,
  },
  {
    key: 'aboutCollege',
    label: 'About College',
    description: 'About / heritage block (above Principal)',
    defaultEnabled: true,
  },
  {
    key: 'principalMessage',
    label: "Principal's Message",
    description: "Principal's desk with Upcoming Events beside it",
    defaultEnabled: true,
  },
  {
    key: 'upcomingEvents',
    label: 'Upcoming Events (legacy slot)',
    description:
      'Do not enable as a standalone block — events render beside Principal. Kept for calendar payload only.',
    defaultEnabled: false,
  },
  {
    key: 'noticeBoard',
    label: 'Notice Board',
    description: 'Latest published notices',
    defaultEnabled: true,
  },
  {
    key: 'departments',
    label: 'Departments',
    description: 'Department showcase',
    defaultEnabled: true,
  },
  {
    key: 'programmes',
    label: 'Programmes',
    description: 'Programme highlights',
    defaultEnabled: false,
  },
  {
    key: 'campusLife',
    label: 'Why Choose Us',
    description: 'Why choose us / campus reasons section',
    defaultEnabled: true,
  },
  {
    key: 'studentSupport',
    label: 'Student Support & Activities',
    description: 'Grievance, anti-ragging, ICC, clubs, NSS and NCC cards',
    defaultEnabled: true,
  },
  {
    key: 'shortTermCourses',
    label: 'Short Term Courses',
    description:
      'Certificate and skill courses such as CAFA, BCCS, ELPC, BCCH and Tally',
    defaultEnabled: true,
  },
  {
    key: 'news',
    label: 'News',
    description: 'Latest news cards',
    defaultEnabled: true,
  },
  {
    key: 'gallery',
    label: 'Gallery',
    description: 'Photo gallery strip',
    defaultEnabled: true,
  },
  {
    key: 'coatOfArms',
    label: 'Coat of Arms',
    description: 'College emblem / heritage mark',
    defaultEnabled: true,
  },
  {
    key: 'researchLinks',
    label: 'Research & Links',
    description: 'Research cell, journals, IQAC and important links',
    defaultEnabled: true,
  },
  {
    key: 'testimonials',
    label: 'Testimonials',
    description: 'Student/alumni voices',
    defaultEnabled: true,
  },
  {
    key: 'placement',
    label: 'Sister Institutions',
    description: 'Sister concerns / institutions — logos with optional URLs',
    defaultEnabled: true,
  },
  {
    key: 'footer',
    label: 'Footer',
    description: 'Site footer widgets',
    defaultEnabled: true,
  },
];

export const PAGE_BLOCK_TYPES = [
  'HERO',
  'RICH_TEXT',
  'CARDS',
  'GALLERY',
  'ACCORDION',
  'TABLE',
  'BUTTON',
  'YOUTUBE',
  'PDF',
  'NEWS',
  'EVENTS',
  'CTA',
  'CONTACT',
  'CUSTOM_HTML',
] as const;

export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];

export const NOTICE_CATEGORIES = [
  'ADMISSION',
  'EXAMINATION',
  'ACADEMIC',
  'CIRCULAR',
  'HOLIDAY',
  'TENDER',
  'RECRUITMENT',
  'SCHOLARSHIP',
  'GENERAL',
] as const;

export const NOTICE_PRIORITIES = ['URGENT', 'IMPORTANT', 'NORMAL'] as const;

/**
 * Per-tenant content source configuration stored in WebsiteSite.settingsJson.sources
 */
export type WebsiteContentSources = {
  departments: { mode: 'MANUAL' | 'ERP'; adapter?: 'department' };
  faculty: { mode: 'MANUAL' | 'ERP'; adapter?: 'staff' };
  programmes: { mode: 'MANUAL' | 'ERP'; adapter?: 'programme' };
  upcomingEvents: { mode: 'ERP'; adapter: 'academicCalendar' };
  noticeBoard: { mode: 'MANUAL' };
  news: { mode: 'MANUAL' };
};

export const DEFAULT_CONTENT_SOURCES: WebsiteContentSources = {
  departments: { mode: 'ERP', adapter: 'department' },
  faculty: { mode: 'ERP', adapter: 'staff' },
  programmes: { mode: 'ERP', adapter: 'programme' },
  upcomingEvents: { mode: 'ERP', adapter: 'academicCalendar' },
  noticeBoard: { mode: 'MANUAL' },
  news: { mode: 'MANUAL' },
};
