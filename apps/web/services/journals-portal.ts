import { publicClient } from '@/lib/http/public-client';
import { getJournalsRequestHeaders } from '@/lib/journals-host';
import { api } from '@/services/api';

export type JournalInfo = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  issn: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  tagline: string | null;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  publisher: string | null;
  institution: string | null;
  frequency: string | null;
  homeAnnouncementsImageUrl?: string | null;
  homeAnnouncementsHeadline?: string | null;
  homeAnnouncementsSubtext?: string | null;
};

export type JournalArticleAuthor = {
  id: string;
  fullName: string;
  affiliation: string | null;
  email: string | null;
  isCorresponding: boolean;
};

export type JournalArticle = {
  id: string;
  title: string;
  abstract: string | null;
  keywords: string[];
  doi: string | null;
  pageRange: string | null;
  pdfUrl: string | null;
  htmlContent: string | null;
  category: string | null;
  viewCount: number;
  downloadCount: number;
  publishedAt: string | null;
  authors: JournalArticleAuthor[];
  issue?: {
    id: string;
    title: string | null;
    issueNumber: number;
    volume: { volumeNumber: number; year: number; label: string | null };
  };
};

export type JournalIssue = {
  id: string;
  title: string | null;
  issueNumber: number;
  publicationDate: string | null;
  coverUrl: string | null;
  summary: string | null;
  isCurrent: boolean;
  volume: { id: string; volumeNumber: number; year: number; label: string | null };
  articles?: JournalArticle[];
  _count?: { articles: number };
};

export type JournalPortalInfo = {
  journal: JournalInfo;
  pages: Array<{ key: string; title: string }>;
  announcements: Array<{
    id: string;
    title: string;
    bodyHtml: string | null;
    publishedAt: string | null;
    isPinned: boolean;
  }>;
  boardPreview: Array<{
    id: string;
    fullName: string;
    roleTitle: string;
    boardType: string;
    institution: string | null;
    photoUrl?: string | null;
  }>;
  currentIssue: JournalIssue | null;
  topViewed?: JournalArticle[];
  topDownloaded?: JournalArticle[];
  metrics?: {
    issn: string | null;
    volumeCount: number;
    articleCount: number;
    authorCount?: number;
    boardCount: number;
    peerReviewed: boolean;
    openAccess: boolean;
  };
  highlights: string[];
};

export type JournalPage = {
  id: string;
  key: string;
  title: string;
  bodyHtml: string | null;
  isPublished: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string[];
};

export type JournalBoardMember = {
  id: string;
  fullName: string;
  roleTitle: string;
  boardType: string;
  institution: string | null;
  department?: string | null;
  country?: string | null;
  email: string | null;
  orcid: string | null;
  bio: string | null;
  researchAreas: string | null;
  photoUrl: string | null;
  sortOrder: number;
  isActive?: boolean;
};

export type JournalDownload = {
  id: string;
  title: string;
  category: string;
  fileUrl: string;
  fileName: string | null;
  sortOrder: number;
  isPublished: boolean;
  volume?: {
    id: string;
    volumeNumber: number;
    year: number;
    label: string | null;
  } | null;
  issue?: { id: string; issueNumber: number; title: string | null } | null;
};

export type JournalMediaAsset = {
  id: string;
  kind: string;
  storageKey: string;
  publicUrl: string;
  originalUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  bytes: number | null;
};

export type JournalRedirect = {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
};

function headers() {
  return getJournalsRequestHeaders();
}

export async function fetchJournalPortalInfo() {
  const { data } = await publicClient.get<JournalPortalInfo>('/v1/journals/portal/info', {
    headers: headers(),
  });
  return data;
}

export async function fetchJournalPage(key: string) {
  const { data } = await publicClient.get<JournalPage>(`/v1/journals/portal/pages/${key}`, {
    headers: headers(),
  });
  return data;
}

export async function fetchJournalBoard(opts?: {
  boardType?: string;
  scope?: 'advisory' | 'editorial';
}) {
  const { data } = await publicClient.get<JournalBoardMember[]>('/v1/journals/portal/board', {
    headers: headers(),
    params: {
      ...(opts?.boardType ? { boardType: opts.boardType } : {}),
      ...(opts?.scope ? { scope: opts.scope } : {}),
    },
  });
  return data;
}

export async function fetchJournalDownloads(category?: string) {
  const { data } = await publicClient.get<JournalDownload[]>('/v1/journals/portal/downloads', {
    headers: headers(),
    params: category ? { category } : undefined,
  });
  return data;
}

export async function lookupJournalRedirect(path: string) {
  const { data } = await publicClient.get<JournalRedirect>('/v1/journals/portal/redirect-lookup', {
    headers: headers(),
    params: { path },
  });
  return data;
}

export async function fetchJournalIssues() {
  const { data } = await publicClient.get<JournalIssue[]>('/v1/journals/portal/issues', {
    headers: headers(),
  });
  return data;
}

export async function fetchJournalIssue(id: string) {
  const { data } = await publicClient.get<JournalIssue>(`/v1/journals/portal/issues/${id}`, {
    headers: headers(),
  });
  return data;
}

export async function fetchJournalArticles(params?: {
  q?: string;
  year?: number;
  keyword?: string;
  author?: string;
}) {
  const { data } = await publicClient.get<JournalArticle[]>('/v1/journals/portal/articles', {
    headers: headers(),
    params,
  });
  return data;
}

export async function fetchJournalArticle(id: string) {
  const { data } = await publicClient.get<JournalArticle>(`/v1/journals/portal/articles/${id}`, {
    headers: headers(),
  });
  return data;
}

export async function recordJournalArticleView(id: string) {
  const { data } = await publicClient.post(`/v1/journals/portal/articles/${id}/view`, null, {
    headers: headers(),
  });
  return data;
}

export async function recordJournalArticleDownload(id: string) {
  const { data } = await publicClient.post(`/v1/journals/portal/articles/${id}/download`, null, {
    headers: headers(),
  });
  return data;
}

// —— Admin ——
export async function fetchAdminJournals() {
  const { data } = await api.get<JournalInfo[]>('/v1/journals');
  return data;
}

export async function seedAdminJournals() {
  const { data } = await api.post('/v1/journals/seed-defaults');
  return data;
}

export async function updateAdminJournal(journalId: string, body: Partial<JournalInfo>) {
  const { data } = await api.patch(`/v1/journals/${journalId}`, body);
  return data;
}

export async function fetchAdminPages(journalId: string) {
  const { data } = await api.get<JournalPage[]>(`/v1/journals/${journalId}/pages`);
  return data;
}

export async function upsertAdminPage(
  journalId: string,
  body: {
    key: string;
    title: string;
    bodyHtml?: string;
    isPublished?: boolean;
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoKeywords?: string[];
  },
) {
  const { data } = await api.post(`/v1/journals/${journalId}/pages`, body);
  return data;
}

export async function fetchAdminAnnouncements(journalId: string) {
  const { data } = await api.get(`/v1/journals/${journalId}/announcements`);
  return data;
}

export async function createAdminAnnouncement(
  journalId: string,
  body: { title: string; bodyHtml?: string; isPinned?: boolean },
) {
  const { data } = await api.post(`/v1/journals/${journalId}/announcements`, body);
  return data;
}

export async function fetchAdminBoard(journalId: string, boardType?: string) {
  const { data } = await api.get<JournalBoardMember[]>(`/v1/journals/${journalId}/board`, {
    params: boardType ? { boardType } : undefined,
  });
  return data;
}

export async function createAdminBoardMember(
  journalId: string,
  body: {
    fullName: string;
    roleTitle: string;
    boardType?: string;
    institution?: string;
    department?: string;
    country?: string;
    email?: string;
    photoUrl?: string | null;
  },
) {
  const { data } = await api.post(`/v1/journals/${journalId}/board`, body);
  return data;
}

export async function updateAdminBoardMember(
  journalId: string,
  memberId: string,
  body: Partial<JournalBoardMember>,
) {
  const { data } = await api.patch(`/v1/journals/${journalId}/board/${memberId}`, body);
  return data;
}

export async function deleteAdminBoardMember(journalId: string, memberId: string) {
  const { data } = await api.delete(`/v1/journals/${journalId}/board/${memberId}`);
  return data;
}

export async function fetchAdminDownloads(journalId: string) {
  const { data } = await api.get<JournalDownload[]>(`/v1/journals/${journalId}/downloads`);
  return data;
}

export async function createAdminDownload(
  journalId: string,
  body: {
    title: string;
    category?: string;
    volumeId?: string;
    issueId?: string;
    fileUrl: string;
    fileName?: string;
    sortOrder?: number;
    isPublished?: boolean;
  },
) {
  const { data } = await api.post(`/v1/journals/${journalId}/downloads`, body);
  return data;
}

export async function updateAdminDownload(
  journalId: string,
  downloadId: string,
  body: Partial<JournalDownload>,
) {
  const { data } = await api.patch(`/v1/journals/${journalId}/downloads/${downloadId}`, body);
  return data;
}

export async function deleteAdminDownload(journalId: string, downloadId: string) {
  const { data } = await api.delete(`/v1/journals/${journalId}/downloads/${downloadId}`);
  return data;
}

export async function fetchAdminMedia(journalId: string) {
  const { data } = await api.get<JournalMediaAsset[]>(`/v1/journals/${journalId}/media`);
  return data;
}

export async function uploadAdminMedia(journalId: string, file: File, kind = 'OTHER') {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  const { data } = await api.post(`/v1/journals/${journalId}/media`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as JournalMediaAsset;
}

export async function deleteAdminMedia(journalId: string, mediaId: string) {
  const { data } = await api.delete(`/v1/journals/${journalId}/media/${mediaId}`);
  return data;
}

export async function fetchAdminRedirects(journalId: string) {
  const { data } = await api.get<JournalRedirect[]>(`/v1/journals/${journalId}/redirects`);
  return data;
}

export async function upsertAdminRedirect(
  journalId: string,
  body: { fromPath: string; toPath: string; statusCode?: number },
) {
  const { data } = await api.post(`/v1/journals/${journalId}/redirects`, body);
  return data;
}

export async function deleteAdminRedirect(journalId: string, redirectId: string) {
  const { data } = await api.delete(`/v1/journals/${journalId}/redirects/${redirectId}`);
  return data;
}

export async function fetchAdminVolumes(journalId: string) {
  const { data } = await api.get(`/v1/journals/${journalId}/volumes`);
  return data;
}

export async function createAdminVolume(
  journalId: string,
  body: { volumeNumber: number; year: number; label?: string },
) {
  const { data } = await api.post(`/v1/journals/${journalId}/volumes`, body);
  return data;
}

export async function createAdminIssue(
  journalId: string,
  body: {
    volumeId: string;
    issueNumber: number;
    title?: string;
    summary?: string;
    publicationDate?: string;
    isCurrent?: boolean;
    coverUrl?: string;
  },
) {
  const { data } = await api.post(`/v1/journals/${journalId}/issues`, body);
  return data;
}

export async function updateAdminIssue(
  journalId: string,
  issueId: string,
  body: Partial<{
    title: string | null;
    summary: string | null;
    coverUrl: string | null;
    publicationDate: string | null;
    isCurrent: boolean;
    isPublished: boolean;
  }>,
) {
  const { data } = await api.patch(`/v1/journals/${journalId}/issues/${issueId}`, body);
  return data;
}

export async function fetchAdminArticles(journalId: string) {
  const { data } = await api.get<JournalArticle[]>(`/v1/journals/${journalId}/articles`);
  return data;
}

export async function createAdminArticle(
  journalId: string,
  body: {
    issueId: string;
    title: string;
    abstract?: string;
    keywords?: string[];
    pageRange?: string;
    authors?: Array<{ fullName: string; affiliation?: string; isCorresponding?: boolean }>;
  },
) {
  const { data } = await api.post(`/v1/journals/${journalId}/articles`, body);
  return data;
}

// —— Phase 2 workflow ——
export type JournalSubmission = {
  id: string;
  title: string;
  abstract: string | null;
  keywords: string[];
  status: string;
  currentRound: number;
  correspondingEmail: string | null;
  coverLetter: string | null;
  submittedAt: string | null;
  publishedArticleId: string | null;
  coAuthors: Array<{
    id: string;
    fullName: string;
    email: string | null;
    affiliation: string | null;
    isCorresponding: boolean;
  }>;
  files: Array<{
    id: string;
    kind: string;
    version: number;
    fileName: string;
    storageKey: string;
  }>;
  rounds: Array<{
    id: string;
    roundNumber: number;
    status: string;
    assignments: Array<{
      id: string;
      status: string;
      reviewerUserId: string;
      report: {
        recommendation: string;
        commentsToAuthor: string | null;
      } | null;
    }>;
  }>;
  decisions: Array<{
    id: string;
    decision: string;
    notesHtml: string | null;
    createdAt: string;
  }>;
};

export async function journalPortalRegister(body: {
  email: string;
  password: string;
  displayName: string;
  affiliation?: string;
  phone?: string;
  orcid?: string;
  department?: string;
  designation?: string;
  country?: string;
}) {
  const { data } = await publicClient.post('/v1/journals/portal/auth/register', body, {
    headers: headers(),
  });
  return data;
}

export async function journalPortalLogin(body: {
  email: string;
  password: string;
  rememberMe?: boolean;
}) {
  const { data } = await publicClient.post('/v1/journals/portal/auth/login', body, {
    headers: headers(),
  });
  return data as {
    accessToken: string;
    expiresIn: number;
    expiresAt: string;
    user: {
      id: string;
      email: string;
      displayName?: string;
      tenantId: string;
      tenantSlug: string;
      roles: string[];
      permissions?: string[];
    };
  };
}

export async function fetchJournalPortalMe() {
  const { data } = await api.get('/v1/journals/portal/auth/me', {
    headers: headers(),
  });
  return data;
}

export async function fetchMySubmissions() {
  const { data } = await api.get<JournalSubmission[]>('/v1/journals/portal/author/submissions', {
    headers: headers(),
  });
  return data;
}

export async function fetchMySubmission(id: string) {
  const { data } = await api.get<JournalSubmission>(
    `/v1/journals/portal/author/submissions/${id}`,
    { headers: headers() },
  );
  return data;
}

export async function createMySubmission(body: {
  title: string;
  abstract?: string;
  keywords?: string[];
  correspondingEmail?: string;
  coverLetter?: string;
  coAuthors?: Array<{
    fullName: string;
    email?: string;
    affiliation?: string;
    isCorresponding?: boolean;
  }>;
}) {
  const { data } = await api.post<JournalSubmission>(
    '/v1/journals/portal/author/submissions',
    body,
    { headers: headers() },
  );
  return data;
}

export async function submitMySubmission(id: string) {
  const { data } = await api.post<JournalSubmission>(
    `/v1/journals/portal/author/submissions/${id}/submit`,
    {},
    { headers: headers() },
  );
  return data;
}

export async function uploadMySubmissionFile(id: string, file: File, kind: string = 'MANUSCRIPT') {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  const { data } = await api.post(`/v1/journals/portal/author/submissions/${id}/files`, form, {
    headers: {
      ...headers(),
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export async function fetchMyReviewAssignments() {
  const { data } = await api.get('/v1/journals/portal/reviewer/assignments', {
    headers: headers(),
  });
  return data;
}

export async function fetchMyReviewAssignment(id: string) {
  const { data } = await api.get(`/v1/journals/portal/reviewer/assignments/${id}`, {
    headers: headers(),
  });
  return data;
}

export async function acceptReviewAssignment(
  id: string,
  body: {
    token?: string;
    conflictOfInterest: boolean;
    conflictOfInterestNotes?: string;
  },
) {
  const { data } = await api.post(`/v1/journals/portal/reviewer/assignments/${id}/accept`, body, {
    headers: headers(),
  });
  return data;
}

export async function declineReviewAssignment(id: string, token?: string) {
  const { data } = await api.post(
    `/v1/journals/portal/reviewer/assignments/${id}/decline`,
    { token },
    { headers: headers() },
  );
  return data;
}

export async function submitReviewReport(
  id: string,
  body: {
    recommendation: string;
    commentsToEditor?: string;
    commentsToAuthor?: string;
    confidentialNotes?: string;
  },
) {
  const { data } = await api.post(`/v1/journals/portal/reviewer/assignments/${id}/report`, body, {
    headers: headers(),
  });
  return data;
}

export async function fetchAdminSubmissions(journalId: string, status?: string) {
  const { data } = await api.get<JournalSubmission[]>(`/v1/journals/${journalId}/submissions`, {
    params: { status: status || undefined },
  });
  return data;
}

export async function adminInviteReviewer(
  journalId: string,
  submissionId: string,
  body: { email: string; displayName?: string; dueAt?: string },
) {
  const { data } = await api.post(
    `/v1/journals/${journalId}/submissions/${submissionId}/invite-reviewer`,
    body,
  );
  return data;
}

export async function adminDecideSubmission(
  journalId: string,
  submissionId: string,
  body: { decision: string; notesHtml?: string; roundId?: string },
) {
  const { data } = await api.post(
    `/v1/journals/${journalId}/submissions/${submissionId}/decide`,
    body,
  );
  return data;
}

export async function adminPublishSubmission(
  journalId: string,
  submissionId: string,
  body: { issueId: string; pageRange?: string; category?: string },
) {
  const { data } = await api.post(
    `/v1/journals/${journalId}/submissions/${submissionId}/publish`,
    body,
  );
  return data;
}

// —— Phase 3 ——
export async function fetchAdminProduction(journalId: string) {
  const { data } = await api.get<JournalSubmission[]>(`/v1/journals/${journalId}/production`);
  return data;
}

export async function adminAdvanceProduction(
  journalId: string,
  submissionId: string,
  body?: { targetStatus?: string; notes?: string; skipToReady?: boolean },
) {
  const { data } = await api.post(
    `/v1/journals/${journalId}/submissions/${submissionId}/production/advance`,
    body ?? {},
  );
  return data;
}

export async function adminStartProduction(journalId: string, submissionId: string) {
  const { data } = await api.post(
    `/v1/journals/${journalId}/submissions/${submissionId}/production/start`,
  );
  return data;
}

export async function fetchCrossrefSettings(journalId: string) {
  const { data } = await api.get(`/v1/journals/${journalId}/crossref-settings`);
  return data as {
    id: string;
    doiPrefix: string | null;
    crossrefEnabled: boolean;
    crossrefDepositorName: string | null;
    crossrefDepositorEmail: string | null;
    crossrefRegistrant: string | null;
    crossrefUsername: string | null;
    doiSequence: number;
  };
}

export async function updateCrossrefSettings(journalId: string, body: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/journals/${journalId}/crossref-settings`, body);
  return data;
}

export async function reserveArticleDoi(journalId: string, articleId: string) {
  const { data } = await api.post(`/v1/journals/${journalId}/articles/${articleId}/doi/reserve`);
  return data;
}

export async function depositArticleDoi(journalId: string, articleId: string) {
  const { data } = await api.post(`/v1/journals/${journalId}/articles/${articleId}/doi/deposit`);
  return data;
}

export async function uploadSimilarityReport(
  journalId: string,
  submissionId: string,
  score: number,
  file?: File,
) {
  const form = new FormData();
  form.append('score', String(score));
  if (file) form.append('file', file);
  const { data } = await api.post(
    `/v1/journals/${journalId}/submissions/${submissionId}/similarity`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function adminUploadSubmissionFile(
  journalId: string,
  submissionId: string,
  file: File,
  kind: 'GALLEY' | 'PROOF' | 'SIMILARITY_REPORT' = 'PROOF',
) {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  const { data } = await api.post(
    `/v1/journals/${journalId}/submissions/${submissionId}/files`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function approveProof(submissionId: string) {
  const { data } = await api.post(
    `/v1/journals/portal/author/submissions/${submissionId}/approve-proof`,
    {},
    { headers: headers() },
  );
  return data;
}

export async function fetchArticleCite(articleId: string, format: 'csl' | 'ris' | 'crossref-xml') {
  const { data } = await publicClient.get(`/v1/journals/portal/articles/${articleId}/cite`, {
    headers: headers(),
    params: { format },
    responseType: format === 'csl' ? 'json' : 'text',
  });
  return data;
}
