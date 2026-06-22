import { publicClient } from '@/lib/http/public-client';
import { getCareerRequestHeaders } from '@/lib/career-host';

export type CareersPortalInfo = {
  collegeName: string;
  shortName: string;
  address?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  openVacancies: number;
  portalTitle: string;
  portalSubtitle: string;
  contactPhone?: string;
  contactEmail?: string;
  websiteUrl?: string;
  whatsappSupport?: string;
  stats?: {
    openPositions: number;
    applicationsReceived: number;
    departmentsHiring: number;
    interviewsScheduled: number;
    facultyRecruited: number;
  };
  institutional?: {
    facultyMembers: number;
    students: number;
    departments: number;
    naacGrade: string;
    yearsOfExcellence: number;
  };
  principalMessage?: {
    name: string;
    title: string;
    message: string;
    photoUrl?: string | null;
  };
  heroImages?: string[];
  hiringAlert?: {
    active: boolean;
    headline: string;
    roles: string[];
    closingDate?: string | null;
  } | null;
};

export type CareersJob = {
  id: string;
  title: string;
  slug?: string | null;
  staffType?: string | null;
  vacanciesCount: number;
  description?: string | null;
  jobDescriptionHtml?: string | null;
  qualificationRequired?: string | null;
  experienceRequired?: string | null;
  salaryMin?: number | string | null;
  salaryMax?: number | string | null;
  closingDate?: string | null;
  publishedAt?: string | null;
  advertisementPdfUrl?: string | null;
  termsPdfUrl?: string | null;
  instructionsHtml?: string | null;
  department?: { id: string; name: string } | null;
  designation?: { id: string; label: string } | null;
};

export type CareersApplicationResult = {
  applicationNo: string;
  applicationId: string;
  message: string;
};

export type CareersApplicationStatus = {
  applicationNo: string;
  applicationId?: string;
  fullName: string;
  status: string;
  appliedAt: string;
  canUploadDocuments?: boolean;
  resumeUploaded?: boolean;
  photoUploaded?: boolean;
  certificatesCount?: number;
  vacancy?: {
    title: string;
    slug?: string | null;
    department?: { name: string };
    designation?: { label: string };
  };
  interview?: { scheduledAt: string; venue?: string | null } | null;
  timeline?: {
    currentStatus: string;
    rejected: boolean;
    steps: Array<{ id: string; label: string; state: 'completed' | 'current' | 'upcoming' }>;
  };
};

export async function fetchCareersPortalInfo() {
  const { data } = await publicClient.get<CareersPortalInfo>('/v1/careers/portal/info', {
    headers: getCareerRequestHeaders(),
  });
  return data;
}

export async function fetchCareersJobs() {
  const { data } = await publicClient.get<CareersJob[]>('/v1/careers/portal/jobs', {
    headers: getCareerRequestHeaders(),
  });
  return data;
}

export async function fetchCareersJob(slug: string) {
  const { data } = await publicClient.get<CareersJob>(`/v1/careers/portal/jobs/${slug}`, {
    headers: getCareerRequestHeaders(),
  });
  return data;
}

export async function submitCareersApplication(body: Record<string, unknown>) {
  const { data } = await publicClient.post<CareersApplicationResult>(
    '/v1/careers/portal/apply',
    body,
    { headers: getCareerRequestHeaders() },
  );
  return data;
}

export async function uploadCareersFile(
  applicationId: string,
  kind: 'resume' | 'photo' | 'certificate',
  file: File,
) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await publicClient.post<{ url: string }>(
    `/v1/careers/portal/upload/${applicationId}/${kind}`,
    form,
    {
      headers: {
        ...getCareerRequestHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return data;
}

export async function uploadCareersDocument(
  applicationNo: string,
  mobile: string,
  kind: 'resume' | 'photo' | 'certificate',
  file: File,
) {
  const form = new FormData();
  form.append('file', file);
  form.append('applicationNo', applicationNo);
  form.append('mobile', mobile);
  form.append('kind', kind);
  const { data } = await publicClient.post<{ url: string; kind: string }>(
    '/v1/careers/portal/documents',
    form,
    {
      headers: {
        ...getCareerRequestHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return data;
}

export async function fetchCareersApplicationStatus(applicationNo: string, mobile: string) {
  const { data } = await publicClient.post<CareersApplicationStatus>(
    '/v1/careers/portal/application-status',
    { applicationNo, mobile },
    { headers: getCareerRequestHeaders() },
  );
  return data;
}

export function formatSalaryRange(job: CareersJob) {
  const min = job.salaryMin != null ? Number(job.salaryMin) : null;
  const max = job.salaryMax != null ? Number(job.salaryMax) : null;
  if (min != null && max != null) {
    return `₹${min.toLocaleString('en-IN')} – ₹${max.toLocaleString('en-IN')}`;
  }
  if (min != null) return `From ₹${min.toLocaleString('en-IN')}`;
  if (max != null) return `Up to ₹${max.toLocaleString('en-IN')}`;
  return 'As per college norms';
}
