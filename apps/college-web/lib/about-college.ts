export type AboutStat = {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
};

export type AboutCollegeContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  quote: string;
  quoteAttribution: string;
  portraitSrc: string;
  portraitAlt: string;
  readMoreHref: string;
  tourHref: string;
  stats: AboutStat[];
};

export const seedAboutCollege: AboutCollegeContent = {
  eyebrow: 'About Don Bosco College, Tura',
  title: 'About Don Bosco College, Tura',
  subtitle: 'Inspired by the Vision of St.\u00A0John\u00A0Bosco',
  description: [
    'Saint John Bosco, popularly known as Don Bosco, was a priest of the Catholic Church, who came to the rescue of the poor, disadvantaged youth of his time with his innovative method of educating them through total immersion in their world, with personal involvement in their lives and aspirations, with a dedication that was total.',
    'To ensure that his dedication to their cause shone through his actions, he lived with and for them. He based his education on the three great principles of reason, religion and loving kindness, as a caring father, doing everything possible for their welfare.',
    'The system of education that he envisioned aims to create generations of young men and women who are intellectually competent, morally upright, socially committed, spiritually inspired and devoted to their country and the world. Don Bosco is the founder of the Don Bosco Society, and continues to be our inspiration.',
  ].join('\n\n'),
  quote: 'It is not enough to love the young; they must know that they are loved.',
  quoteAttribution: 'St.\u00A0John\u00A0Bosco',
  portraitSrc: '/images/st-john-bosco.png',
  portraitAlt: 'Portrait of Saint John Bosco',
  readMoreHref: '/about/history',
  tourHref: '/about/history',
  stats: [
    { id: 'founded', label: 'Year Established', value: 1987 },
    { id: 'programmes', label: 'Programmes Offered', value: 15, suffix: '+' },
    { id: 'students', label: 'Students', value: 3100, suffix: '+' },
    { id: 'faculty', label: 'Faculty Members', value: 140, suffix: '+' },
    { id: 'departments', label: 'Departments', value: 15 },
    { id: 'naac', label: 'NAAC Accredited', value: 0, prefix: 'B Grade' },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function readAboutCollege(value: unknown): Partial<AboutCollegeContent> {
  if (!isRecord(value)) return {};
  let source = value;
  if (isRecord(source.aboutCollege)) source = source.aboutCollege;
  if (isRecord(source.about)) source = source.about;

  return {
    eyebrow: typeof source.eyebrow === 'string' ? source.eyebrow : undefined,
    title: typeof source.title === 'string' ? source.title : undefined,
    subtitle: typeof source.subtitle === 'string' ? source.subtitle : undefined,
    description: typeof source.description === 'string' ? source.description : undefined,
    quote: typeof source.quote === 'string' ? source.quote : undefined,
    quoteAttribution:
      typeof source.quoteAttribution === 'string' ? source.quoteAttribution : undefined,
    portraitSrc: typeof source.portraitSrc === 'string' ? source.portraitSrc : undefined,
    portraitAlt: typeof source.portraitAlt === 'string' ? source.portraitAlt : undefined,
    readMoreHref: typeof source.readMoreHref === 'string' ? source.readMoreHref : undefined,
    tourHref: typeof source.tourHref === 'string' ? source.tourHref : undefined,
    stats: Array.isArray(source.stats) ? (source.stats as AboutStat[]) : undefined,
  };
}

export function mergeAboutCollege(...values: unknown[]): AboutCollegeContent {
  const merged = values.reduce<Partial<AboutCollegeContent>>(
    (result, value) => ({ ...result, ...readAboutCollege(value) }),
    {},
  );
  return {
    eyebrow: merged.eyebrow ?? seedAboutCollege.eyebrow,
    title: merged.title ?? seedAboutCollege.title,
    subtitle: merged.subtitle ?? seedAboutCollege.subtitle,
    description: merged.description ?? seedAboutCollege.description,
    quote: merged.quote ?? seedAboutCollege.quote,
    quoteAttribution: merged.quoteAttribution ?? seedAboutCollege.quoteAttribution,
    portraitSrc:
      typeof merged.portraitSrc === 'string' && merged.portraitSrc.startsWith('/')
        ? merged.portraitSrc
        : seedAboutCollege.portraitSrc,
    portraitAlt: merged.portraitAlt ?? seedAboutCollege.portraitAlt,
    readMoreHref: merged.readMoreHref ?? seedAboutCollege.readMoreHref,
    tourHref: merged.tourHref ?? seedAboutCollege.tourHref,
    stats: normalizeAboutStats(merged.stats?.length ? merged.stats : seedAboutCollege.stats),
  };
}

/** Bump outdated handbook figures when CMS still stores the previous count. */
function normalizeAboutStats(stats: AboutStat[]): AboutStat[] {
  return stats.map((stat) => {
    if (stat.id === 'students' && Number(stat.value) === 2200) {
      return { ...stat, value: 3100, suffix: stat.suffix ?? '+' };
    }
    return stat;
  });
}
