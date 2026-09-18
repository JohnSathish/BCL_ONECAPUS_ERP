import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { EmptyState, PageHero } from '@/components/ui/page-shell';

export const metadata: Metadata = { title: 'Blog' };

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
  });
  return (
    <main>
      <PageHero
        eyebrow="Resources"
        title="Knowledge centre"
        description="Notes on school and college software, websites and digital operations in Tamil Nadu and Meghalaya."
      />
      <div className="bcl-container space-y-4 py-12">
        {posts.length ? (
          posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="bcl-card block p-6">
              <p className="text-xs uppercase tracking-wide text-blue-600">{post.category}</p>
              <h2 className="mt-1 text-xl font-semibold">{post.title}</h2>
              <p className="mt-2 text-slate-600">{post.excerpt}</p>
            </Link>
          ))
        ) : (
          <EmptyState
            title="No articles yet"
            description="Published posts from BaseCode Central will appear here."
          />
        )}
      </div>
    </main>
  );
}
