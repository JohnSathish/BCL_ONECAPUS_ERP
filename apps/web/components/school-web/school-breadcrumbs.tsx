import { schoolWebPath } from '@/lib/school-web/paths';
import type { SeoCrumb } from '@/lib/school-web/seo';

export function SchoolBreadcrumbs({ items, host }: { items: SeoCrumb[]; host?: string | null }) {
  if (items.length < 2) return null;
  return (
    <nav className="sls-crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.href}-${i}`}>
              {last ? (
                <span aria-current="page">{item.label}</span>
              ) : (
                <a href={schoolWebPath(item.href, host)}>{item.label}</a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
