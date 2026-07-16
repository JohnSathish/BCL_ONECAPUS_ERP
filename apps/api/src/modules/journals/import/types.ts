export type ImportBoardMember = {
  fullName: string;
  roleTitle: string;
  boardType: string;
  institution?: string;
  department?: string;
  country?: string;
  email?: string;
  orcid?: string;
  bio?: string;
  photoUrl?: string;
  sortOrder?: number;
};

export type ImportPage = {
  key: string;
  title: string;
  bodyHtml?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  isPublished?: boolean;
  sortOrder?: number;
};

export type ImportVolume = {
  volumeNumber: number;
  year: number;
  label?: string;
  roman?: string;
  coverUrl?: string;
  pdfUrl?: string;
  pdfFileName?: string;
};

export type ImportDownload = {
  title: string;
  category: string;
  fileUrl: string;
  fileName?: string;
  volumeNumber?: number;
  year?: number;
  sortOrder?: number;
};

export type ImportMedia = {
  kind: string;
  url: string;
  fileName?: string;
};

export type ImportRedirect = {
  fromPath: string;
  toPath: string;
  statusCode?: number;
};

export type JournalImportManifest = {
  source: string;
  baseUrl: string;
  journal: {
    slug: string;
    name?: string;
    shortName?: string;
    issn?: string;
    tagline?: string;
    contactEmail?: string;
    publisher?: string;
    institution?: string;
    description?: string;
    logoUrl?: string;
    bannerUrl?: string;
  };
  pages: ImportPage[];
  board: ImportBoardMember[];
  volumes: ImportVolume[];
  downloads: ImportDownload[];
  media: ImportMedia[];
  redirects: ImportRedirect[];
};

export type ImportReportItem = {
  entity: string;
  key: string;
  status: 'imported' | 'skipped' | 'failed' | 'warning' | 'pendingReview';
  message?: string;
};

export type ImportReport = {
  journalSlug: string;
  source: string;
  dryRun: boolean;
  startedAt: string;
  finishedAt?: string;
  counts: {
    imported: number;
    skipped: number;
    failed: number;
    warnings: number;
    pendingReview: number;
  };
  items: ImportReportItem[];
};

export interface JournalContentSourceAdapter {
  fetchManifest(): Promise<JournalImportManifest>;
}
