import type { Metadata } from 'next';
import CareersJobDetailClient from './job-detail-client';
import { CAREERS_PUBLIC_URL, careersOpenGraph, careersTwitter } from '@/lib/careers-seo';
import { unwrapApiPayload } from '@/lib/http/api-envelope';
import type { CareersJob } from '@/services/careers-portal';
const API_BASE = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001/api';
const CAREER_HOST = process.env.NEXT_PUBLIC_CAREER_HOST ?? 'career.demo.localhost';

async function fetchJob(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/v1/careers/portal/jobs/${slug}`, {
      headers: { 'X-Login-Host': CAREER_HOST, Host: CAREER_HOST },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return unwrapApiPayload<CareersJob | null>(json);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await fetchJob(slug);
  if (!job) {
    return { title: 'Job not found | DBC Careers' };
  }
  const title = `${job.title} | Don Bosco College Careers`;
  const description =
    job.qualificationRequired ??
    job.description?.slice(0, 160) ??
    `Apply for ${job.title} at Don Bosco College, Tura.`;
  return {
    title,
    description,
    alternates: { canonical: `${CAREERS_PUBLIC_URL}/jobs/${slug}` },
    openGraph: careersOpenGraph({ title, description, path: `/jobs/${slug}` }),
    twitter: careersTwitter({ title, description }),
    keywords: [
      job.title,
      job.department?.name,
      job.designation?.label,
      'Don Bosco College Tura',
      'faculty jobs Meghalaya',
    ].filter(Boolean) as string[],
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await fetchJob(slug);
  const jsonLd =
    job &&
    ({
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: job.title,
      description: job.jobDescriptionHtml?.replace(/<[^>]+>/g, ' ') ?? job.description ?? job.title,
      datePosted: job.publishedAt,
      validThrough: job.closingDate,
      hiringOrganization: {
        '@type': 'Organization',
        name: 'Don Bosco College, Tura',
        sameAs: 'https://donboscocollege.ac.in',
      },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Tura',
          addressRegion: 'Meghalaya',
          addressCountry: 'IN',
        },
      },
      url: `${CAREERS_PUBLIC_URL}/jobs/${slug}`,
    } as Record<string, unknown>);

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <CareersJobDetailClient slug={slug} initialJob={job} />
    </>
  );
}
