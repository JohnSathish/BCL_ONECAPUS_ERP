import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { FeaturedProjectsSection } from '@/components/public/featured-projects-section';
import { PageHero, SiteCta } from '@/components/ui/page-shell';

export const metadata: Metadata = {
  title: 'Portfolio',
  description: 'Projects taken from published client references on the live BaseCode Labs website.',
};

export default async function PortfolioPage() {
  const projects = await prisma.portfolioProject.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { displayOrder: 'asc' },
  });
  return (
    <main>
      <PageHero
        eyebrow="Portfolio"
        title="Work referenced by our clients"
        description="Projects taken from published client references on the live BaseCode Labs website. No invented case metrics."
      />
      <FeaturedProjectsSection projects={projects} hideIntro />
      <SiteCta />
    </main>
  );
}
