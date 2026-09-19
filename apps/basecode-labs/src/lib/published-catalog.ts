/** Published homepage catalog used when Central SQLite has not been seeded. */

export const FALLBACK_PROJECTS = [
  {
    id: 'salesian-province-guwahati',
    name: 'Salesian Province of Guwahati website & app',
    slug: 'salesian-province-guwahati',
    clientName: 'Salesian Province of Guwahati',
    industry: 'Diocese / Religious',
    services: 'Website redesign, Android application',
    description:
      'Redesigned province website with improved structure and a dedicated mobile application, as described by Vice Provincial Fr. Bivan Rodriques Mukhim.',
    websiteUrl: 'https://donboscoguwahati.org/',
  },
  {
    id: 'dbcte-tura',
    name: 'Don Bosco College of Teacher Education Tura',
    slug: 'dbcte-tura',
    clientName: 'Don Bosco College of Teacher Education Tura',
    industry: 'College',
    services: 'Website',
    description: 'Institution website delivered for DBCTE Tura.',
    websiteUrl: 'https://dbctetura.com/',
  },
  {
    id: 'tura-public-school',
    name: 'Tura Public School website',
    slug: 'tura-public-school',
    clientName: 'Tura Public School',
    industry: 'School',
    services: 'Website',
    description: 'School website for Tura Public School.',
    websiteUrl: 'https://turapublicschool.com/',
  },
  {
    id: 'dbc-hss-tura',
    name: 'Don Bosco College Higher Secondary Section Tura',
    slug: 'dbc-hss-tura',
    clientName: 'Don Bosco College Higher Sec. Section Tura',
    industry: 'Higher Secondary',
    services: 'Website, ongoing updates',
    description: 'Institution website with structured navigation and ongoing updates.',
    websiteUrl: 'https://dbchsstura.in/',
  },
  {
    id: 'pasf-abong-noga-college',
    name: 'PASF Abong Noga College',
    slug: 'pasf-abong-noga-college',
    clientName: 'PASF - Abong Noga College',
    industry: 'College',
    services: 'Website',
    description: 'College website serving students and parents.',
    websiteUrl: 'https://pasfanc.ac.in/',
  },
  {
    id: 'anita-vidyalaya-hss',
    name: 'Anita Vidyalaya Higher Secondary School',
    slug: 'anita-vidyalaya-hss',
    clientName: 'Anita Vidyalaya Higher Secondary School',
    industry: 'School',
    services: 'Website',
    description: 'School website for parents and students, Thannipuzha, Kerala.',
    websiteUrl: 'https://anitavidyalayahss.com/',
  },
];

export const FALLBACK_PRODUCTS = [
  {
    id: 'bcl-onecampus-erp',
    name: 'BCL OneCampus ERP',
    slug: 'bcl-onecampus-erp',
    category: 'ERP',
    description:
      'Complete institution management platform for schools and colleges — students, staff, admissions, academics, attendance, fees, examinations, library, accounts, HR, SMS, portals and mobile apps.',
    featuresJson: JSON.stringify([
      'Student Management',
      'Staff Management',
      'Admissions',
      'Academics',
      'Attendance',
      'Fees',
      'Examination',
      'Library',
      'Accounts',
      'HR',
      'SMS',
      'Mobile Applications',
    ]),
  },
  {
    id: 'web-solutions',
    name: 'Web Solutions',
    slug: 'web-solutions',
    category: 'Website',
    description:
      'Corporate, school and college websites plus web applications — designed, hosted and maintained for institutions that need a lasting digital presence.',
    featuresJson: JSON.stringify([
      'Corporate websites',
      'School websites',
      'College websites',
      'E-commerce',
      'Web applications',
    ]),
  },
  {
    id: 'mobile-applications',
    name: 'Mobile Applications',
    slug: 'mobile-applications',
    category: 'Mobile App',
    description:
      'Android, iOS and cross-platform applications for campuses, dioceses and businesses — including parent and staff apps connected to BCL products.',
    featuresJson: JSON.stringify([
      'Android',
      'iOS',
      'Cross-platform',
      'Push notifications',
      'Store publishing',
    ]),
  },
  {
    id: 'gst-billing',
    name: 'BCL GST Billing',
    slug: 'gst-billing',
    category: 'Business Software',
    description: 'Smart GST billing and business management for growing businesses.',
    featuresJson: JSON.stringify(['GST invoices', 'Inventory', 'Reports', 'Multi-user']),
  },
];

export const FALLBACK_SERVICES = [
  { id: 'svc-software', category: 'Software Development', title: 'Custom software and ERP' },
  { id: 'svc-web', category: 'Web', title: 'Institution and corporate websites' },
  { id: 'svc-mobile', category: 'Mobile', title: 'Android and iOS applications' },
  { id: 'svc-infra', category: 'Infrastructure', title: 'Hosting, email and operations' },
  { id: 'svc-digital', category: 'Digital', title: 'Support, training and digital presence' },
];
