export type AdministrationNavItem = {
  label: string;
  href: string;
  slug: string | null;
  description: string;
};

export const ADMINISTRATION_BASE = '/about/administration';

export const ADMINISTRATION_NAV: AdministrationNavItem[] = [
  {
    label: 'Governing Body',
    slug: 'governing-body',
    href: `${ADMINISTRATION_BASE}/governing-body`,
    description: 'Members and structure of the college governing body.',
  },
  {
    label: 'Perspective Plans of DBC',
    slug: 'perspective-plans',
    href: `${ADMINISTRATION_BASE}/perspective-plans`,
    description: 'Strategic and perspective plans guiding college development.',
  },
  {
    label: 'Organogram of DBC',
    slug: 'organogram',
    href: `${ADMINISTRATION_BASE}/organogram`,
    description: 'Organizational structure of Don Bosco College, Tura.',
  },
  {
    label: 'NAAC',
    slug: 'naac',
    href: `${ADMINISTRATION_BASE}/naac`,
    description: 'NAAC accreditation information and related documents.',
  },
  {
    label: 'IQAC',
    slug: 'iqac',
    href: '/iqac',
    description: 'Internal Quality Assurance Cell initiatives and reports.',
  },
  {
    label: 'RUSA',
    slug: 'rusa',
    href: `${ADMINISTRATION_BASE}/rusa`,
    description: 'Rashtriya Uchchatar Shiksha Abhiyan updates and resources.',
  },
  {
    label: 'NIRF',
    slug: 'nirf',
    href: `${ADMINISTRATION_BASE}/nirf`,
    description: 'National Institutional Ranking Framework submissions and data.',
  },
  {
    label: 'AISHE',
    slug: 'aishe',
    href: `${ADMINISTRATION_BASE}/aishe`,
    description: 'All India Survey on Higher Education reporting.',
  },
  {
    label: 'UBA',
    slug: 'uba',
    href: `${ADMINISTRATION_BASE}/uba`,
    description: 'Unnat Bharat Abhiyan community engagement activities.',
  },
  {
    label: 'Grant-in Aid',
    slug: 'grant-in-aid',
    href: `${ADMINISTRATION_BASE}/grant-in-aid`,
    description: 'Grant-in-aid information and related notices.',
  },
  {
    label: 'Feedback',
    slug: 'feedback',
    href: `${ADMINISTRATION_BASE}/feedback`,
    description: 'Stakeholder feedback mechanisms and analysis.',
  },
  {
    label: 'COVID-19 Task Force',
    slug: 'covid-19-task-force',
    href: `${ADMINISTRATION_BASE}/covid-19-task-force`,
    description: 'College COVID-19 task force guidelines and updates.',
  },
  {
    label: 'Committees',
    slug: 'committees',
    href: `${ADMINISTRATION_BASE}/committees`,
    description: 'Statutory and college-level committees.',
  },
  {
    label: 'Annual Magazine',
    slug: 'annual-magazine',
    href: `${ADMINISTRATION_BASE}/annual-magazine`,
    description: 'College annual magazine editions and archives.',
  },
];

export function administrationItemForSlug(slug?: string | null) {
  if (!slug) return null;
  return ADMINISTRATION_NAV.find((item) => item.slug === slug) ?? null;
}

export function isAdministrationPath(path: string) {
  return path === ADMINISTRATION_BASE || path.startsWith(`${ADMINISTRATION_BASE}/`);
}
