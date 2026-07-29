import { api } from '@/services/api';
import type {
  WebsiteContentType,
  WebsiteDashboard,
  WebsiteHeroSlide,
  WebsiteMediaAsset,
  WebsiteMenu,
  WebsitePage,
  WebsitePageSection,
  WebsitePreview,
  WebsiteRevision,
  WebsiteSettings,
} from '@/types/website-cms';

const base = '/v1/website/admin';

export const fetchWebsiteDashboard = () =>
  api.get<WebsiteDashboard>(`${base}/dashboard`).then((response) => response.data);

export const fetchWebsiteSettings = () =>
  api.get<WebsiteSettings>(`${base}/settings`).then((response) => response.data);

export const updateWebsiteSettings = (payload: WebsiteSettings) =>
  api.patch<WebsiteSettings>(`${base}/settings`, payload).then((response) => response.data);

export const fetchWebsitePages = () =>
  api.get<WebsitePage[]>(`${base}/pages`).then((response) => response.data);

export const createWebsitePage = (payload: Partial<WebsitePage>) =>
  api.post<WebsitePage>(`${base}/pages`, payload).then((response) => response.data);

export const updateWebsitePage = (id: string, payload: Partial<WebsitePage>) =>
  api.patch<WebsitePage>(`${base}/pages/${id}`, payload).then((response) => response.data);

export const createWebsiteSection = (pageId: string, payload: Partial<WebsitePageSection>) =>
  api
    .post<WebsitePageSection>(`${base}/pages/${pageId}/sections`, payload)
    .then((response) => response.data);

export const updateWebsiteSection = (
  pageId: string,
  sectionId: string,
  payload: Partial<WebsitePageSection>,
) =>
  api
    .patch<WebsitePageSection>(`${base}/pages/${pageId}/sections/${sectionId}`, payload)
    .then((response) => response.data);

export const reorderWebsiteSections = (pageId: string, sectionIds: string[]) =>
  api
    .put<WebsitePageSection[]>(`${base}/pages/${pageId}/sections/reorder`, { sectionIds })
    .then((response) => response.data);

export const fetchWebsiteMenus = () =>
  api.get<WebsiteMenu[]>(`${base}/menus`).then((response) => response.data);

export const updateWebsiteMenu = (id: string, payload: Partial<WebsiteMenu>) =>
  api.patch<WebsiteMenu>(`${base}/menus/${id}`, payload).then((response) => response.data);

export const fetchWebsiteContentTypes = () =>
  api.get<WebsiteContentType[]>(`${base}/content-types`).then((response) => response.data);

export const createWebsiteContentType = (payload: Partial<WebsiteContentType>) =>
  api.post<WebsiteContentType>(`${base}/content-types`, payload).then((response) => response.data);

export const fetchWebsiteMedia = () =>
  api.get<WebsiteMediaAsset[]>(`${base}/media`).then((response) => response.data);

export const uploadWebsiteMedia = (file: File, altText: string) => {
  const form = new FormData();
  form.append('file', file);
  form.append('altText', altText);
  return api
    .post<WebsiteMediaAsset>(`${base}/media`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((response) => response.data);
};

export const updateWebsiteMedia = (id: string, payload: Partial<WebsiteMediaAsset>) =>
  api.patch<WebsiteMediaAsset>(`${base}/media/${id}`, payload).then((response) => response.data);

export const deleteWebsiteMedia = (id: string) =>
  api.delete(`${base}/media/${id}`).then((response) => response.data);

export const fetchWebsiteHeroSlides = () =>
  api.get<WebsiteHeroSlide[]>(`${base}/hero-slides`).then((response) => response.data);

export const createWebsiteHeroSlide = (file: File, altText: string) => {
  const form = new FormData();
  form.append('desktop', file);
  form.append('altText', altText);
  return api
    .post<WebsiteHeroSlide>(`${base}/hero-slides`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((response) => response.data);
};

export const uploadWebsiteHeroSlideMobile = (slideId: string, file: File) => {
  const form = new FormData();
  form.append('mobile', file);
  return api
    .post<WebsiteHeroSlide>(`${base}/hero-slides/${slideId}/mobile`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((response) => response.data);
};

export const updateWebsiteHeroSlide = (id: string, payload: Partial<WebsiteHeroSlide>) =>
  api
    .patch<WebsiteHeroSlide>(`${base}/hero-slides/${id}`, payload)
    .then((response) => response.data);

export const reorderWebsiteHeroSlides = (slideIds: string[]) =>
  api
    .put<WebsiteHeroSlide[]>(`${base}/hero-slides/reorder`, { slideIds })
    .then((response) => response.data);

export const deleteWebsiteHeroSlide = (id: string) =>
  api.delete(`${base}/hero-slides/${id}`).then((response) => response.data);

export const fetchWebsiteHomepageLayout = () =>
  api
    .get<import('@/types/website-cms').WebsiteHomepageSection[]>(`${base}/homepage-layout`)
    .then((response) => response.data);

export const fetchWebsiteHomepageContent = () =>
  api.get<Record<string, unknown>>(`${base}/homepage-content`).then((response) => response.data);

export const updateWebsiteHomepageContent = (payload: Record<string, unknown>) =>
  api
    .put<Record<string, unknown>>(`${base}/homepage-content`, payload)
    .then((response) => response.data);

export const updateWebsiteHomepageLayout = (
  sections: Array<{
    sectionKey: string;
    enabled?: boolean;
    position?: number;
    settings?: Record<string, unknown>;
    label?: string;
  }>,
) =>
  api
    .put<import('@/types/website-cms').WebsiteHomepageSection[]>(`${base}/homepage-layout`, {
      sections,
    })
    .then((response) => response.data);

export const fetchWebsiteContentEntries = (contentTypeId: string) =>
  api
    .get<Array<Record<string, unknown>>>(`${base}/content-types/${contentTypeId}/entries`)
    .then((response) => response.data);

export const fetchWebsiteContentEntriesTrash = (contentTypeId: string) =>
  api
    .get<Array<Record<string, unknown>>>(`${base}/content-types/${contentTypeId}/entries/trash`)
    .then((response) => response.data);

export const createWebsiteContentEntry = (
  contentTypeId: string,
  payload: {
    title: string;
    slug?: string;
    status?: string;
    data?: Record<string, unknown>;
    scheduledAt?: string | null;
    publishedAt?: string | null;
  },
) =>
  api
    .post(`${base}/content-types/${contentTypeId}/entries`, payload)
    .then((response) => response.data);

export const updateWebsiteContentEntry = (
  entryId: string,
  payload: {
    title?: string;
    slug?: string;
    status?: string;
    data?: Record<string, unknown>;
    scheduledAt?: string | null;
    publishedAt?: string | null;
  },
) => api.patch(`${base}/content-entries/${entryId}`, payload).then((response) => response.data);

export const trashWebsiteContentEntry = (entryId: string) =>
  api.delete(`${base}/content-entries/${entryId}`).then((response) => response.data);

export const restoreWebsiteContentEntry = (entryId: string) =>
  api.post(`${base}/content-entries/${entryId}/restore`).then((response) => response.data);

export const previewWebsiteContentEntry = (entryId: string) =>
  api
    .post<{
      html: string;
      title: string;
      status: string;
      slug: string;
    }>(`${base}/content-entries/${entryId}/preview`)
    .then((response) => response.data);

export const fetchWebsiteNotices = () =>
  api
    .get<import('@/types/website-cms').WebsiteNotice[]>(`${base}/notices`)
    .then((response) => response.data);

export const createWebsiteNotice = (
  payload: Partial<import('@/types/website-cms').WebsiteNotice>,
) =>
  api
    .post<import('@/types/website-cms').WebsiteNotice>(`${base}/notices`, payload)
    .then((response) => response.data);

export const updateWebsiteNotice = (
  id: string,
  payload: Partial<import('@/types/website-cms').WebsiteNotice>,
) =>
  api
    .patch<import('@/types/website-cms').WebsiteNotice>(`${base}/notices/${id}`, payload)
    .then((response) => response.data);

export const deleteWebsiteNotice = (id: string) =>
  api.delete(`${base}/notices/${id}`).then((response) => response.data);

export const restoreWebsiteNotice = (id: string) =>
  api
    .post<import('@/types/website-cms').WebsiteNotice>(`${base}/notices/${id}/restore`)
    .then((response) => response.data);

export const fetchWebsiteAnnouncements = () =>
  api
    .get<import('@/types/website-cms').WebsiteAnnouncement[]>(`${base}/announcements`)
    .then((response) => response.data);

export const createWebsiteAnnouncement = (
  payload: Partial<import('@/types/website-cms').WebsiteAnnouncement>,
) =>
  api
    .post<import('@/types/website-cms').WebsiteAnnouncement>(`${base}/announcements`, payload)
    .then((response) => response.data);

export const updateWebsiteAnnouncement = (
  id: string,
  payload: Partial<import('@/types/website-cms').WebsiteAnnouncement>,
) =>
  api
    .patch<
      import('@/types/website-cms').WebsiteAnnouncement
    >(`${base}/announcements/${id}`, payload)
    .then((response) => response.data);

export const deleteWebsiteAnnouncement = (id: string) =>
  api.delete(`${base}/announcements/${id}`).then((response) => response.data);

export const restoreWebsiteAnnouncement = (id: string) =>
  api
    .post<import('@/types/website-cms').WebsiteAnnouncement>(`${base}/announcements/${id}/restore`)
    .then((response) => response.data);

export const uploadWebsiteDocument = (file: File, altText = '') => {
  const form = new FormData();
  form.append('file', file);
  form.append('altText', altText);
  form.append('kind', 'DOCUMENT');
  return api
    .post<import('@/types/website-cms').WebsiteMediaAsset>(`${base}/media`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((response) => response.data);
};

export const duplicateWebsitePage = (id: string) =>
  api.post(`${base}/pages/${id}/duplicate`).then((response) => response.data);

export const trashWebsitePage = (id: string) =>
  api.delete(`${base}/pages/${id}`).then((response) => response.data);

export const restoreWebsitePage = (id: string) =>
  api.post(`${base}/pages/${id}/restore`).then((response) => response.data);

export const fetchWebsiteCalendarItems = () =>
  api
    .get<Array<Record<string, unknown>>>(`${base}/calendar-items`)
    .then((response) => response.data);

export const updateWebsiteCalendarItems = (items: Array<Record<string, unknown>>) =>
  api.put(`${base}/calendar-items`, { items }).then((response) => response.data);

export const fetchAcademicPlannerYears = () =>
  api
    .get<import('@/types/website-cms').AcademicPlannerYear[]>(`${base}/academic-planner/years`)
    .then((response) => response.data);

export const createAcademicPlannerYear = (payload: {
  title: string;
  slug?: string;
  startDate: string;
  endDate: string;
  status?: string;
}) =>
  api
    .post<
      import('@/types/website-cms').AcademicPlannerYear
    >(`${base}/academic-planner/years`, payload)
    .then((response) => response.data);

export const fetchAcademicPlannerYear = (yearId: string, month?: string) =>
  api
    .get<
      import('@/types/website-cms').AcademicPlannerYearDetail
    >(`${base}/academic-planner/years/${yearId}`, { params: month ? { month } : undefined })
    .then((response) => response.data);

export const updateAcademicPlannerYear = (
  yearId: string,
  payload: Partial<{
    title: string;
    slug: string;
    startDate: string;
    endDate: string;
    status: string;
    isVisible: boolean;
  }>,
) =>
  api
    .patch<
      import('@/types/website-cms').AcademicPlannerYear
    >(`${base}/academic-planner/years/${yearId}`, payload)
    .then((response) => response.data);

export const trashAcademicPlannerYear = (yearId: string) =>
  api.delete(`${base}/academic-planner/years/${yearId}`).then((response) => response.data);

export const ensureAcademicPlannerMonth = (
  yearId: string,
  payload: { year: number; month: number },
) =>
  api
    .post<
      import('@/types/website-cms').AcademicPlannerYearDetail
    >(`${base}/academic-planner/years/${yearId}/ensure-month`, payload)
    .then((response) => response.data);

export const ensureAcademicPlannerAllMonths = (yearId: string) =>
  api
    .post<
      import('@/types/website-cms').AcademicPlannerYearDetail
    >(`${base}/academic-planner/years/${yearId}/ensure-all-months`)
    .then((response) => response.data);

export const saveAcademicPlannerMonth = (
  yearId: string,
  monthKey: string,
  days: Array<{
    id?: string;
    date: string;
    statusLabel?: string;
    description?: string;
    isWorkingDay?: boolean;
    isHighlighted?: boolean;
  }>,
) =>
  api
    .put<
      import('@/types/website-cms').AcademicPlannerYearDetail
    >(`${base}/academic-planner/years/${yearId}/months/${monthKey}`, { days })
    .then((response) => response.data);

export const fetchWebsiteContentSources = () =>
  api.get<Record<string, unknown>>(`${base}/content-sources`).then((response) => response.data);

export const updateWebsiteContentSources = (sources: Record<string, unknown>) =>
  api.put(`${base}/content-sources`, sources).then((response) => response.data);

export const fetchWebsiteMediaFolders = () =>
  api
    .get<Array<{ id: string; name: string; parentId?: string | null }>>(`${base}/media-folders`)
    .then((response) => response.data);

export const createWebsiteMediaFolder = (payload: { name: string; parentId?: string | null }) =>
  api.post(`${base}/media-folders`, payload).then((response) => response.data);

export const updateWebsiteMediaMeta = (
  id: string,
  payload: {
    altText?: string | null;
    caption?: string | null;
    tags?: string[];
    folderId?: string | null;
  },
) => api.patch(`${base}/media/${id}/meta`, payload).then((response) => response.data);

export const fetchWebsiteAppearance = () =>
  api
    .get<{
      activePresetId: string;
      presets: Array<Record<string, unknown>>;
      footerWidgets: Record<string, unknown>;
      seoDefaults: Record<string, unknown>;
    }>(`${base}/appearance`)
    .then((response) => response.data);

export const updateWebsiteAppearance = (payload: {
  activeThemePresetId?: string;
  themePresets?: unknown[];
  footerWidgets?: Record<string, unknown>;
  seoDefaults?: Record<string, unknown>;
}) => api.put(`${base}/appearance`, payload).then((response) => response.data);

export const revalidateWebsite = (paths?: string[]) =>
  api.post(`${base}/revalidate`, { paths }).then((response) => response.data);

/** Import full public website catalogue into CMS (pages, menus, homepage, news, notices). */
export const importWebsiteCatalogue = () =>
  api
    .post<{
      message?: string;
      created?: number;
      totalDefaults?: number;
      import?: Record<string, unknown>;
      foundation?: Record<string, unknown>;
    }>('/v1/website/seed-defaults')
    .then((response) => response.data);

export const fetchWebsiteRedirects = () =>
  api
    .get<
      Array<{ id: string; fromPath: string; toPath: string; statusCode: number; isActive: boolean }>
    >(`${base}/redirects`)
    .then((response) => response.data);

export const upsertWebsiteRedirect = (payload: {
  fromPath: string;
  toPath: string;
  statusCode?: number;
  isActive?: boolean;
}) => api.post('/v1/website/redirects', payload).then((response) => response.data);

export const deleteWebsiteRedirect = (id: string) =>
  api.delete(`/v1/website/redirects/${id}`).then((response) => response.data);

export const fetchWebsiteRevisions = () =>
  api.get<WebsiteRevision[]>(`${base}/revisions`).then((response) => response.data);

export const restoreWebsiteRevision = (id: string) =>
  api.post<WebsiteRevision>(`${base}/revisions/${id}/restore`).then((response) => response.data);

export const createWebsitePreview = (pageId?: string) =>
  api.post<WebsitePreview>(`${base}/preview`, { pageId }).then((response) => response.data);

export const publishWebsite = (payload: { pageId?: string; scheduledAt?: string }) =>
  api.post(`${base}/publish`, payload).then((response) => response.data);

export type WebsiteAcademicDepartmentAdmin = {
  departmentId: string;
  name: string;
  code: string;
  departmentType?: string;
  hodName: string | null;
  counts: { staffMembers: number; programs: number; students: number };
  suggestedSlug: string;
  suggestedCategory?: string;
  profile: {
    id: string;
    slug: string;
    category: string;
    tagline: string;
    showOnWebsite: boolean;
    displayOrder: number;
    establishedYear: number | null;
  } | null;
};

export const fetchWebsiteAcademicDepartments = () =>
  api
    .get<WebsiteAcademicDepartmentAdmin[]>(`${base}/academic/departments`)
    .then((response) => response.data);

export const upsertWebsiteAcademicDepartment = (
  departmentId: string,
  payload: Record<string, unknown>,
) =>
  api
    .put(`${base}/academic/departments/${departmentId}`, payload)
    .then((response) => response.data);

export const publishAllWebsiteAcademicDepartments = () =>
  api
    .post<{ departmentsPublished: number; staffPublished: number }>(`${base}/academic/publish-all`)
    .then((response) => response.data);

export const fetchWebsiteBloodDonors = (params?: { skip?: number; take?: number }) =>
  api
    .get<import('@/types/website-cms').WebsiteBloodDonorList>(`${base}/blood-donors`, {
      params,
    })
    .then((response) => response.data);

export const fetchWebsiteNewsletterSubscribers = (params?: {
  skip?: number;
  take?: number;
  status?: string;
}) =>
  api
    .get<import('@/types/website-cms').WebsiteNewsletterSubscriberList>(`${base}/newsletter`, {
      params,
    })
    .then((response) => response.data);

export const updateWebsiteNewsletterSubscriberStatus = (
  subscriberId: string,
  status: 'ACTIVE' | 'UNSUBSCRIBED',
) =>
  api
    .patch<
      import('@/types/website-cms').WebsiteNewsletterSubscriber
    >(`${base}/newsletter/${subscriberId}`, { status })
    .then((response) => response.data);

export const deleteWebsiteNewsletterSubscriber = (subscriberId: string) =>
  api.delete(`${base}/newsletter/${subscriberId}`).then((response) => response.data);

export const fetchWebsiteFyugInterests = (params?: { skip?: number; take?: number }) =>
  api
    .get<import('@/types/website-cms').WebsiteFyugInterestList>(`${base}/fyug-interest`, {
      params,
    })
    .then((response) => response.data);

export const fetchWebsiteFyugInterestStats = () =>
  api
    .get<import('@/types/website-cms').WebsiteFyugInterestStats>(`${base}/fyug-interest/stats`)
    .then((response) => response.data);

export const downloadWebsiteFyugInterestExcel = async () => {
  const { downloadBlob } = await import('@/utils/download-blob');
  const { data } = await api.get(`${base}/fyug-interest/export.xlsx`, {
    responseType: 'blob',
  });
  downloadBlob(data as Blob, 'fyug-interest-registrations.xlsx');
};

export const downloadWebsiteFyugInterestPdf = async (
  id: string,
  applicationNumber?: string | null,
) => {
  const { downloadBlob } = await import('@/utils/download-blob');
  const response = await api.get(`${base}/fyug-interest/${id}/application.pdf`, {
    responseType: 'blob',
  });
  const data = response.data as Blob;
  const contentType = String(response.headers?.['content-type'] ?? data.type ?? '');
  if (contentType.includes('application/json') || data.type.includes('json')) {
    const text = await data.text();
    let message = 'Could not generate PDF';
    try {
      const parsed = JSON.parse(text) as { message?: string; detail?: string };
      message = parsed.message || parsed.detail || message;
    } catch {
      // keep default
    }
    throw new Error(message);
  }
  if (data.size < 100) {
    throw new Error('PDF response was empty. Try again in a moment.');
  }
  const name = applicationNumber || id.slice(0, 8);
  downloadBlob(data, `fyug-application-${name}.pdf`);
};

export const fetchWebsitePopups = () =>
  api.get<import('@/types/website-cms').WebsitePopup[]>(`${base}/popups`).then((r) => r.data);

export const createWebsitePopup = (payload: Partial<import('@/types/website-cms').WebsitePopup>) =>
  api
    .post<import('@/types/website-cms').WebsitePopup>(`${base}/popups`, payload)
    .then((r) => r.data);

export const updateWebsitePopup = (
  id: string,
  payload: Partial<import('@/types/website-cms').WebsitePopup>,
) =>
  api
    .patch<import('@/types/website-cms').WebsitePopup>(`${base}/popups/${id}`, payload)
    .then((r) => r.data);

export const deleteWebsitePopup = (id: string) =>
  api.delete(`${base}/popups/${id}`).then((r) => r.data);

export const updateWebsitePopupStatus = (id: string, status: 'ACTIVE' | 'INACTIVE') =>
  api
    .patch<import('@/types/website-cms').WebsitePopup>(`${base}/popups/${id}/status`, { status })
    .then((r) => r.data);

export const duplicateWebsitePopup = (id: string) =>
  api
    .post<import('@/types/website-cms').WebsitePopup>(`${base}/popups/${id}/duplicate`)
    .then((r) => r.data);

export const previewWebsitePopup = (id: string) =>
  api
    .post<import('@/types/website-cms').WebsitePublicPopup>(`${base}/popups/${id}/preview`)
    .then((r) => r.data);
