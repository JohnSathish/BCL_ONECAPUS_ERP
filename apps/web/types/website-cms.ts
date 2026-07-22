export type WebsitePublishStatus = 'DRAFT' | 'IN_REVIEW' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export type WebsiteDashboard = {
  status?: string;
  pages: number;
  publishedPages: number;
  draftPages: number;
  trashPages?: number;
  news?: number;
  notices?: number;
  publishedNotices?: number;
  upcomingEvents?: number;
  departments?: number;
  facultyProfiles?: number;
  galleryPhotos?: number;
  mediaFiles?: number;
  mediaAssets: number;
  heroSlides?: number;
  pendingReviews: number;
  visitorsToday?: number | null;
  seoScore?: number | null;
  lastPublishedAt?: string | null;
  siteUrl?: string | null;
  recentActivity?: WebsiteRevision[];
  sources?: Record<string, unknown>;
  generatedAt?: string;
};

export type WebsiteNotice = {
  id: string;
  title: string;
  slug: string;
  bodyHtml: string;
  category: string;
  departmentId?: string | null;
  priority: string;
  publishAt?: string | null;
  expireAt?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  showOnHomepage: boolean;
  isVisible: boolean;
  status: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WebsiteHomepageSection = {
  id: string;
  sectionKey: string;
  label: string;
  enabled: boolean;
  position: number;
  settings: Record<string, unknown>;
};

export type WebsiteSettings = {
  siteName: string;
  tagline?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  mapUrl?: string | null;
  socialLinks: Record<string, string>;
};

export type WebsitePageSection = {
  id: string;
  pageId: string;
  type: string;
  label: string;
  heading?: string | null;
  bodyHtml?: string | null;
  settings: Record<string, unknown>;
  position: number;
  isVisible: boolean;
};

export type WebsitePage = {
  id: string;
  title: string;
  slug: string;
  path?: string;
  excerpt?: string | null;
  status: WebsitePublishStatus;
  template: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  sections: WebsitePageSection[];
  authorName?: string;
  createdAt?: string;
  updatedAt: string;
  publishedAt?: string | null;
};

export type WebsiteMenuItem = {
  id: string;
  label: string;
  url: string;
  target: '_self' | '_blank';
  position: number;
  parentId?: string | null;
  isVisible: boolean;
};

export type WebsiteMenu = {
  id: string;
  name: string;
  location: 'HEADER' | 'FOOTER' | 'UTILITY';
  items: WebsiteMenuItem[];
};

export type WebsiteContentType = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'richText' | 'image' | 'date' | 'number' | 'boolean' | 'relation';
    required: boolean;
  }>;
  entryCount: number;
};

export type WebsiteMediaAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  publicUrl: string;
  altText?: string | null;
  caption?: string | null;
  tags?: string[];
  folderId?: string | null;
  size: number;
  createdAt: string;
};

export type WebsiteHeroSlide = {
  id: string;
  altText: string;
  desktopUrl: string;
  mobileUrl?: string | null;
  mediaId?: string | null;
  mobileMediaId?: string | null;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WebsiteRevision = {
  id: string;
  entityId: string;
  entityType: 'PAGE' | 'SETTINGS' | 'MENU' | 'CONTENT';
  version: number;
  action: string;
  actorName?: string | null;
  createdAt: string;
};

export type WebsitePreview = {
  token: string;
  url: string;
  expiresAt: string;
};
