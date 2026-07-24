import type { MetadataRoute } from 'next';
import { listAcademicDepartments } from '@/lib/academic-departments';
import { fetchCms, isRecord } from '@/lib/cms-client';
import { getCollegeContent, siteUrl } from '@/lib/content';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    '',
    '/about/history',
    '/about/vision-mission',
    '/about/principal',
    '/about/administration',
    '/about/administration/governing-body',
    '/about/administration/perspective-plans',
    '/about/administration/organogram',
    '/about/administration/naac',
    '/about/administration/iqac',
    '/about/administration/rusa',
    '/about/administration/nirf',
    '/about/administration/aishe',
    '/about/administration/uba',
    '/about/administration/grant-in-aid',
    '/about/administration/feedback',
    '/about/administration/covid-19-task-force',
    '/about/administration/committees',
    '/about/administration/annual-magazine',
    '/departments',
    '/academics/programmes',
    '/admission/apply',
    '/admission/fyug-2026',
    '/campus-life/clubs',
    '/research/cell',
    '/iqac',
    '/naac',
    '/news',
    '/contact',
    '/blood-donors',
    '/privacy',
    '/accessibility',
  ];

  let cmsEntries: MetadataRoute.Sitemap = [];
  try {
    const rows = await fetchCms('seo/sitemap-entries', {}, 600);
    if (Array.isArray(rows)) {
      cmsEntries = rows
        .map((row) => {
          if (!isRecord(row) || typeof row.loc !== 'string') return null;
          return {
            url: row.loc.startsWith('http') ? row.loc : `${siteUrl}${row.loc}`,
            lastModified: row.lastmod ? new Date(String(row.lastmod)) : new Date(),
            changeFrequency: (typeof row.changefreq === 'string'
              ? row.changefreq
              : 'weekly') as MetadataRoute.Sitemap[number]['changeFrequency'],
            priority: typeof row.priority === 'number' ? row.priority : 0.7,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
    }
  } catch {
    cmsEntries = [];
  }

  const content = await getCollegeContent();
  const news = content.news.map((item) => ({
    url: `${siteUrl}/news/${item.slug}`,
    lastModified: new Date(item.date),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));
  const departments = await listAcademicDepartments();
  const departmentUrls = departments.flatMap((dept) => {
    const base = {
      url: `${siteUrl}/departments/${dept.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    };
    const faculty = dept.featuredFaculty
      .concat()
      .filter((person) => person.websiteSlug)
      .map((person) => ({
        url: `${siteUrl}/departments/${dept.slug}/faculty/${person.websiteSlug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));
    return [base, ...faculty];
  });

  if (cmsEntries.length) {
    return [...cmsEntries, ...departmentUrls];
  }

  return [
    ...staticPaths.map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: path ? ('monthly' as const) : ('weekly' as const),
      priority: path ? 0.8 : 1,
    })),
    ...news,
    ...departmentUrls,
  ];
}
