'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  FileText,
  Image as ImageIcon,
  Images,
  LayoutDashboard,
  Menu,
  Palette,
  Plus,
  Rocket,
  Shapes,
  GraduationCap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { AnnouncementsView } from '@/components/website-cms/announcements-view';
import { RichTextEditor } from '@/components/communication/compose/rich-text-editor';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  createWebsiteContentType,
  createWebsiteHeroSlide,
  createWebsiteMediaFolder,
  createWebsiteNotice,
  createWebsitePage,
  createWebsitePreview,
  createWebsiteSection,
  deleteWebsiteHeroSlide,
  deleteWebsiteMedia,
  deleteWebsiteNotice,
  deleteWebsiteRedirect,
  duplicateWebsitePage,
  fetchWebsiteAcademicDepartments,
  fetchWebsiteAppearance,
  fetchWebsiteBloodDonors,
  fetchWebsiteFyugInterests,
  fetchWebsiteFyugInterestStats,
  downloadWebsiteFyugInterestExcel,
  downloadWebsiteFyugInterestPdf,
  fetchWebsiteCalendarItems,
  fetchWebsiteContentSources,
  fetchWebsiteContentTypes,
  fetchWebsiteDashboard,
  fetchWebsiteHeroSlides,
  fetchWebsiteHomepageContent,
  fetchWebsiteHomepageLayout,
  fetchWebsiteMedia,
  fetchWebsiteMediaFolders,
  fetchWebsiteMenus,
  fetchWebsiteNotices,
  fetchWebsitePages,
  fetchWebsiteRedirects,
  fetchWebsiteRevisions,
  fetchWebsiteSettings,
  publishAllWebsiteAcademicDepartments,
  publishWebsite,
  reorderWebsiteHeroSlides,
  reorderWebsiteSections,
  restoreWebsiteRevision,
  revalidateWebsite,
  trashWebsitePage,
  updateWebsiteAppearance,
  updateWebsiteCalendarItems,
  updateWebsiteContentSources,
  updateWebsiteHeroSlide,
  updateWebsiteHomepageContent,
  updateWebsiteHomepageLayout,
  updateWebsiteMediaMeta,
  updateWebsiteMenu,
  updateWebsiteNotice,
  updateWebsitePage,
  updateWebsiteSection,
  updateWebsiteSettings,
  upsertWebsiteAcademicDepartment,
  upsertWebsiteRedirect,
  uploadWebsiteHeroSlideMobile,
  uploadWebsiteMedia,
} from '@/services/website-cms';
import type {
  WebsiteHeroSlide,
  WebsiteHomepageSection,
  WebsiteMenuItem,
  WebsiteNotice,
  WebsitePage,
  WebsitePageSection,
  WebsiteSettings,
} from '@/types/website-cms';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  HOMEPAGE_SECTION_CATALOG,
  NOTICE_CATEGORIES,
  NOTICE_PRIORITIES,
  PAGE_BLOCK_TYPES,
} from '@/lib/website/homepage-sections';
import { ContentEntriesEditor } from './content-entries-editor';
import { HomepageContentEditors } from './homepage-content-editors';
import { LifeAtCampusEditor } from './life-at-campus-editor';
import { ReorderableList } from './reorderable-list';
import { WEBSITE_CMS_GROUPS, WEBSITE_CMS_NAV } from './website-cms-nav';

export type WebsiteCmsSection =
  | 'dashboard'
  | 'settings'
  | 'pages'
  | 'navigation'
  | 'content'
  | 'media'
  | 'hero'
  | 'publishing'
  | 'departments'
  | 'notices'
  | 'news'
  | 'homepage'
  | 'announcements'
  | 'flash-news'
  | 'testimonials'
  | 'faculty'
  | 'programmes'
  | 'calendar'
  | 'gallery'
  | 'documents'
  | 'videos'
  | 'theme'
  | 'footer'
  | 'seo'
  | 'blood-donors'
  | 'fyug-interest';

export function WebsiteCmsWorkspace({ section }: { section: WebsiteCmsSection }) {
  useRequireAuth();
  const [message, setMessage] = useState('');

  return (
    <DashboardShell
      title="Website CMS"
      subtitle="WordPress-like content management for the public college website"
    >
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-border bg-card p-2">
          <nav className="space-y-3" aria-label="Website CMS">
            {WEBSITE_CMS_GROUPS.map((group) => {
              const items = WEBSITE_CMS_NAV.filter((item) => item.group === group.id);
              if (!items.length) return null;
              return (
                <div key={group.id} className="space-y-1">
                  {group.label ? (
                    <p className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>
                  ) : null}
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = section === item.id;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                          active
                            ? 'bg-muted font-semibold text-foreground'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {item.comingSoon ? (
                          <Badge variant="secondary" className="ml-auto text-[10px]">
                            Soon
                          </Badge>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          {message ? (
            <div
              className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
              role="status"
            >
              {message}
            </div>
          ) : null}
          {section === 'dashboard' ? <DashboardView onMessage={setMessage} /> : null}
          {section === 'settings' ? (
            <>
              <SettingsView onMessage={setMessage} />
              <HeaderCtasView onMessage={setMessage} />
            </>
          ) : null}
          {section === 'pages' ? <PagesView onMessage={setMessage} /> : null}
          {section === 'navigation' ? <NavigationView onMessage={setMessage} /> : null}
          {section === 'content' ? <ContentTypesView onMessage={setMessage} /> : null}
          {section === 'media' ? <MediaView onMessage={setMessage} /> : null}
          {section === 'hero' ? <HeroSliderView onMessage={setMessage} /> : null}
          {section === 'departments' ? <DepartmentsPublishView onMessage={setMessage} /> : null}
          {section === 'publishing' ? <PublishingView onMessage={setMessage} /> : null}
          {section === 'notices' ? <NoticesView onMessage={setMessage} /> : null}
          {section === 'announcements' ? <AnnouncementsView onMessage={setMessage} /> : null}
          {section === 'blood-donors' ? <BloodDonorsView /> : null}
          {section === 'fyug-interest' ? <FyugInterestView /> : null}
          {section === 'news' ? <NewsEntriesView onMessage={setMessage} /> : null}
          {section === 'homepage' ? <HomepageBuilderView onMessage={setMessage} /> : null}
          {section === 'theme' ? <ThemeView onMessage={setMessage} /> : null}
          {section === 'footer' ? <FooterWidgetsView onMessage={setMessage} /> : null}
          {section === 'seo' ? <SeoSuiteView onMessage={setMessage} /> : null}
          {section === 'calendar' ? <CalendarVisibilityView onMessage={setMessage} /> : null}
          {section === 'gallery' ? <LifeAtCampusEditor onMessage={setMessage} /> : null}
          {section === 'documents' || section === 'videos' ? (
            <MediaCollectionsView kind={section} onMessage={setMessage} />
          ) : null}
          {section === 'faculty' || section === 'programmes' ? (
            <AcademicSourceView section={section} onMessage={setMessage} />
          ) : null}
          {['flash-news', 'testimonials'].includes(section) ? (
            <CptModuleView slug={section} onMessage={setMessage} />
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}

function QueryState({ loading, error }: { loading: boolean; error: unknown }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading website data…</p>;
  if (error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {apiErrorMessage(error, 'Website data could not be loaded')}
      </p>
    );
  }
  return null;
}

function DashboardView({ onMessage }: { onMessage: (message: string) => void }) {
  const dashboard = useQuery({
    queryKey: ['website', 'dashboard'],
    queryFn: fetchWebsiteDashboard,
  });
  const preview = useMutation({
    mutationFn: () => createWebsitePreview(),
    onSuccess: (result) => window.open(result.url, '_blank', 'noopener,noreferrer'),
    onError: (error) => onMessage(apiErrorMessage(error, 'Preview could not be created')),
  });

  if (!dashboard.data) return <QueryState loading={dashboard.isLoading} error={dashboard.error} />;
  const data = dashboard.data;
  const stats = [
    ['Pages', data.pages],
    ['News', data.news ?? 0],
    ['Notice Board', data.notices ?? 0],
    ['Departments', data.departments ?? 0],
    ['Faculty Profiles', data.facultyProfiles ?? 0],
    ['Media Files', data.mediaFiles ?? data.mediaAssets],
    ['Hero Slides', data.heroSlides ?? 0],
    ['Awaiting review', data.pendingReviews],
  ];
  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Website status</p>
            <p className="mt-1 text-lg font-semibold">
              {data.status === 'LIVE' ? '🟢 Live' : data.status || 'Unknown'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/admin/website/pages">
                <Plus className="mr-1 h-4 w-4" />
                New Page
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/website/notices">Add Notice</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/website/news">Add News</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/website/media">Upload Media</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/website/homepage">Edit Homepage</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => preview.mutate()}
              disabled={preview.isPending}
            >
              <Eye className="mr-1 h-4 w-4" /> Preview
            </Button>
          </div>
        </CompactCardBody>
      </CompactCard>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value]) => (
          <CompactCard key={String(label)}>
            <CompactCardBody>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </CompactCardBody>
          </CompactCard>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CompactCard>
          <CompactCardHeader title="Visitors today" description="Connect analytics later" />
          <CompactCardBody>
            <p className="text-2xl font-semibold">{data.visitorsToday ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Not configured</p>
          </CompactCardBody>
        </CompactCard>
        <CompactCard>
          <CompactCardHeader title="SEO score" description="Phase 5 SEO suite" />
          <CompactCardBody>
            <p className="text-2xl font-semibold">
              {data.seoScore != null ? `${data.seoScore}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Not configured</p>
          </CompactCardBody>
        </CompactCard>
      </div>
    </div>
  );
}

const settingsSchema = z.object({
  siteName: z.string().min(2, 'Site name is required'),
  tagline: z.string(),
  description: z.string(),
  logoUrl: z.union([z.literal(''), z.url()]),
  faviconUrl: z.union([z.literal(''), z.url()]),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a six-digit hex color'),
  secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a six-digit hex color'),
  fontFamily: z.string().min(1),
  contactEmail: z.union([z.literal(''), z.email()]),
  contactPhone: z.string(),
  address: z.string(),
  mapUrl: z.union([z.literal(''), z.url()]),
  facebook: z.union([z.literal(''), z.url()]),
  instagram: z.union([z.literal(''), z.url()]),
  youtube: z.union([z.literal(''), z.url()]),
});
type SettingsForm = z.infer<typeof settingsSchema>;

function SettingsView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['website', 'settings'], queryFn: fetchWebsiteSettings });
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      siteName: '',
      tagline: '',
      description: '',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '#1d4ed8',
      secondaryColor: '#0f172a',
      fontFamily: 'Inter',
      contactEmail: '',
      contactPhone: '',
      address: '',
      mapUrl: '',
      facebook: '',
      instagram: '',
      youtube: '',
    },
  });
  useEffect(() => {
    if (!settings.data) return;
    form.reset({
      ...settings.data,
      tagline: settings.data.tagline ?? '',
      description: settings.data.description ?? '',
      logoUrl: settings.data.logoUrl ?? '',
      faviconUrl: settings.data.faviconUrl ?? '',
      contactEmail: settings.data.contactEmail ?? '',
      contactPhone: settings.data.contactPhone ?? '',
      address: settings.data.address ?? '',
      mapUrl: settings.data.mapUrl ?? '',
      facebook: settings.data.socialLinks.facebook ?? '',
      instagram: settings.data.socialLinks.instagram ?? '',
      youtube: settings.data.socialLinks.youtube ?? '',
    });
  }, [settings.data, form]);
  const save = useMutation({
    mutationFn: (values: SettingsForm) => {
      const payload: WebsiteSettings = {
        ...values,
        socialLinks: {
          facebook: values.facebook,
          instagram: values.instagram,
          youtube: values.youtube,
        },
      };
      return updateWebsiteSettings(payload);
    },
    onSuccess: () => {
      onMessage('Website settings saved.');
      void queryClient.invalidateQueries({ queryKey: ['website'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Settings could not be saved')),
  });

  if (!settings.data) return <QueryState loading={settings.isLoading} error={settings.error} />;
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
      <div className="grid gap-4 xl:grid-cols-3">
        <SettingsCard
          title="Identity"
          fields={['siteName', 'tagline', 'description', 'logoUrl', 'faviconUrl']}
          form={form}
        />
        <SettingsCard
          title="Theme"
          fields={['primaryColor', 'secondaryColor', 'fontFamily']}
          form={form}
        />
        <SettingsCard
          title="Contact & social"
          fields={[
            'contactEmail',
            'contactPhone',
            'address',
            'mapUrl',
            'facebook',
            'instagram',
            'youtube',
          ]}
          form={form}
        />
      </div>
      <Button type="submit" disabled={save.isPending}>
        Save site settings
      </Button>
    </form>
  );
}

function SettingsCard({
  title,
  fields,
  form,
}: {
  title: string;
  fields: Array<keyof SettingsForm>;
  form: UseFormReturn<SettingsForm>;
}) {
  return (
    <CompactCard>
      <CompactCardHeader title={title} />
      <CompactCardBody className="space-y-3">
        {fields.map((field) => (
          <label key={field} className="block text-sm">
            <span className="mb-1 block capitalize text-muted-foreground">
              {field.replace(/([A-Z])/g, ' $1')}
            </span>
            <Input
              {...form.register(field)}
              type={field.includes('Color') ? 'color' : field === 'contactEmail' ? 'email' : 'text'}
            />
            {form.formState.errors[field] ? (
              <span className="mt-1 block text-xs text-destructive">
                {form.formState.errors[field]?.message}
              </span>
            ) : null}
          </label>
        ))}
      </CompactCardBody>
    </CompactCard>
  );
}

function PagesView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const pagesQuery = useQuery({ queryKey: ['website', 'pages'], queryFn: fetchWebsitePages });
  const pages = pagesQuery.data ?? [];
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'DRAFT' | 'PUBLISHED' | 'IN_REVIEW' | 'TRASH'
  >('ALL');
  const [selectedId, setSelectedId] = useState('');
  const visiblePages = pages.filter((page) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'TRASH') return false;
    return page.status === statusFilter;
  });
  const selected = visiblePages.find((page) => page.id === selectedId) ?? visiblePages[0];
  const [sectionsDraft, setSectionsDraft] = useState<WebsitePageSection[]>([]);
  useEffect(() => setSectionsDraft(selected?.sections ?? []), [selected]);
  const createPage = useMutation({
    mutationFn: () =>
      createWebsitePage({
        title: 'Untitled page',
        slug: `page-${Date.now()}`,
        status: 'DRAFT',
        template: 'DEFAULT',
      }),
    onSuccess: (page) => {
      setSelectedId(page.id);
      void queryClient.invalidateQueries({ queryKey: ['website', 'pages'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Page could not be created')),
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => duplicateWebsitePage(id),
    onSuccess: (page) => {
      setSelectedId(page.id);
      onMessage('Page duplicated as draft.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'pages'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not duplicate page')),
  });
  const trash = useMutation({
    mutationFn: (id: string) => trashWebsitePage(id),
    onSuccess: () => {
      setSelectedId('');
      onMessage('Page moved to trash.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'pages'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not trash page')),
  });
  const saveOrder = useMutation({
    mutationFn: (items: WebsitePageSection[]) =>
      reorderWebsiteSections(
        selected!.id,
        items.map((item) => item.id),
      ),
    onSuccess: () => {
      onMessage('Section order saved.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'pages'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Section order could not be saved')),
  });

  if (pagesQuery.isLoading || pagesQuery.error)
    return <QueryState loading={pagesQuery.isLoading} error={pagesQuery.error} />;
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <CompactCard>
        <CompactCardHeader title="Pages" description="All / Draft / Published / Review" />
        <CompactCardBody className="space-y-2">
          <Button size="sm" className="w-full" onClick={() => createPage.mutate()}>
            <Plus className="mr-2 h-4 w-4" />
            Add New
          </Button>
          <div className="flex flex-wrap gap-1">
            {(['ALL', 'DRAFT', 'PUBLISHED', 'IN_REVIEW'] as const).map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant={statusFilter === filter ? 'default' : 'outline'}
                onClick={() => setStatusFilter(filter)}
              >
                {filter === 'ALL' ? 'All' : filter.replace('_', ' ')}
              </Button>
            ))}
          </div>
          {visiblePages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => setSelectedId(page.id)}
              className={cn(
                'w-full rounded-md border px-3 py-2 text-left text-sm',
                selected?.id === page.id ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              <span className="block font-medium">{page.title}</span>
              <span className="text-xs text-muted-foreground">
                /{page.slug} · {page.status}
              </span>
            </button>
          ))}
        </CompactCardBody>
      </CompactCard>
      {selected ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={duplicate.isPending}
              onClick={() => duplicate.mutate(selected.id)}
            >
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={trash.isPending}
              onClick={() => trash.mutate(selected.id)}
            >
              Move to Trash
            </Button>
          </div>
          <PageDetails key={selected.id} page={selected} onMessage={onMessage} />
          <CompactCard>
            <CompactCardHeader
              title="Page sections"
              description="Drag sections or use the keyboard-friendly arrow controls."
            />
            <CompactCardBody className="space-y-3">
              <ReorderableList
                label={`Sections for ${selected.title}`}
                items={sectionsDraft}
                onReorder={(items) => {
                  setSectionsDraft(items);
                  saveOrder.mutate(items);
                }}
                renderItem={(section) => (
                  <SectionEditor pageId={selected.id} section={section} onMessage={onMessage} />
                )}
              />
              <NewSection pageId={selected.id} onMessage={onMessage} />
            </CompactCardBody>
          </CompactCard>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Create the first website page.</p>
      )}
    </div>
  );
}

function PageDetails({
  page,
  onMessage,
}: {
  page: WebsitePage;
  onMessage: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(page);
  const save = useMutation({
    mutationFn: () => updateWebsitePage(page.id, draft),
    onSuccess: () => {
      onMessage('Page details saved.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'pages'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Page could not be saved')),
  });
  return (
    <CompactCard>
      <CompactCardHeader title="Page details" />
      <CompactCardBody className="grid gap-3 md:grid-cols-2">
        <Input
          value={draft.title}
          aria-label="Page title"
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <Input
          value={draft.slug}
          aria-label="Page slug"
          onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
        />
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={draft.status}
          aria-label="Page status"
          onChange={(event) =>
            setDraft({ ...draft, status: event.target.value as WebsitePage['status'] })
          }
        >
          {['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <Input
          value={draft.seoTitle ?? ''}
          placeholder="SEO title"
          onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })}
        />
        <Input
          className="md:col-span-2"
          value={draft.seoDescription ?? ''}
          placeholder="SEO description"
          onChange={(event) => setDraft({ ...draft, seoDescription: event.target.value })}
        />
        <Input
          className="md:col-span-2"
          value={(draft as WebsitePage & { seoKeywords?: string }).seoKeywords ?? ''}
          placeholder="SEO keywords (comma separated)"
          onChange={(event) =>
            setDraft({ ...draft, seoKeywords: event.target.value } as WebsitePage)
          }
        />
        <Input
          placeholder="Canonical URL"
          value={(draft as WebsitePage & { canonicalUrl?: string }).canonicalUrl ?? ''}
          onChange={(event) =>
            setDraft({ ...draft, canonicalUrl: event.target.value } as WebsitePage)
          }
        />
        <Input
          placeholder="OG image URL"
          value={(draft as WebsitePage & { ogImageUrl?: string }).ogImageUrl ?? ''}
          onChange={(event) =>
            setDraft({ ...draft, ogImageUrl: event.target.value } as WebsitePage)
          }
        />
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={(draft as WebsitePage & { robots?: string }).robots ?? 'index,follow'}
          onChange={(event) => setDraft({ ...draft, robots: event.target.value } as WebsitePage)}
          aria-label="Robots"
        >
          <option value="index,follow">index,follow</option>
          <option value="noindex,follow">noindex,follow</option>
          <option value="noindex,nofollow">noindex,nofollow</option>
        </select>
        <Button className="w-fit" onClick={() => save.mutate()} disabled={save.isPending}>
          Save page
        </Button>
      </CompactCardBody>
    </CompactCard>
  );
}

function SectionEditor({
  pageId,
  section,
  onMessage,
}: {
  pageId: string;
  section: WebsitePageSection;
  onMessage: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [heading, setHeading] = useState(section.heading ?? '');
  const [bodyHtml, setBodyHtml] = useState(section.bodyHtml ?? '');
  const save = useMutation({
    mutationFn: () => updateWebsiteSection(pageId, section.id, { heading, bodyHtml }),
    onSuccess: () => {
      onMessage('Section saved.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'pages'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Section could not be saved')),
  });
  return (
    <div>
      <button
        type="button"
        className="w-full text-left"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium">{section.label}</span>
        <span className="ml-2 text-xs text-muted-foreground">{section.type}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <Input
            value={heading}
            onChange={(event) => setHeading(event.target.value)}
            placeholder="Section heading"
          />
          <RichTextEditor key={section.id} value={bodyHtml} onChange={setBodyHtml} />
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            Save section
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function NewSection({
  pageId,
  onMessage,
}: {
  pageId: string;
  onMessage: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState('RICH_TEXT');
  const create = useMutation({
    mutationFn: () =>
      createWebsiteSection(pageId, { type, label: type.replaceAll('_', ' '), isVisible: true }),
    onSuccess: () => {
      onMessage('Section added.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'pages'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Section could not be added')),
  });
  return (
    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
      <select
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={type}
        onChange={(event) => setType(event.target.value)}
        aria-label="Section type"
      >
        {PAGE_BLOCK_TYPES.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <Button variant="outline" onClick={() => create.mutate()}>
        <Plus className="mr-2 h-4 w-4" />
        Add section
      </Button>
    </div>
  );
}

function NavigationView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['website', 'menus'], queryFn: fetchWebsiteMenus });
  const [drafts, setDrafts] = useState<Record<string, WebsiteMenuItem[]>>({});
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('/');
  const [parentId, setParentId] = useState('');
  useEffect(() => {
    if (query.data) setDrafts(Object.fromEntries(query.data.map((menu) => [menu.id, menu.items])));
  }, [query.data]);
  const save = useMutation({
    mutationFn: ({ id, items }: { id: string; items: WebsiteMenuItem[] }) =>
      updateWebsiteMenu(id, { items }),
    onSuccess: () => {
      onMessage('Menu saved.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'menus'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Menu could not be saved')),
  });

  const indentLabel = (items: WebsiteMenuItem[], item: WebsiteMenuItem) => {
    let depth = 0;
    let current = item.parentId;
    const byId = new Map(items.map((row) => [row.id, row]));
    while (current && byId.has(current) && depth < 8) {
      depth += 1;
      current = byId.get(current)?.parentId ?? null;
    }
    return `${'— '.repeat(depth)}${item.label}`;
  };

  if (!query.data) return <QueryState loading={query.isLoading} error={query.error} />;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {query.data.map((menu) => {
        const items = drafts[menu.id] ?? menu.items;
        return (
          <CompactCard key={menu.id}>
            <CompactCardHeader
              title={menu.name}
              description={`${menu.location.toLowerCase()} · nested menus via parent (unlimited depth)`}
            />
            <CompactCardBody className="space-y-3">
              <ReorderableList
                label={`${menu.name} items`}
                items={items}
                onReorder={(next) => {
                  setDrafts((current) => ({ ...current, [menu.id]: next }));
                  save.mutate({ id: menu.id, items: next });
                }}
                renderItem={(item) => (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{indentLabel(items, item)}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.url}</p>
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                        aria-label={`Parent for ${item.label}`}
                        value={item.parentId ?? ''}
                        onChange={(event) => {
                          const next = items.map((row) =>
                            row.id === item.id
                              ? { ...row, parentId: event.target.value || null }
                              : row,
                          );
                          setDrafts((current) => ({ ...current, [menu.id]: next }));
                          save.mutate({ id: menu.id, items: next });
                        }}
                      >
                        <option value="">Top level</option>
                        {items
                          .filter((row) => row.id !== item.id)
                          .map((row) => (
                            <option key={row.id} value={row.id}>
                              Under: {row.label}
                            </option>
                          ))}
                      </select>
                      <Input
                        className="h-8 max-w-[160px] text-xs"
                        value={item.url}
                        aria-label={`URL for ${item.label}`}
                        onChange={(event) => {
                          const next = items.map((row) =>
                            row.id === item.id ? { ...row, url: event.target.value } : row,
                          );
                          setDrafts((current) => ({ ...current, [menu.id]: next }));
                        }}
                        onBlur={() => save.mutate({ id: menu.id, items })}
                      />
                    </div>
                  </div>
                )}
              />
              <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={newLabel}
                  onChange={(event) => setNewLabel(event.target.value)}
                  placeholder="New item label"
                />
                <Input
                  value={newUrl}
                  onChange={(event) => setNewUrl(event.target.value)}
                  placeholder="/path"
                />
                <Button
                  variant="outline"
                  disabled={!newLabel.trim()}
                  onClick={() => {
                    const nextItem: WebsiteMenuItem = {
                      id: `tmp-${Date.now()}`,
                      label: newLabel.trim(),
                      url: newUrl.trim() || '/',
                      target: '_self',
                      position: items.length,
                      parentId: parentId || null,
                      isVisible: true,
                    };
                    const next = [...items, nextItem];
                    setDrafts((current) => ({ ...current, [menu.id]: next }));
                    setNewLabel('');
                    setParentId('');
                    save.mutate({ id: menu.id, items: next });
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
                aria-label="Parent for new item"
              >
                <option value="">New item: top level</option>
                {items.map((row) => (
                  <option key={row.id} value={row.id}>
                    Under: {row.label}
                  </option>
                ))}
              </select>
            </CompactCardBody>
          </CompactCard>
        );
      })}
    </div>
  );
}

function ContentTypesView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['website', 'content-types'],
    queryFn: fetchWebsiteContentTypes,
  });
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () =>
      createWebsiteContentType({
        name,
        slug: name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-'),
        fields: [],
        entryCount: 0,
      }),
    onSuccess: () => {
      setName('');
      onMessage('Content type created.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'content-types'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Content type could not be created')),
  });
  if (!query.data) return <QueryState loading={query.isLoading} error={query.error} />;
  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="New content type"
          description="Create reusable structured content for news, events, people, or programmes."
        />
        <CompactCardBody className="flex max-w-xl gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Content type name"
          />
          <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            Create
          </Button>
        </CompactCardBody>
      </CompactCard>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {query.data.map((type) => (
          <CompactCard key={type.id}>
            <CompactCardHeader
              title={type.name}
              description={type.description ?? `/${type.slug}`}
            />
            <CompactCardBody>
              <p className="text-sm">
                {type.entryCount} entries · {type.fields.length} fields
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {type.fields.map((field) => (
                  <Badge key={field.key} variant="secondary">
                    {field.label}: {field.type}
                  </Badge>
                ))}
              </div>
            </CompactCardBody>
          </CompactCard>
        ))}
      </div>
    </div>
  );
}

function MediaView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['website', 'media'], queryFn: fetchWebsiteMedia });
  const folders = useQuery({
    queryKey: ['website', 'media-folders'],
    queryFn: fetchWebsiteMediaFolders,
  });
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [search, setSearch] = useState('');
  const [folderName, setFolderName] = useState('');
  const upload = useMutation({
    mutationFn: () => uploadWebsiteMedia(file!, altText),
    onSuccess: () => {
      setFile(null);
      setAltText('');
      onMessage('Media uploaded. Keep hero images under 500KB WebP when possible (max 5MB).');
      void queryClient.invalidateQueries({ queryKey: ['website', 'media'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Media upload failed')),
  });
  const remove = useMutation({
    mutationFn: deleteWebsiteMedia,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['website', 'media'] }),
    onError: (error) => onMessage(apiErrorMessage(error, 'Media could not be deleted')),
  });
  const createFolder = useMutation({
    mutationFn: () => createWebsiteMediaFolder({ name: folderName }),
    onSuccess: () => {
      setFolderName('');
      onMessage('Folder created.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'media-folders'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not create folder')),
  });
  const saveMeta = useMutation({
    mutationFn: ({ id, tags, caption }: { id: string; tags: string[]; caption: string }) =>
      updateWebsiteMediaMeta(id, { tags, caption }),
    onSuccess: () => {
      onMessage('Media metadata saved.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'media'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not update media')),
  });
  if (!query.data) return <QueryState loading={query.isLoading} error={query.error} />;
  const filtered = query.data.filter((asset) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      asset.fileName.toLowerCase().includes(q) ||
      (asset.altText ?? '').toLowerCase().includes(q) ||
      (asset.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
    );
  });
  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="Upload media"
          description="Folders, tags, alt text, and captions for the media library."
        />
        <CompactCardBody className="grid max-w-3xl gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <Input
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            placeholder="Alternative text"
          />
          <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
            Upload
          </Button>
          <Input
            className="sm:col-span-2"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, alt, or tag"
          />
          <div className="flex gap-2 sm:col-span-3">
            <Input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="New folder name"
            />
            <Button
              variant="outline"
              disabled={!folderName.trim() || createFolder.isPending}
              onClick={() => createFolder.mutate()}
            >
              Add folder
            </Button>
          </div>
          {(folders.data ?? []).length ? (
            <p className="sm:col-span-3 text-xs text-muted-foreground">
              Folders: {(folders.data ?? []).map((folder) => folder.name).join(', ')}
            </p>
          ) : null}
        </CompactCardBody>
      </CompactCard>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((asset) => (
          <CompactCard key={asset.id}>
            <CompactCardBody className="space-y-2">
              {asset.mimeType.startsWith('image/') ? (
                <Image
                  unoptimized
                  width={640}
                  height={360}
                  src={asset.publicUrl}
                  alt={asset.altText ?? ''}
                  className="aspect-video w-full rounded-md bg-muted object-cover"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-md bg-muted">
                  <FileText />
                </div>
              )}
              <p className="truncate text-sm font-medium">{asset.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {asset.altText || 'No alternative text'} · {formatBytes(asset.size)}
              </p>
              <Input
                defaultValue={(asset.tags ?? []).join(', ')}
                placeholder="tags, comma, separated"
                aria-label={`Tags for ${asset.fileName}`}
                onBlur={(event) =>
                  saveMeta.mutate({
                    id: asset.id,
                    tags: event.target.value
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                    caption: asset.caption ?? '',
                  })
                }
              />
              <Button size="sm" variant="outline" onClick={() => remove.mutate(asset.id)}>
                Delete
              </Button>
            </CompactCardBody>
          </CompactCard>
        ))}
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function HeroSliderView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['website', 'hero-slides'], queryFn: fetchWebsiteHeroSlides });
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['website', 'hero-slides'] });

  const create = useMutation({
    mutationFn: () => createWebsiteHeroSlide(file!, altText || file!.name),
    onSuccess: () => {
      setFile(null);
      setAltText('');
      onMessage('Hero slide added. It appears on the public homepage within a few minutes.');
      invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Hero slide upload failed')),
  });

  const reorder = useMutation({
    mutationFn: (items: WebsiteHeroSlide[]) =>
      reorderWebsiteHeroSlides(items.map((item) => item.id)),
    onSuccess: () => {
      onMessage('Hero slide order saved.');
      invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not reorder hero slides')),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<WebsiteHeroSlide> }) =>
      updateWebsiteHeroSlide(id, payload),
    onSuccess: () => invalidate(),
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not update hero slide')),
  });

  const uploadMobile = useMutation({
    mutationFn: ({ id, mobile }: { id: string; mobile: File }) =>
      uploadWebsiteHeroSlideMobile(id, mobile),
    onSuccess: () => {
      onMessage('Mobile crop uploaded.');
      invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Mobile image upload failed')),
  });

  const remove = useMutation({
    mutationFn: deleteWebsiteHeroSlide,
    onSuccess: () => {
      onMessage('Hero slide removed.');
      invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not delete hero slide')),
  });

  if (!query.data) return <QueryState loading={query.isLoading} error={query.error} />;

  const oversized = file && file.size > 500 * 1024;

  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="Homepage hero slider"
          description="Upload campus photos for the public website carousel. Drag to reorder. Prefer WebP/JPG under 500 KB (max 5 MB)."
        />
        <CompactCardBody className="space-y-3">
          <div className="grid max-w-3xl gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <Input
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              placeholder="Alt text (campus description)"
            />
            <Button disabled={!file || create.isPending} onClick={() => create.mutate()}>
              <Plus className="mr-2 h-4 w-4" />
              Add slide
            </Button>
          </div>
          {file ? (
            <p className={cn('text-xs', oversized ? 'text-amber-700' : 'text-muted-foreground')}>
              Selected: {file.name} · {formatBytes(file.size)}
              {oversized
                ? ' — large files slow the homepage. Compress to under 500 KB when possible.'
                : ' — good size for web.'}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Tip: desktop ~1600–1920px wide; optional mobile crop ~800–1080px. Active slides appear
              on the college website automatically.
            </p>
          )}
        </CompactCardBody>
      </CompactCard>

      {query.data.length ? (
        <ReorderableList
          label="Hero slides"
          items={query.data}
          onReorder={(items) => reorder.mutate(items)}
          renderItem={(slide) => (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Image
                unoptimized
                width={220}
                height={124}
                src={slide.desktopUrl}
                alt={slide.altText}
                className="aspect-video w-full max-w-[220px] rounded-md bg-muted object-cover"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={slide.isActive ? 'default' : 'secondary'}>
                    {slide.isActive ? 'Active' : 'Hidden'}
                  </Badge>
                  {slide.mobileUrl ? <Badge variant="outline">Mobile crop</Badge> : null}
                </div>
                <Input
                  defaultValue={slide.altText}
                  aria-label={`Alt text for slide ${slide.position + 1}`}
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (next !== slide.altText) {
                      update.mutate({ id: slide.id, payload: { altText: next } });
                    }
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update.mutate({
                        id: slide.id,
                        payload: { isActive: !slide.isActive },
                      })
                    }
                  >
                    {slide.isActive ? 'Hide' : 'Show'}
                  </Button>
                  <label className="inline-flex cursor-pointer items-center">
                    <span className="sr-only">Upload mobile image</span>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="max-w-[220px]"
                      onChange={(event) => {
                        const mobile = event.target.files?.[0];
                        if (mobile) uploadMobile.mutate({ id: slide.id, mobile });
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remove.mutate(slide.id)}
                    disabled={remove.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        />
      ) : (
        <CompactCard>
          <CompactCardBody>
            <p className="text-sm text-muted-foreground">
              No hero slides yet. Upload the first campus photo above. Until then, the public site
              uses its built-in fallback images.
            </p>
          </CompactCardBody>
        </CompactCard>
      )}
    </div>
  );
}

function PublishingView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [scheduledAt, setScheduledAt] = useState('');
  const revisions = useQuery({
    queryKey: ['website', 'revisions'],
    queryFn: fetchWebsiteRevisions,
  });
  const pages = useQuery({ queryKey: ['website', 'pages'], queryFn: fetchWebsitePages });
  const publish = useMutation({
    mutationFn: (pageId?: string) =>
      publishWebsite({
        pageId,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      onMessage(scheduledAt ? 'Publication scheduled.' : 'Website published.');
      void queryClient.invalidateQueries({ queryKey: ['website'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Publish failed')),
  });
  const restore = useMutation({
    mutationFn: restoreWebsiteRevision,
    onSuccess: () => {
      onMessage('Revision restored as a new draft.');
      void queryClient.invalidateQueries({ queryKey: ['website'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Revision could not be restored')),
  });
  const preview = useMutation({
    mutationFn: (pageId?: string) => createWebsitePreview(pageId),
    onSuccess: (result) => window.open(result.url, '_blank', 'noopener,noreferrer'),
    onError: (error) => onMessage(apiErrorMessage(error, 'Preview could not be created')),
  });
  const loading = revisions.isLoading || pages.isLoading;
  const error = revisions.error || pages.error;
  if (loading || error) return <QueryState loading={loading} error={error} />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CompactCard>
        <CompactCardHeader
          title="Preview & publish"
          description="Preview draft changes, publish immediately, or schedule a release."
        />
        <CompactCardBody className="space-y-3">
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            aria-label="Scheduled publication time"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => preview.mutate(undefined)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview site
            </Button>
            <Button onClick={() => publish.mutate(undefined)} disabled={publish.isPending}>
              <Rocket className="mr-2 h-4 w-4" />
              {scheduledAt ? 'Schedule site' : 'Publish site'}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                revalidateWebsite(['/', '/news', '/sitemap.xml'])
                  .then((result) =>
                    onMessage(
                      result.webhookConfigured
                        ? 'Revalidation requested.'
                        : 'Publish saved; configure WEBSITE_REVALIDATE_WEBHOOK_URL for on-demand ISR.',
                    ),
                  )
                  .catch((error) => onMessage(apiErrorMessage(error, 'Revalidation failed')))
              }
            >
              Revalidate public site
            </Button>
          </div>
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="font-medium">Reviewer queue</p>
            <p className="text-xs text-muted-foreground">
              Pages in Draft → In Review → Publish workflow
            </p>
            <div className="mt-2 space-y-1">
              {(pages.data ?? [])
                .filter((page) => page.status === 'IN_REVIEW' || page.status === 'DRAFT')
                .map((page) => (
                  <div key={page.id} className="flex items-center justify-between gap-2">
                    <span>
                      {page.title} · {page.status}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateWebsitePage(page.id, {
                          ...page,
                          status: page.status === 'DRAFT' ? 'IN_REVIEW' : 'PUBLISHED',
                        }).then(() => {
                          onMessage(
                            page.status === 'DRAFT'
                              ? 'Submitted for review.'
                              : 'Approved & published.',
                          );
                          void queryClient.invalidateQueries({ queryKey: ['website', 'pages'] });
                        })
                      }
                    >
                      {page.status === 'DRAFT' ? 'Submit review' : 'Approve'}
                    </Button>
                  </div>
                ))}
            </div>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            {(pages.data ?? []).map((page) => (
              <div
                key={page.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
              >
                <div>
                  <p className="font-medium">{page.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {page.status} · updated {formatDate(page.updatedAt)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => preview.mutate(page.id)}>
                    Preview
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => publish.mutate(page.id)}>
                    Publish
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader
          title="Revision history"
          description="Restoring creates a new draft and does not overwrite published content."
        />
        <CompactCardBody className="space-y-2">
          {(revisions.data ?? []).map((revision) => (
            <div
              key={revision.id}
              className="flex items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0"
            >
              <div>
                <p className="font-medium">
                  {revision.entityType} v{revision.version} · {revision.action}
                </p>
                <p className="text-xs text-muted-foreground">
                  {revision.actorName || 'System'} · {formatDate(revision.createdAt)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={restore.isPending}
                onClick={() => restore.mutate(revision.id)}
              >
                Restore draft
              </Button>
            </div>
          ))}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function DepartmentsPublishView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const departments = useQuery({
    queryKey: ['website', 'academic-departments'],
    queryFn: fetchWebsiteAcademicDepartments,
  });
  const sources = useQuery({
    queryKey: ['website', 'content-sources'],
    queryFn: fetchWebsiteContentSources,
  });
  const publishAll = useMutation({
    mutationFn: publishAllWebsiteAcademicDepartments,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['website', 'academic-departments'] });
      onMessage(
        `Published ${result.departmentsPublished} departments and ${result.staffPublished} faculty profiles to the website.`,
      );
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not publish departments')),
  });
  const saveSource = useMutation({
    mutationFn: (mode: 'MANUAL' | 'ERP') =>
      updateWebsiteContentSources({
        ...(sources.data ?? {}),
        departments: mode === 'ERP' ? { mode: 'ERP', adapter: 'department' } : { mode: 'MANUAL' },
      }),
    onSuccess: () => {
      onMessage('Departments content source updated.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'content-sources'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not update source')),
  });
  const upsert = useMutation({
    mutationFn: ({
      departmentId,
      payload,
    }: {
      departmentId: string;
      payload: Record<string, unknown>;
    }) => upsertWebsiteAcademicDepartment(departmentId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['website', 'academic-departments'] });
      onMessage('Department website profile updated.');
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not update department')),
  });

  if (!departments.data) {
    return <QueryState loading={departments.isLoading} error={departments.error} />;
  }
  const sourceMode = (sources.data?.departments as { mode?: string } | undefined)?.mode ?? 'ERP';

  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="Academic departments on the public website"
          description="Publish ERP departments, HOD, faculty and programmes to /departments without duplicating content. Toggle MANUAL for CMS-only institutions."
        />
        <CompactCardBody className="flex flex-wrap items-center gap-3">
          <Button onClick={() => publishAll.mutate()} disabled={publishAll.isPending}>
            <GraduationCap className="mr-2 h-4 w-4" />
            {publishAll.isPending ? 'Publishing…' : 'Publish all academic departments'}
          </Button>
          <Button
            variant={sourceMode === 'MANUAL' ? 'default' : 'outline'}
            size="sm"
            disabled={saveSource.isPending}
            onClick={() => saveSource.mutate('MANUAL')}
          >
            Manual CMS
          </Button>
          <Button
            variant={sourceMode === 'ERP' ? 'default' : 'outline'}
            size="sm"
            disabled={saveSource.isPending}
            onClick={() => saveSource.mutate('ERP')}
          >
            Sync from ERP
          </Button>
          <p className="text-sm text-muted-foreground">
            Source: {sourceMode}. Creates website profiles, sets public slugs, and marks teaching
            staff as visible.
          </p>
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader
          title="Department visibility"
          description="Toggle individual departments and set category or slug."
        />
        <CompactCardBody className="space-y-2">
          {departments.data.map((dept) => {
            const published = Boolean(dept.profile?.showOnWebsite);
            return (
              <div
                key={dept.departmentId}
                className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{dept.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {dept.code}
                    {dept.hodName ? ` · HOD ${dept.hodName}` : ''}
                    {` · ${dept.counts.staffMembers} staff · ${dept.counts.students} students · ${dept.counts.programs} programmes`}
                    {dept.profile?.slug ? ` · /departments/${dept.profile.slug}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={published ? 'default' : 'secondary'}>
                    {published ? 'On website' : 'Hidden'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={upsert.isPending}
                    onClick={() =>
                      upsert.mutate({
                        departmentId: dept.departmentId,
                        payload: {
                          showOnWebsite: !published,
                          slug: dept.profile?.slug || dept.suggestedSlug,
                          category: dept.profile?.category || dept.suggestedCategory || 'ARTS',
                          tagline: dept.profile?.tagline || `Department of ${dept.name}`,
                        },
                      })
                    }
                  >
                    {published ? 'Unpublish' : 'Publish'}
                  </Button>
                </div>
              </div>
            );
          })}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function ThemeView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const appearance = useQuery({
    queryKey: ['website', 'appearance'],
    queryFn: fetchWebsiteAppearance,
  });
  const apply = useMutation({
    mutationFn: (presetId: string) => updateWebsiteAppearance({ activeThemePresetId: presetId }),
    onSuccess: () => {
      onMessage('Theme preset applied for this tenant.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'appearance'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not apply theme')),
  });
  if (!appearance.data)
    return <QueryState loading={appearance.isLoading} error={appearance.error} />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {appearance.data.presets.map((preset) => {
        const id = String(preset.id ?? '');
        const active = appearance.data.activePresetId === id;
        return (
          <CompactCard key={id}>
            <CompactCardHeader
              title={String(preset.name ?? id)}
              description={active ? 'Active preset' : 'Institution theme preset'}
            />
            <CompactCardBody className="space-y-2 text-sm">
              <p>Primary: {String(preset.primaryColor ?? '')}</p>
              <p>Secondary: {String(preset.secondaryColor ?? '')}</p>
              <p>Font: {String(preset.fontFamily ?? '')}</p>
              <Button
                size="sm"
                variant={active ? 'default' : 'outline'}
                disabled={apply.isPending}
                onClick={() => apply.mutate(id)}
              >
                {active ? 'Active' : 'Apply'}
              </Button>
            </CompactCardBody>
          </CompactCard>
        );
      })}
    </div>
  );
}

function HeaderCtasView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const content = useQuery({
    queryKey: ['website', 'homepage-content'],
    queryFn: fetchWebsiteHomepageContent,
  });
  const [draft, setDraft] = useState({
    erpLabel: 'ERP Login',
    erpHref: 'https://erp.donboscocollege.ac.in',
    admissionLabel: 'Online Admission',
    admissionHref: '/admission/apply',
    appLabel: 'Mobile App',
    appHref:
      'https://play.google.com/store/apps/details?id=edu.onecampus.mobile&pcampaignid=web_share',
  });
  useEffect(() => {
    const headerCtas = content.data?.headerCtas;
    if (!headerCtas || typeof headerCtas !== 'object') return;
    const value = headerCtas as {
      erpLogin?: { label?: string; href?: string };
      onlineAdmission?: { label?: string; href?: string };
      mobileApp?: { label?: string; href?: string };
      secondary?: { label?: string; href?: string };
      primary?: { label?: string; href?: string };
    };
    const secondaryLooksLikeApp = /play\.google\.com|mobile.?app/i.test(
      `${value.secondary?.label ?? ''} ${value.secondary?.href ?? ''}`,
    );
    setDraft({
      erpLabel:
        value.erpLogin?.label?.trim() ||
        (!secondaryLooksLikeApp ? value.secondary?.label?.trim() : '') ||
        'ERP Login',
      erpHref:
        value.erpLogin?.href?.trim() ||
        (!secondaryLooksLikeApp ? value.secondary?.href?.trim() : '') ||
        'https://erp.donboscocollege.ac.in',
      admissionLabel:
        value.onlineAdmission?.label?.trim() || value.primary?.label?.trim() || 'Online Admission',
      admissionHref:
        value.onlineAdmission?.href?.trim() || value.primary?.href?.trim() || '/admission/apply',
      appLabel:
        value.mobileApp?.label?.trim() ||
        (secondaryLooksLikeApp ? value.secondary?.label?.trim() : '') ||
        'Mobile App',
      appHref:
        value.mobileApp?.href?.trim() ||
        (secondaryLooksLikeApp ? value.secondary?.href?.trim() : '') ||
        'https://play.google.com/store/apps/details?id=edu.onecampus.mobile&pcampaignid=web_share',
    });
  }, [content.data]);
  const save = useMutation({
    mutationFn: () =>
      updateWebsiteHomepageContent({
        headerCtas: {
          erpLogin: {
            label: draft.erpLabel.trim() || 'ERP Login',
            href: draft.erpHref.trim(),
          },
          onlineAdmission: {
            label: draft.admissionLabel.trim() || 'Online Admission',
            href: draft.admissionHref.trim(),
          },
          mobileApp: {
            label: draft.appLabel.trim() || 'Mobile App',
            href: draft.appHref.trim(),
          },
        },
      }),
    onSuccess: () => {
      onMessage('Header button URLs saved.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'homepage-content'] });
      void queryClient.invalidateQueries({ queryKey: ['website', 'appearance'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save header buttons')),
  });
  if (!content.data) return <QueryState loading={content.isLoading} error={content.error} />;
  return (
    <CompactCard>
      <CompactCardHeader
        title="Header buttons"
        description="ERP Login and Online Admission sit on the navy brand bar. Mobile App (with Play Store icon) sits on the white nav bar next to search. All labels and URLs are editable here."
      />
      <CompactCardBody className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">ERP Login label</span>
          <Input
            value={draft.erpLabel}
            onChange={(event) => setDraft({ ...draft, erpLabel: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">ERP Login URL</span>
          <Input
            value={draft.erpHref}
            onChange={(event) => setDraft({ ...draft, erpHref: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Online Admission label</span>
          <Input
            value={draft.admissionLabel}
            onChange={(event) => setDraft({ ...draft, admissionLabel: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Online Admission URL</span>
          <Input
            value={draft.admissionHref}
            onChange={(event) => setDraft({ ...draft, admissionHref: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Mobile App label</span>
          <Input
            value={draft.appLabel}
            onChange={(event) => setDraft({ ...draft, appLabel: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Mobile App / Play Store URL</span>
          <Input
            value={draft.appHref}
            onChange={(event) => setDraft({ ...draft, appHref: event.target.value })}
          />
        </label>
        <div className="md:col-span-2">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save header buttons
          </Button>
        </div>
      </CompactCardBody>
    </CompactCard>
  );
}

function FooterWidgetsView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const content = useQuery({
    queryKey: ['website', 'homepage-content'],
    queryFn: fetchWebsiteHomepageContent,
  });
  const [footer, setFooter] = useState<Record<string, string>>({});
  useEffect(() => {
    if (content.data && content.data.footer && typeof content.data.footer === 'object') {
      setFooter(content.data.footer as Record<string, string>);
    }
  }, [content.data]);
  const save = useMutation({
    mutationFn: () => updateWebsiteHomepageContent({ footer }),
    onSuccess: () => {
      onMessage('Footer content saved.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'homepage-content'] });
      void queryClient.invalidateQueries({ queryKey: ['website', 'appearance'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save footer')),
  });
  if (!content.data) return <QueryState loading={content.isLoading} error={content.error} />;
  const field = (key: string, label: string, multiline = false) => (
    <label key={key} className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea
          className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={footer[key] ?? ''}
          onChange={(event) => setFooter({ ...footer, [key]: event.target.value })}
        />
      ) : (
        <Input
          value={footer[key] ?? ''}
          onChange={(event) => setFooter({ ...footer, [key]: event.target.value })}
        />
      )}
    </label>
  );
  return (
    <CompactCard>
      <CompactCardHeader
        title="Footer"
        description="Structured footer copy and CTAs. Menu links still come from the FOOTER menu builder."
      />
      <CompactCardBody className="grid gap-3 md:grid-cols-2">
        {field('brandTagline', 'Identity tagline')}
        {field('collegeName', 'College name')}
        {field('kicker', 'Legacy CTA kicker (optional)')}
        {field('ctaTitle', 'Admissions button label')}
        <div className="md:col-span-2">{field('ctaBody', 'Admissions supporting line', true)}</div>
        {field('applyLabel', 'Apply link label')}
        {field('applyHref', 'Apply URL')}
        {field('prospectusLabel', 'Prospectus label')}
        {field('prospectusHref', 'Prospectus URL')}
        <div className="md:col-span-2">{field('mission', 'Mission', true)}</div>
        {field('affiliationTitle', 'Affiliation title')}
        <div className="md:col-span-2">
          {field('affiliationDetail', 'Affiliation detail (use line breaks)', true)}
        </div>
        {field('accreditationTitle', 'Accreditation title')}
        <div className="md:col-span-2">
          {field('accreditationDetail', 'Accreditation detail (use line breaks)', true)}
        </div>
        <div className="md:col-span-2">{field('affiliation', 'Full affiliation blurb', true)}</div>
        {field('contactEmail', 'Email')}
        {field('emailNote', 'Email note')}
        {field('contactPhone', 'Phone')}
        {field('officeHours', 'Office hours')}
        <div className="md:col-span-2">{field('address', 'Address (use line breaks)', true)}</div>
        {field('copyright', 'Copyright name')}
        <div className="md:col-span-2">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save footer
          </Button>
        </div>
      </CompactCardBody>
    </CompactCard>
  );
}

function SeoSuiteView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const appearance = useQuery({
    queryKey: ['website', 'appearance'],
    queryFn: fetchWebsiteAppearance,
  });
  const redirects = useQuery({
    queryKey: ['website', 'redirects'],
    queryFn: fetchWebsiteRedirects,
  });
  const [seoDraft, setSeoDraft] = useState(
    '{"defaultTitle":"","defaultDescription":"","ogImage":""}',
  );
  const [fromPath, setFromPath] = useState('');
  const [toPath, setToPath] = useState('');
  useEffect(() => {
    if (appearance.data) setSeoDraft(JSON.stringify(appearance.data.seoDefaults ?? {}, null, 2));
  }, [appearance.data]);
  const saveSeo = useMutation({
    mutationFn: () =>
      updateWebsiteAppearance({ seoDefaults: JSON.parse(seoDraft) as Record<string, unknown> }),
    onSuccess: () => onMessage('SEO defaults saved.'),
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save SEO defaults')),
  });
  const createRedirect = useMutation({
    mutationFn: () => upsertWebsiteRedirect({ fromPath, toPath, statusCode: 301, isActive: true }),
    onSuccess: () => {
      setFromPath('');
      setToPath('');
      onMessage('Redirect saved.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'redirects'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save redirect')),
  });
  const removeRedirect = useMutation({
    mutationFn: deleteWebsiteRedirect,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['website', 'redirects'] }),
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not delete redirect')),
  });
  if (!appearance.data)
    return <QueryState loading={appearance.isLoading} error={appearance.error} />;
  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="SEO defaults"
          description="Site-wide meta defaults. Per-page SEO is on the Pages editor."
        />
        <CompactCardBody className="space-y-3">
          <textarea
            className="min-h-36 w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
            value={seoDraft}
            onChange={(event) => setSeoDraft(event.target.value)}
          />
          <Button onClick={() => saveSeo.mutate()} disabled={saveSeo.isPending}>
            Save SEO defaults
          </Button>
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader
          title="Redirects"
          description="301/302 path redirects for the public site."
        />
        <CompactCardBody className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={fromPath}
              onChange={(event) => setFromPath(event.target.value)}
              placeholder="/old-path"
            />
            <Input
              value={toPath}
              onChange={(event) => setToPath(event.target.value)}
              placeholder="/new-path"
            />
            <Button
              disabled={!fromPath || !toPath || createRedirect.isPending}
              onClick={() => createRedirect.mutate()}
            >
              Add
            </Button>
          </div>
          {(redirects.data ?? []).map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0"
            >
              <span>
                {row.fromPath} → {row.toPath} ({row.statusCode})
              </span>
              <Button size="sm" variant="ghost" onClick={() => removeRedirect.mutate(row.id)}>
                Delete
              </Button>
            </div>
          ))}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function CalendarVisibilityView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const items = useQuery({
    queryKey: ['website', 'calendar-items'],
    queryFn: fetchWebsiteCalendarItems,
  });
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('Academic');
  const save = useMutation({
    mutationFn: (next: Array<Record<string, unknown>>) => updateWebsiteCalendarItems(next),
    onSuccess: () => {
      onMessage('Calendar website visibility saved. Homepage Upcoming Events reads this adapter.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'calendar-items'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save calendar items')),
  });
  if (!items.data) return <QueryState loading={items.isLoading} error={items.error} />;
  const rows = items.data;
  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="Academic Calendar → Website"
          description="Mark ERP/calendar items for the public site. Homepage does not use a separate CMS event form."
        />
        <CompactCardBody className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Event title"
          />
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Category"
          />
          <Button
            disabled={!title || !date || save.isPending}
            onClick={() =>
              save.mutate([
                ...rows,
                {
                  id: `cal-${Date.now()}`,
                  title,
                  date,
                  category,
                  showOnWebsite: true,
                  featured: false,
                  source: 'ERP',
                },
              ])
            }
          >
            Add / sync item
          </Button>
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader title="Website-visible events" />
        <CompactCardBody className="space-y-2">
          {rows.map((row, index) => (
            <div
              key={String(row.id ?? index)}
              className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
            >
              <div>
                <p className="font-medium">{String(row.title ?? 'Event')}</p>
                <p className="text-xs text-muted-foreground">
                  {String(row.date ?? '')} · {String(row.category ?? 'Academic')} ·{' '}
                  {row.showOnWebsite === false ? 'Hidden' : 'On website'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    save.mutate(
                      rows.map((item, i) =>
                        i === index
                          ? { ...item, showOnWebsite: item.showOnWebsite === false }
                          : item,
                      ),
                    )
                  }
                >
                  Toggle
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => save.mutate(rows.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {!rows.length ? (
            <p className="text-sm text-muted-foreground">
              No calendar items yet. Sync or add items marked Show on website.
            </p>
          ) : null}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function MediaCollectionsView({
  kind,
  onMessage,
}: {
  kind: 'gallery' | 'documents' | 'videos' | string;
  onMessage: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['website', 'media'], queryFn: fetchWebsiteMedia });
  const [albumTag, setAlbumTag] = useState(
    kind === 'gallery' ? 'gallery' : kind === 'documents' ? 'download' : 'video',
  );
  if (!query.data) return <QueryState loading={query.isLoading} error={query.error} />;
  const filtered = query.data.filter((asset) => {
    const tags = asset.tags ?? [];
    if (kind === 'gallery') {
      return (
        asset.mimeType.startsWith('image/') &&
        (tags.includes('gallery') || tags.includes(albumTag) || !tags.length)
      );
    }
    if (kind === 'videos') return asset.mimeType.startsWith('video/') || tags.includes('video');
    if (kind === 'documents') {
      return (
        (!asset.mimeType.startsWith('image/') && !asset.mimeType.startsWith('video/')) ||
        tags.includes('download') ||
        tags.includes('document')
      );
    }
    return true;
  });
  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title={
            kind === 'gallery'
              ? 'Gallery albums'
              : kind === 'videos'
                ? 'Videos'
                : 'Downloads / Documents'
          }
          description="Tag media with gallery, download, or video. Public gallery/homepage read tagged assets from the media library."
        />
        <CompactCardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              value={albumTag}
              onChange={(event) => setAlbumTag(event.target.value)}
              placeholder="Album / collection tag"
            />
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/website/media">Open Media Library</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{filtered.length} matching assets</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.slice(0, 24).map((asset) => (
              <div key={asset.id} className="rounded-md border border-border p-2 text-sm">
                <p className="truncate font-medium">{asset.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {(asset.tags ?? []).join(', ') || 'No tags'}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() =>
                    updateWebsiteMediaMeta(asset.id, {
                      tags: Array.from(new Set([...(asset.tags ?? []), albumTag])),
                    }).then(() => {
                      onMessage(`Tagged ${asset.fileName} with ${albumTag}`);
                      void queryClient.invalidateQueries({ queryKey: ['website', 'media'] });
                    })
                  }
                >
                  Tag as {albumTag}
                </Button>
              </div>
            ))}
          </div>
        </CompactCardBody>
      </CompactCard>
      <MediaView onMessage={onMessage} />
    </div>
  );
}

function AcademicSourceView({
  section,
  onMessage,
}: {
  section: string;
  onMessage: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const sources = useQuery({
    queryKey: ['website', 'content-sources'],
    queryFn: fetchWebsiteContentSources,
  });
  const key =
    section === 'faculty' ? 'faculty' : section === 'programmes' ? 'programmes' : 'departments';
  const save = useMutation({
    mutationFn: (mode: 'MANUAL' | 'ERP') =>
      updateWebsiteContentSources({
        ...(sources.data ?? {}),
        [key]:
          mode === 'ERP'
            ? {
                mode: 'ERP',
                adapter:
                  key === 'faculty' ? 'staff' : key === 'programmes' ? 'programme' : 'department',
              }
            : { mode: 'MANUAL' },
      }),
    onSuccess: () => {
      onMessage(`${key} source updated. Manual publishes without ERP; ERP sync is opt-in.`);
      void queryClient.invalidateQueries({ queryKey: ['website', 'content-sources'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not update source')),
  });
  if (!sources.data) return <QueryState loading={sources.isLoading} error={sources.error} />;
  const current = (sources.data[key] as { mode?: string } | undefined)?.mode ?? 'ERP';
  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title={section === 'faculty' ? 'Faculty Profiles' : 'Programmes'}
          description="CMS-first with optional ERP sync. Public pages prefer CMS overrides when MANUAL."
        />
        <CompactCardBody className="space-y-3">
          <p className="text-sm">
            Current source: <strong>{current}</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={current === 'MANUAL' ? 'default' : 'outline'}
              disabled={save.isPending}
              onClick={() => save.mutate('MANUAL')}
            >
              Manual CMS
            </Button>
            <Button
              variant={current === 'ERP' ? 'default' : 'outline'}
              disabled={save.isPending}
              onClick={() => save.mutate('ERP')}
            >
              Sync from ERP
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/website/departments">Manage departments / faculty visibility</Link>
            </Button>
          </div>
        </CompactCardBody>
      </CompactCard>
      {section === 'faculty' || section === 'programmes' ? (
        <DepartmentsPublishView onMessage={onMessage} />
      ) : null}
    </div>
  );
}

function CptModuleView({
  slug,
  onMessage,
}: {
  slug: string;
  onMessage: (message: string) => void;
}) {
  const typeSlug = slug === 'flash-news' ? 'flash-news' : slug;
  return <ContentEntriesEditor typeSlug={typeSlug} onMessage={onMessage} />;
}

function BloodDonorsView() {
  const donors = useQuery({
    queryKey: ['website', 'blood-donors'],
    queryFn: () => fetchWebsiteBloodDonors({ take: 100 }),
  });

  if (!donors.data) return <QueryState loading={donors.isLoading} error={donors.error} />;

  return (
    <CompactCard>
      <CompactCardHeader
        title="Blood donor registrations"
        description={`${donors.data.total} registration${donors.data.total === 1 ? '' : 's'} from the public college website.`}
      />
      <CompactCardBody className="space-y-2">
        {!donors.data.items.length ? (
          <p className="text-sm text-muted-foreground">No blood donor registrations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-semibold">Name</th>
                  <th className="px-2 py-2 font-semibold">Blood group</th>
                  <th className="px-2 py-2 font-semibold">Phone</th>
                  <th className="px-2 py-2 font-semibold">Email</th>
                  <th className="px-2 py-2 font-semibold">Preferred</th>
                  <th className="px-2 py-2 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {donors.data.items.map((donor) => (
                  <tr key={donor.id} className="border-b border-border/70 align-top">
                    <td className="px-2 py-2 font-medium text-foreground">{donor.fullName}</td>
                    <td className="px-2 py-2">
                      <Badge variant="secondary">{donor.bloodGroup}</Badge>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{donor.phone}</td>
                    <td className="px-2 py-2 text-muted-foreground">{donor.email}</td>
                    <td className="px-2 py-2 text-muted-foreground">{donor.preferredContact}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {new Date(donor.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CompactCardBody>
    </CompactCard>
  );
}

function FyugInterestStatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function FyugInterestCountBox({
  title,
  items,
  empty,
}: {
  title: string;
  items: { label: string; value: number }[];
  empty: string;
}) {
  return (
    <CompactCard>
      <CompactCardHeader title={title} />
      <CompactCardBody>
        {items.length ? (
          <ul className="divide-y divide-border/70">
            {items.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-3 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate text-foreground">{item.label}</span>
                <span className="shrink-0 tabular-nums font-semibold text-foreground">
                  {item.value}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CompactCardBody>
    </CompactCard>
  );
}

function FyugInterestView() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const rows = useQuery({
    queryKey: ['website', 'fyug-interest'],
    queryFn: () => fetchWebsiteFyugInterests({ take: 500 }),
  });
  const stats = useQuery({
    queryKey: ['website', 'fyug-interest', 'stats'],
    queryFn: fetchWebsiteFyugInterestStats,
  });

  if (!rows.data) return <QueryState loading={rows.isLoading} error={rows.error} />;

  const s = stats.data;

  return (
    <div className="space-y-4">
      {s ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FyugInterestStatCard label="Total applied" value={s.total} />
            <FyugInterestStatCard label="Today" value={s.today} />
            <FyugInterestStatCard label="Eligible" value={s.eligible} />
            <FyugInterestStatCard label="Rejected" value={s.rejected} />
            <FyugInterestStatCard label="Pending" value={s.pending} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FyugInterestCountBox
              title="Honours-wise"
              items={s.byHonours}
              empty="No honours data yet."
            />
            <FyugInterestCountBox
              title="College-wise"
              items={s.byCollege}
              empty="No college data yet."
            />
            <FyugInterestCountBox
              title="Major subject"
              items={s.byMajor}
              empty="No major subject data yet."
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <FyugInterestCountBox
                title="State-wise"
                items={s.byState}
                empty="No state data yet."
              />
              <FyugInterestCountBox
                title="Gender-wise"
                items={s.byGender}
                empty="No gender data yet."
              />
            </div>
          </div>
        </>
      ) : stats.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading registration summary…</p>
      ) : stats.error ? (
        <p className="text-sm text-destructive">Could not load registration summary.</p>
      ) : null}

      <CompactCard>
        <CompactCardHeader
          title="FYUG 4th-year interest registrations"
          description={`${rows.data.total} registration${rows.data.total === 1 ? '' : 's'} for Fourth-Year Honours 2026.`}
        />
        <CompactCardBody className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={exporting || !rows.data.items.length}
              onClick={async () => {
                setExporting(true);
                setMessage('');
                try {
                  await downloadWebsiteFyugInterestExcel();
                  setMessage('Excel report downloaded.');
                } catch {
                  setMessage('Could not download Excel report.');
                } finally {
                  setExporting(false);
                }
              }}
            >
              {exporting ? 'Preparing…' : 'Download Excel report'}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
          {!rows.data.items.length ? (
            <p className="text-sm text-muted-foreground">No FYUG interest registrations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-semibold">App No</th>
                    <th className="px-2 py-2 font-semibold">Name</th>
                    <th className="px-2 py-2 font-semibold">Honours</th>
                    <th className="px-2 py-2 font-semibold">Major / Minor</th>
                    <th className="px-2 py-2 font-semibold">Mobile</th>
                    <th className="px-2 py-2 font-semibold">Email</th>
                    <th className="px-2 py-2 font-semibold">Status</th>
                    <th className="px-2 py-2 font-semibold">Submitted</th>
                    <th className="px-2 py-2 font-semibold">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.data.items.map((row) => (
                    <tr key={row.id} className="border-b border-border/70 align-top">
                      <td className="px-2 py-2 font-medium text-foreground">
                        {row.applicationNumber || '—'}
                      </td>
                      <td className="px-2 py-2 font-medium text-foreground">{row.fullName}</td>
                      <td className="px-2 py-2">
                        <Badge variant="secondary">{row.applyingHonoursIn}</Badge>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {row.majorCourse} / {row.minorCourse}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{row.mobile}</td>
                      <td className="px-2 py-2 text-muted-foreground">{row.email}</td>
                      <td className="px-2 py-2">
                        <Badge variant="outline">{row.status}</Badge>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busyId === row.id}
                          onClick={async () => {
                            setBusyId(row.id);
                            setMessage('');
                            try {
                              await downloadWebsiteFyugInterestPdf(row.id, row.applicationNumber);
                            } catch {
                              setMessage(`Could not download PDF for ${row.fullName}.`);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          {busyId === row.id ? '…' : 'PDF'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function NoticesView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const notices = useQuery({ queryKey: ['website', 'notices'], queryFn: fetchWebsiteNotices });
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<(typeof NOTICE_CATEGORIES)[number]>('GENERAL');
  const [priority, setPriority] = useState<(typeof NOTICE_PRIORITIES)[number]>('NORMAL');
  const [bodyHtml, setBodyHtml] = useState('');
  const create = useMutation({
    mutationFn: () =>
      createWebsiteNotice({
        title,
        category,
        priority,
        bodyHtml,
        status: 'DRAFT',
        showOnHomepage: true,
        isVisible: true,
      }),
    onSuccess: () => {
      setTitle('');
      setBodyHtml('');
      onMessage('Notice created as draft.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'notices'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not create notice')),
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<WebsiteNotice> }) =>
      updateWebsiteNotice(id, payload),
    onSuccess: () => {
      onMessage('Notice updated.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'notices'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not update notice')),
  });
  const remove = useMutation({
    mutationFn: deleteWebsiteNotice,
    onSuccess: () => {
      onMessage('Notice moved to trash.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'notices'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not trash notice')),
  });

  if (!notices.data) return <QueryState loading={notices.isLoading} error={notices.error} />;

  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="Add notice"
          description="Notice Board — publish circulars with priority and expiry."
        />
        <CompactCardBody className="grid gap-3 md:grid-cols-2">
          <Input
            className="md:col-span-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notice title"
          />
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
          >
            {NOTICE_CATEGORIES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
          >
            {NOTICE_PRIORITIES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <div className="md:col-span-2">
            <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
          </div>
          <Button
            className="w-fit"
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Create draft
          </Button>
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader title="All notices" />
        <CompactCardBody className="space-y-2">
          {notices.data.map((notice) => (
            <div
              key={notice.id}
              className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{notice.title}</p>
                <p className="text-xs text-muted-foreground">
                  {notice.priority} · {notice.category} · {notice.status}
                  {notice.showOnHomepage ? ' · Homepage' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({
                      id: notice.id,
                      payload: { status: notice.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' },
                    })
                  }
                >
                  {notice.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({
                      id: notice.id,
                      payload: { showOnHomepage: !notice.showOnHomepage },
                    })
                  }
                >
                  {notice.showOnHomepage ? 'Hide from home' : 'Show on home'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(notice.id)}
                >
                  Trash
                </Button>
              </div>
            </div>
          ))}
          {!notices.data.length ? (
            <p className="text-sm text-muted-foreground">No notices yet.</p>
          ) : null}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function NewsEntriesView({ onMessage }: { onMessage: (message: string) => void }) {
  return <ContentEntriesEditor typeSlug="news" onMessage={onMessage} />;
}

function HomepageBuilderView({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const layout = useQuery({
    queryKey: ['website', 'homepage-layout'],
    queryFn: fetchWebsiteHomepageLayout,
  });
  const [draft, setDraft] = useState<WebsiteHomepageSection[]>([]);
  useEffect(() => {
    if (layout.data) setDraft(layout.data);
  }, [layout.data]);
  const save = useMutation({
    mutationFn: (sections: WebsiteHomepageSection[]) =>
      updateWebsiteHomepageLayout(
        sections.map((section, position) => ({
          sectionKey: section.sectionKey,
          enabled: section.enabled,
          position,
          label: section.label,
          settings: section.settings,
        })),
      ),
    onSuccess: () => {
      onMessage('Homepage layout saved. Public site will render this order.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'homepage-layout'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save homepage layout')),
  });

  if (!layout.data) return <QueryState loading={layout.isLoading} error={layout.error} />;

  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="Homepage Builder"
          description="Drag to reorder. Toggle sections on/off. Editable = section has content editors below or dedicated modules."
        />
        <CompactCardBody className="space-y-3">
          <ReorderableList
            label="Homepage sections"
            items={draft}
            onReorder={(items) => {
              setDraft(items);
              save.mutate(items);
            }}
            renderItem={(section) => {
              const meta = HOMEPAGE_SECTION_CATALOG.find((row) => row.key === section.sectionKey);
              const editable = ![
                'upcomingEvents',
                'noticeBoard',
                'departments',
                'programmes',
                'news',
                'gallery',
                'testimonials',
                'placement',
              ].includes(section.sectionKey);
              return (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {section.label || meta?.label || section.sectionKey}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {meta?.description ?? section.sectionKey}
                      {' · '}
                      {section.enabled ? 'Enabled' : 'Disabled'}
                      {' · '}
                      {editable ? 'Editable' : 'Module / adapter'}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      onChange={(event) => {
                        const next = draft.map((row) =>
                          row.id === section.id ? { ...row, enabled: event.target.checked } : row,
                        );
                        setDraft(next);
                        save.mutate(next);
                      }}
                    />
                    Enabled
                  </label>
                </div>
              );
            }}
          />
          <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate(draft)}>
            Save layout
          </Button>
        </CompactCardBody>
      </CompactCard>
      <HomepageContentEditors onMessage={onMessage} />
    </div>
  );
}
