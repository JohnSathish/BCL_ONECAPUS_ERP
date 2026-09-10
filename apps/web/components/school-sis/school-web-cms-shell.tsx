'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  FileText,
  Home,
  ImageIcon,
  Inbox,
  LayoutDashboard,
  Menu,
  Megaphone,
  Search,
  Settings,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { SCHOOL_SIS_LOGO_SRC } from '@/lib/school-erp/product';
import { useAuthStore } from '@/store/auth-store';
import { schoolWebPublicSiteUrl } from './school-web-cms-error-boundary';
import './school-web-cms.css';

export type SchoolWebCmsView =
  | 'dashboard'
  | 'home'
  | 'pages'
  | 'notices'
  | 'events'
  | 'gallery'
  | 'launch'
  | 'admissions'
  | 'inbox'
  | 'seo'
  | 'footer'
  | 'site';

const GROUPS: Array<{
  label: string;
  items: Array<{ id: SchoolWebCmsView; label: string; href: string; icon: typeof Home }>;
}> = [
  {
    label: 'MAIN',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/admin/school-sis/website?view=dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'WEBSITE',
    items: [
      { id: 'home', label: 'Homepage', href: '/admin/school-sis/website?view=home', icon: Home },
      { id: 'pages', label: 'Pages', href: '/admin/school-sis/website?view=pages', icon: FileText },
      {
        id: 'notices',
        label: 'News & Notices',
        href: '/admin/school-sis/website?view=notices',
        icon: Megaphone,
      },
      {
        id: 'events',
        label: 'Events',
        href: '/admin/school-sis/website?view=events',
        icon: CalendarDays,
      },
      {
        id: 'gallery',
        label: 'Gallery',
        href: '/admin/school-sis/website/albums',
        icon: ImageIcon,
      },
    ],
  },
  {
    label: 'MARKETING',
    items: [
      {
        id: 'launch',
        label: 'Popups',
        href: '/admin/school-sis/website?view=launch',
        icon: Sparkles,
      },
      {
        id: 'admissions',
        label: 'Admissions',
        href: '/admin/school-sis/website?view=admissions',
        icon: FileText,
      },
      {
        id: 'inbox',
        label: 'Enquiries',
        href: '/admin/school-sis/website?view=inbox',
        icon: Inbox,
      },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { id: 'seo', label: 'SEO', href: '/admin/school-sis/website?view=seo', icon: Search },
      {
        id: 'footer',
        label: 'Footer',
        href: '/admin/school-sis/website?view=footer',
        icon: FileText,
      },
      {
        id: 'site',
        label: 'Site settings',
        href: '/admin/school-sis/website?view=site',
        icon: Settings,
      },
    ],
  },
];

export function parseSchoolWebCmsView(raw: string | null, pathname: string): SchoolWebCmsView {
  if (pathname.includes('/website/albums')) return 'gallery';
  const allowed = GROUPS.flatMap((g) => g.items.map((i) => i.id));
  if (raw && (allowed as string[]).includes(raw)) return raw as SchoolWebCmsView;
  return 'dashboard';
}

export function SchoolWebCmsShell({
  children,
  title,
  crumbs,
}: {
  children: React.ReactNode;
  title: string;
  crumbs: Array<{ label: string; href?: string }>;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const view = parseSchoolWebCmsView(params.get('view'), pathname);
  const session = useAuthStore((s) => s.session);
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState('');
  const publicUrl = schoolWebPublicSiteUrl();
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return GROUPS;
    return GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(needle)),
    })).filter((group) => group.items.length);
  }, [q]);

  const nav = (
    <>
      <div className="sls-cms-brand">
        <img src={SCHOOL_SIS_LOGO_SRC} alt="" />
        <div>
          <strong>St. Luke’s CMS</strong>
          <span>Public website</span>
        </div>
      </div>
      {filtered.map((group) => (
        <div key={group.label} className="sls-cms-group">
          <p>{group.label}</p>
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`sls-cms-link${view === item.id ? ' is-active' : ''}`}
                onClick={() => setDrawer(false)}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <div className="sls-cms">
      <aside className="sls-cms-nav">{nav}</aside>
      <div className="sls-cms-main">
        <div className="sls-cms-top">
          <div className="sls-cms-mobile-nav">
            <button
              type="button"
              className="sls-cms-icon-btn"
              aria-label="Open website menu"
              onClick={() => setDrawer(true)}
            >
              <Menu size={18} />
            </button>
            <h1>St. Luke’s CMS</h1>
          </div>
          <h1 className="hidden lg:block">St. Luke’s Website CMS</h1>
          <div className="sls-cms-top-actions">
            <input
              className="sls-cms-search"
              placeholder="Search website tools…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search website tools"
            />
            <button
              type="button"
              className="sls-cms-icon-btn"
              aria-label="Website enquiries"
              onClick={() => router.push('/admin/school-sis/website?view=inbox')}
            >
              <Bell size={16} />
            </button>
            <button
              type="button"
              className="sls-cms-icon-btn"
              aria-label={session?.user.fullName || 'Admin'}
            >
              <UserRound size={16} />
            </button>
          </div>
        </div>
        <div className="sls-cms-work">
          <nav className="sls-cms-crumbs" aria-label="Breadcrumb">
            <Link href="/admin/school-sis/website">Website</Link>
            {crumbs.map((crumb) => (
              <span key={crumb.label}>
                / {crumb.href ? <a href={crumb.href}>{crumb.label}</a> : crumb.label}
              </span>
            ))}
          </nav>
          <p className="sls-cms-help" style={{ margin: '-0.35rem 0 0.9rem' }}>
            Public site:{' '}
            <a href={publicUrl} target="_blank" rel="noreferrer">
              {publicUrl}
            </a>
          </p>
          {title ? <span className="sr-only">{title}</span> : null}
          {children}
        </div>
      </div>
      {drawer ? (
        <div className="sls-cms-drawer">
          <button
            type="button"
            aria-label="Close menu"
            className="school-erp-backdrop"
            onClick={() => setDrawer(false)}
          />
          <div className="sls-cms-drawer-panel">
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
              <button
                type="button"
                className="sls-cms-icon-btn"
                aria-label="Close"
                onClick={() => setDrawer(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '0 12px 24px' }}>{nav}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
