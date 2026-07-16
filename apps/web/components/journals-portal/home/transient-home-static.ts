export const HOME_QUICK_ACCESS = [
  {
    href: '/journals-portal/about',
    label: 'About the Journal',
    description: 'Learn more',
    icon: 'BookOpen',
  },
  {
    href: '/journals-portal/author',
    label: 'Submit Paper',
    description: 'Start submission',
    icon: 'Send',
  },
  {
    href: '/journals-portal/archives',
    label: 'Browse Archives',
    description: 'Past volumes',
    icon: 'Library',
  },
  {
    href: '/journals-portal/downloads',
    label: 'Downloads',
    description: 'Forms & guides',
    icon: 'Download',
  },
  {
    href: '/journals-portal/editorial-board',
    label: 'Editorial Board',
    description: 'Meet editors',
    icon: 'Users',
  },
  {
    href: '/journals-portal/contact',
    label: 'Contact Us',
    description: 'Get in touch',
    icon: 'Mail',
  },
] as const;

export const HOME_WHY_PUBLISH = [
  { title: 'Open Access', description: 'Free global readership without paywalls.', icon: 'Globe2' },
  {
    title: 'Peer Reviewed',
    description: 'Rigorous expert evaluation of every manuscript.',
    icon: 'ShieldCheck',
  },
  {
    title: 'Global Reach',
    description: 'Reach scholars across institutions and regions.',
    icon: 'Eye',
  },
  {
    title: 'Timely Publication',
    description: 'Clear editorial timelines and production stages.',
    icon: 'Zap',
  },
  {
    title: 'Ethical Standards',
    description: 'Aligned with responsible publication practice.',
    icon: 'Scale',
  },
  {
    title: 'High Visibility',
    description: 'Discoverable through major scholarly indexes.',
    icon: 'Sparkles',
  },
] as const;

export const HOME_EXTRA_STATS = {
  countries: 18,
  acceptanceRateLabel: '~35%',
  reviewersLabel: 'Board-led',
};

export const HOME_INDEXING = [
  'Google Scholar',
  'Crossref',
  'ROAD',
  'ICI',
  'ResearchBib',
  'OpenAlex',
  'Dimensions',
  'Scilit',
  'DOAJ (Future)',
] as const;

export const HOME_TESTIMONIALS = [
  {
    name: 'Dr. Ananya Deka',
    university: 'Gauhati University',
    country: 'India',
    quote:
      'Transient gave our interdisciplinary work a careful peer-review process and clear production stages—exactly what early-career researchers need.',
  },
  {
    name: 'Prof. Michael R. Chen',
    university: 'Assam Don Bosco University',
    country: 'India',
    quote:
      'The editorial communication was professional and timely. The open-access model helps our findings reach regional practitioners quickly.',
  },
  {
    name: 'Dr. Priya Sangma',
    university: 'NEHU Tura Campus',
    country: 'India',
    quote:
      'A college-published journal with international board members and modern submission tooling—Transient feels serious and welcoming.',
  },
] as const;

export const HOME_FAQ = [
  {
    q: 'How do I submit a manuscript?',
    a: 'Create an author account on this portal, open Author Desk → New submission, upload your manuscript PDF, and submit for editorial screening. Google Forms are no longer used. See Author Guidelines for categories, abstract length, and formatting.',
  },
  {
    q: 'Is Transient peer reviewed?',
    a: 'Yes. Submissions undergo editorial screening followed by expert peer review before acceptance and production.',
  },
  {
    q: 'Are there author publication charges?',
    a: 'The portal does not list hidden APCs. Contact the editorial office if you need confirmation for a specific volume.',
  },
  {
    q: 'Does Transient assign DOIs?',
    a: 'The platform supports DOI-ready workflows and Crossref deposit when journal credentials are configured.',
  },
  {
    q: 'What is the copyright / open-access policy?',
    a: 'Articles are published for open access. See Publication Ethics and Author Guidelines for licensing and author rights details.',
  },
  {
    q: 'How long does review take?',
    a: 'Timelines vary by field and reviewer availability. Authors can track status in the author desk after submission.',
  },
] as const;

export const HOME_FOOTER_INDEXING = ['Google Scholar', 'Crossref', 'ROAD', 'ICI'] as const;
