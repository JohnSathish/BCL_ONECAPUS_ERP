/**
 * Canonical website content catalog for CMS migration / seed.
 * college-web TypeScript seeds are the source template; Prisma is the live source of truth after import.
 */

export type CatalogPage = {
  path: string;
  title: string;
  excerpt?: string;
  bodyHtml: string;
};

export type CatalogMenuNode = {
  label: string;
  url: string;
  children?: CatalogMenuNode[];
};

function page(
  path: string,
  title: string,
  body?: string,
  excerpt?: string,
): CatalogPage {
  const lead =
    excerpt ??
    `${title} at Don Bosco College, Tura — edit this page in the Website CMS.`;
  return {
    path,
    title,
    excerpt: lead,
    bodyHtml:
      body ??
      `<h2>${title}</h2><p>${lead}</p><p>This page was imported from the public website catalogue. Replace this starter copy with approved college content.</p>`,
  };
}

/** All public routes that should appear in CMS Pages after migration. */
export const WEBSITE_PAGE_CATALOG: CatalogPage[] = [
  page(
    '/',
    'Home',
    '<h1>Don Bosco College, Tura</h1><p>Welcome to our official website. Homepage sections are managed in Homepage Builder.</p>',
    'Official website of Don Bosco College, Tura',
  ),
  page('/about', 'About Us'),
  page('/about/history', 'Our Heritage'),
  page(
    '/about/vision-mission',
    'Vision & Mission',
    '<h2>Vision &amp; Mission</h2><p>Edit Vision, Mission and core values from Homepage Builder → Vision &amp; Mission, or refine this page body here.</p>',
  ),
  page(
    '/about/principal',
    "Principal's Desk",
    '<h2>Principal&apos;s Desk</h2><p>The full principal message is also editable from Homepage Builder. Use this page for the dedicated Principal desk layout.</p>',
  ),
  page('/about/administration', 'Administration'),
  page('/departments', 'Departments'),
  page('/academics/programmes', 'Programmes'),
  page('/academics/calendar', 'Academic Calendar'),
  page('/facilities/library', 'Library'),
  page('/facilities/hostel', 'Hostel'),
  page('/admission/apply', 'Apply Online'),
  page('/admission/prospectus', 'Prospectus'),
  page('/admission/eligibility', 'Eligibility'),
  page('/admission/scholarships', 'Scholarships'),
  page('/campus-life/clubs', 'Clubs & Societies'),
  page('/campus-life/nss-ncc', 'NSS & NCC'),
  page('/campus-life/sports', 'Sports'),
  page('/campus-life/alumni', 'Alumni'),
  page('/research/cell', 'Research Cell'),
  page('/research/publications', 'Publications'),
  page('/research/journals', 'Journals'),
  page('/research/innovation', 'Innovation'),
  page('/research/projects', 'Research Projects'),
  page('/iqac', 'IQAC'),
  page('/naac', 'NAAC'),
  page('/news', 'News & Events'),
  page('/gallery', 'Gallery'),
  page('/downloads', 'Downloads'),
  page('/examination', 'Examination'),
  page('/placement', 'Placement'),
  page('/students', 'Student Corner'),
  page('/staff', 'Staff'),
  page('/alumni', 'Alumni'),
  page('/careers', 'Careers'),
  page('/contact', 'Contact Us'),
  page('/privacy', 'Privacy Policy'),
  page('/accessibility', 'Accessibility'),
  page('/search', 'Search'),
  page('/erp', 'ERP Login'),
];

export const HEADER_MENU_CATALOG: CatalogMenuNode[] = [
  {
    label: 'About Us',
    url: '/about',
    children: [
      { label: 'Our Heritage', url: '/about/history' },
      { label: 'Vision & Mission', url: '/about/vision-mission' },
      { label: "Principal's Desk", url: '/about/principal' },
      { label: 'Administration', url: '/about/administration' },
    ],
  },
  {
    label: 'Academics',
    url: '/departments',
    children: [
      { label: 'Departments', url: '/departments' },
      { label: 'Programmes', url: '/academics/programmes' },
      { label: 'Academic Calendar', url: '/academics/calendar' },
      { label: 'Library', url: '/facilities/library' },
    ],
  },
  {
    label: 'Admission',
    url: '/admission/apply',
    children: [
      { label: 'Apply Online', url: '/admission/apply' },
      { label: 'Prospectus', url: '/admission/prospectus' },
      { label: 'Eligibility', url: '/admission/eligibility' },
      { label: 'Scholarships', url: '/admission/scholarships' },
    ],
  },
  {
    label: 'Campus Life',
    url: '/campus-life/clubs',
    children: [
      { label: 'Clubs & Societies', url: '/campus-life/clubs' },
      { label: 'NSS & NCC', url: '/campus-life/nss-ncc' },
      { label: 'Sports', url: '/campus-life/sports' },
      { label: 'Alumni', url: '/campus-life/alumni' },
    ],
  },
  {
    label: 'Research',
    url: '/research/cell',
    children: [
      { label: 'Research Cell', url: '/research/cell' },
      { label: 'Publications', url: '/research/publications' },
      { label: 'Journals', url: '/research/journals' },
      { label: 'Innovation', url: '/research/innovation' },
    ],
  },
];

export const UTILITY_MENU_CATALOG: CatalogMenuNode[] = [
  { label: 'Students', url: '/students' },
  { label: 'Staff', url: '/staff' },
  { label: 'Alumni', url: '/alumni' },
  { label: 'Careers', url: '/careers' },
  { label: 'Contact', url: '/contact' },
];

export const FOOTER_MENU_CATALOG: CatalogMenuNode[] = [
  { label: 'About the College', url: '/about/history' },
  { label: 'Programmes', url: '/academics/programmes' },
  { label: 'Admissions', url: '/admission/apply' },
  { label: 'Research', url: '/research/cell' },
  { label: 'IQAC', url: '/iqac' },
  { label: 'NAAC', url: '/naac' },
  { label: 'Online Admission', url: '/admission/apply' },
  { label: 'Notice Board', url: '/news' },
  { label: 'Downloads', url: '/downloads' },
  { label: 'Contact Us', url: '/contact' },
];

export const NEWS_SEED_CATALOG = [
  {
    title: 'College Week 2026 – In Pursuit of Excellence',
    slug: 'college-week-2026',
    summary: 'A week of culture, sport and fellowship from 10–15 August 2026.',
    body: '<p>College Week brings together students across disciplines for cultural, literary and sporting events.</p>',
    category: 'College Life',
  },
  {
    title: 'Online Admission for UG Programmes',
    slug: 'admissions-open-2026',
    summary: 'Applications are open for the Academic Year 2026–27.',
    body: '<p>Prospective students can now submit applications for undergraduate programmes.</p>',
    category: 'Admissions',
  },
  {
    title: 'Internal Assessment Schedule for Even Semester',
    slug: 'internal-assessment',
    summary:
      'The examination cell has published the latest assessment timetable.',
    body: '<p>Students should contact their departments for subject-specific guidance.</p>',
    category: 'Academic',
  },
];

export const NOTICE_SEED_CATALOG = [
  {
    title: 'UG Admission 2026 Open',
    slug: 'ug-admission-2026-open',
    category: 'ADMISSION',
    priority: 'IMPORTANT',
    bodyHtml:
      '<p>Undergraduate admissions for 2026–27 are open. Apply online.</p>',
  },
  {
    title: 'Internal Assessment Schedule',
    slug: 'internal-assessment-schedule',
    category: 'EXAMINATION',
    priority: 'NORMAL',
    bodyHtml: '<p>The internal assessment schedule has been published.</p>',
  },
  {
    title: 'IQAC Meeting Notice',
    slug: 'iqac-meeting-notice',
    category: 'CIRCULAR',
    priority: 'NORMAL',
    bodyHtml: '<p>IQAC meeting notice for faculty and staff.</p>',
  },
];

export const GALLERY_SEED = [
  {
    src: 'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1200&q=82',
    alt: 'NCC cadets participating in a college programme',
    label: 'NCC',
  },
  {
    src: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=82',
    alt: 'NSS student volunteers serving the community',
    label: 'NSS',
  },
  {
    src: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=82',
    alt: 'Students participating in college sports',
    label: 'Sports',
  },
];

export const HERO_FALLBACK_SLIDES = [
  {
    altText: 'Don Bosco College Tura campus',
    desktopUrl: '/images/campus-hero.webp',
    mobileUrl: '/images/campus-hero-mobile.webp',
  },
  {
    altText: 'Don Bosco College Tura building and grounds',
    desktopUrl: '/images/campus-reference.png',
    mobileUrl: null as string | null,
  },
];

export const CONTENT_TYPE_CATALOG = [
  {
    name: 'News',
    slug: 'news',
    description: 'College news and announcements',
    fields: [
      { key: 'summary', label: 'Summary', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'richText', required: true },
      { key: 'image', label: 'Featured image', type: 'image', required: false },
      { key: 'category', label: 'Category', type: 'text', required: false },
    ],
  },
  {
    name: 'Events',
    slug: 'events',
    description: 'Upcoming and archived college events',
    fields: [
      { key: 'date', label: 'Event date', type: 'date', required: true },
      { key: 'venue', label: 'Venue', type: 'text', required: false },
      { key: 'body', label: 'Body', type: 'richText', required: true },
    ],
  },
  {
    name: 'Testimonials',
    slug: 'testimonials',
    description: 'Student and alumni voices',
    fields: [
      { key: 'quote', label: 'Quote', type: 'richText', required: true },
      { key: 'department', label: 'Department', type: 'text', required: true },
      {
        key: 'graduationYear',
        label: 'Graduation year',
        type: 'text',
        required: true,
      },
      { key: 'status', label: 'Current status', type: 'text', required: false },
      { key: 'photoSrc', label: 'Photo URL', type: 'image', required: false },
    ],
  },
  {
    name: 'Flash News',
    slug: 'flash-news',
    description: 'Short ticker / flash items',
    fields: [
      { key: 'summary', label: 'Summary', type: 'text', required: true },
      { key: 'href', label: 'Link', type: 'text', required: false },
    ],
  },
  {
    name: 'Announcements',
    slug: 'announcements',
    description: 'Campus announcements',
    fields: [
      { key: 'summary', label: 'Summary', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'richText', required: false },
      { key: 'href', label: 'Link', type: 'text', required: false },
    ],
  },
] as const;
