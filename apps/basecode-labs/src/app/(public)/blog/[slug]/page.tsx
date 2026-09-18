import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHero } from '@/components/ui/page-shell';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post) return { title: 'Article' };
  return { title: post.title, description: post.excerpt };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || post.status !== 'PUBLISHED') notFound();
  return (
    <main>
      <PageHero
        eyebrow={post.category}
        title={post.title}
        description={post.publishedAt.toDateString()}
      />
      <div className="bcl-container py-12">
        <article className="mx-auto max-w-3xl whitespace-pre-wrap text-[16px] leading-8 text-slate-700">
          {post.body}
        </article>
      </div>
    </main>
  );
}
