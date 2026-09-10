'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { SchoolWebBundle, SchoolWebMenuItem } from '@/lib/school-web/public';
import { schoolPublicPath, schoolWebPath } from '@/lib/school-web/paths';

function isMainNewsNav(item: { label: string; href: string }) {
  return /news\s*(&|and)\s*events/i.test(item.label);
}

function tree(items: SchoolWebMenuItem[]) {
  const roots = items.filter((i) => !i.parentId && !isMainNewsNav(i));
  return roots.map((root) => ({
    ...root,
    children: items.filter((i) => i.parentId === root.id),
  }));
}

function pathIsActive(href: string, pathname: string) {
  const target = schoolPublicPath(href);
  const current = schoolPublicPath(pathname);
  if (target === '/') return current === '/';
  return current === target || current.startsWith(`${target}/`);
}

export function SchoolSiteHeader({
  bundle,
  logo,
  host,
}: {
  bundle: SchoolWebBundle;
  logo: string;
  host?: string | null;
}) {
  const pathname = usePathname() || '/';
  const hrefFor = (path: string) => schoolWebPath(path, host);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const items = tree(bundle.menus.find((m) => m.location === 'MAIN')?.items ?? []);
  const brandTitle = bundle.site.displayName.replace(/,?\s*Tura\s*$/i, '').trim();
  const virtues = bundle.site.motto
    .split(/[·•]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const pages = bundle.pages
      .filter(
        (p) => p.title.toLowerCase().includes(needle) || p.slug.toLowerCase().includes(needle),
      )
      .map((p) => ({ href: schoolWebPath(`/${p.slug}`, host), label: p.title, kind: 'Page' }));
    const notices = bundle.notices
      .filter((n) => n.title.toLowerCase().includes(needle))
      .map((n) => ({
        href: schoolWebPath(`/notices/${n.slug}`, host),
        label: n.title,
        kind: 'Notice',
      }));
    return [...pages, ...notices].slice(0, 8);
  }, [bundle.notices, bundle.pages, host, q]);

  return (
    <>
      <div className="sls-top">
        <div className="sls-top-inner">
          <ul className="sls-top-virtues">
            {virtues.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
          <ul className="sls-top-meta">
            <li>{bundle.site.addressLine}</li>
            {bundle.site.phone ? (
              <li>
                <a href={`tel:${bundle.site.phone.replace(/\s+/g, '')}`}>{bundle.site.phone}</a>
              </li>
            ) : null}
            {bundle.site.email ? (
              <li>
                <a href={`mailto:${bundle.site.email}`}>{bundle.site.email}</a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <header className="sls-header">
        <div className="sls-nav-inner">
          <a className="sls-brand" href={hrefFor('/')}>
            <img src={logo} alt={`${bundle.site.displayName} emblem`} />
            <span>
              <strong>{brandTitle}</strong>
              <span>
                {bundle.site.city}, {bundle.site.state}
              </span>
            </span>
          </a>
          <ul className="sls-menu">
            {items.map((item) => {
              const active = pathIsActive(item.href, pathname);
              if (item.children.length) {
                return (
                  <li key={item.id} className="sls-drop">
                    <a className={active ? 'is-active' : undefined} href={hrefFor(item.href)}>
                      {item.label}
                    </a>
                    <div className="sls-sub">
                      {item.children.map((child) => (
                        <a key={child.id} href={hrefFor(child.href)}>
                          {child.label}
                        </a>
                      ))}
                    </div>
                  </li>
                );
              }
              return (
                <li key={item.id}>
                  <a className={active ? 'is-active' : undefined} href={hrefFor(item.href)}>
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="sls-nav-tools">
            <button
              type="button"
              className="sls-search-btn"
              aria-label="Search the website"
              onClick={() => setSearchOpen(true)}
            >
              <SearchIcon />
            </button>
            <button type="button" className="sls-burger" onClick={() => setOpen((v) => !v)}>
              Menu
            </button>
          </div>
        </div>
        {open ? (
          <div className="sls-mobile">
            {items.flatMap((item) => [
              <a key={item.id} href={hrefFor(item.href)} onClick={() => setOpen(false)}>
                {item.label}
              </a>,
              ...item.children.map((child) => (
                <a key={child.id} href={hrefFor(child.href)} onClick={() => setOpen(false)}>
                  {child.label}
                </a>
              )),
            ])}
          </div>
        ) : null}
      </header>
      {searchOpen ? (
        <div className="sls-search" role="dialog" aria-label="Search">
          <button
            type="button"
            className="sls-search-backdrop"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
          />
          <div className="sls-search-panel">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pages and notices"
            />
            <ul>
              {hits.map((hit) => (
                <li key={hit.href}>
                  <a href={hit.href} onClick={() => setSearchOpen(false)}>
                    <span>{hit.kind}</span>
                    {hit.label}
                  </a>
                </li>
              ))}
            </ul>
            {q.trim().length >= 2 && !hits.length ? <p>No matching pages or notices.</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
