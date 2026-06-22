export const CAREERS_PUBLIC_URL =
  process.env.CAREERS_PUBLIC_URL ?? 'https://career.donboscocollege.ac.in';

export const CAREERS_SITE_NAME = 'Don Bosco College Careers';

export const CAREERS_DEFAULT_DESCRIPTION =
  'Faculty and staff openings at Don Bosco College, Tura — teaching, non-teaching, guest faculty and contractual positions in Meghalaya.';

export function careersOpenGraph(input: { title: string; description: string; path?: string }) {
  const url = input.path
    ? `${CAREERS_PUBLIC_URL}${input.path.startsWith('/') ? input.path : `/${input.path}`}`
    : CAREERS_PUBLIC_URL;
  return {
    title: input.title,
    description: input.description,
    url,
    siteName: CAREERS_SITE_NAME,
    locale: 'en_IN',
    type: 'website' as const,
  };
}

export function careersTwitter(input: { title: string; description: string }) {
  return {
    card: 'summary_large_image' as const,
    title: input.title,
    description: input.description,
  };
}
