import { schoolWebPath } from '@/lib/school-web/paths';
import { RELATED_LINKS } from '@/lib/school-web/seo';

export function SchoolRelatedLinks({ slug, host }: { slug: string; host?: string | null }) {
  const items = RELATED_LINKS[slug];
  if (!items?.length) return null;
  return (
    <aside className="sls-related">
      <h2>Related</h2>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a href={schoolWebPath(item.href, host)}>{item.label}</a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
