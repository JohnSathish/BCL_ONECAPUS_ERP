export type IqacNavItem = {
  label: string;
  href: string;
  slug: string | null;
  description: string;
};

export const IQAC_BASE = '/iqac';

export const IQAC_NAV: IqacNavItem[] = [
  {
    label: 'IQAC',
    slug: null,
    href: IQAC_BASE,
    description:
      'Internal Quality Assurance Cell — vision, functions and quality initiatives at Don Bosco College, Tura.',
  },
  {
    label: 'AQAR',
    slug: 'aqar',
    href: `${IQAC_BASE}/aqar`,
    description: 'Annual Quality Assurance Reports submitted to NAAC.',
  },
  {
    label: 'Members',
    slug: 'members',
    href: `${IQAC_BASE}/members`,
    description: 'IQAC committee composition from college Governance records.',
  },
  {
    label: 'Meetings',
    slug: 'meetings',
    href: `${IQAC_BASE}/meetings`,
    description: 'IQAC meeting notices, agendas and minutes.',
  },
  {
    label: 'Action Report',
    slug: 'action-report',
    href: `${IQAC_BASE}/action-report`,
    description: 'Action taken reports on IQAC recommendations and quality plans.',
  },
];

export function iqacItemForSlug(slug?: string | null) {
  if (!slug) return IQAC_NAV[0] ?? null;
  return IQAC_NAV.find((item) => item.slug === slug) ?? null;
}

export function isIqacPath(path: string) {
  return path === IQAC_BASE || path.startsWith(`${IQAC_BASE}/`);
}
