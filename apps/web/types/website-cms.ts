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

export type WebsiteAnnouncement = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  bodyHtml: string;
  featuredImageUrl?: string | null;
  featuredImageAlt?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  /** Optional click-through URL (ticker / cards). Falls back to /announcements/:slug. */
  linkUrl?: string | null;
  isPinned: boolean;
  showOnTicker: boolean;
  showOnHomepage: boolean;
  isVisible: boolean;
  publishAt?: string | null;
  expireAt?: string | null;
  status: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  href?: string;
  isNew?: boolean;
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

export type WebsiteBloodDonor = {
  id: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  preferredContact: string;
  bloodGroup: string;
  lastDonationDate?: string | null;
  streetAddress: string;
  city: string;
  state: string;
  pincode: string;
  medicalNotes: string;
  eligible: boolean;
  status: string;
  createdAt: string;
};

export type WebsiteBloodDonorList = {
  items: WebsiteBloodDonor[];
  total: number;
  skip: number;
  take: number;
};

export type WebsiteFyugInterest = {
  id: string;
  applicationNumber?: string | null;
  academicSession?: string;
  fullName: string;
  photographUrl?: string | null;
  gender: string;
  dateOfBirth: string;
  mobile: string;
  whatsapp: string;
  email: string;
  state: string;
  fatherName: string;
  fatherMobile: string;
  motherName: string;
  motherMobile: string;
  collegeLastAttended: string;
  affiliatedUniversity: string;
  majorCourse: string;
  minorCourse: string;
  applyingHonoursIn: string;
  cuetScore: string;
  cgpaSemesterV: string;
  percentageSemesterV: string;
  hasBackPapers: boolean;
  backPaperDetails?: string;
  signatureName: string;
  remarks?: string;
  status: string;
  createdAt: string;
};

export type WebsiteFyugInterestList = {
  items: WebsiteFyugInterest[];
  total: number;
  skip: number;
  take: number;
};

export type WebsiteFyugInterestStats = {
  total: number;
  today: number;
  eligible: number;
  rejected: number;
  pending: number;
  approved: number;
  byHonours: { label: string; value: number }[];
  byMajor: { label: string; value: number }[];
  byCollege: { label: string; value: number }[];
  byState: { label: string; value: number }[];
  byGender: { label: string; value: number }[];
};

export type AcademicPlannerDay = {
  id: string;
  date: string;
  dayOfWeek: string;
  dayOfMonth: number;
  statusLabel: string;
  description: string;
  isWorkingDay: boolean;
  isHighlighted: boolean;
};

export type AcademicPlannerMonth = {
  key: string;
  year: number;
  month: number;
  title: string;
  workingDays: number;
  days: AcademicPlannerDay[];
};

export type AcademicPlannerYear = {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  status: string;
  isVisible: boolean;
  dayCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AcademicPlannerYearDetail = AcademicPlannerYear & {
  months: AcademicPlannerMonth[];
  selectedMonthKey: string;
  selectedMonth: AcademicPlannerMonth | null;
};
