import { publicClient } from '@/lib/http/public-client';
import { getAlumniRequestHeaders } from '@/lib/alumni-host';
import { api } from '@/services/api';

export type AlumniPortalInfo = {
  settings: {
    associationName: string;
    tagline: string | null;
    aboutHtml: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    logoUrl: string | null;
    heroImageUrl: string | null;
    heroImages: string[];
    primaryColor: string;
    accentColor: string;
    statsAlumni: number;
    statsLegacyYears: number;
    statsEvents: number;
    statsCountries: number;
  };
  stats: {
    activeMembers: number;
    pendingRegistrations: number;
    displayAlumni: number;
    legacyYears: number;
    eventsOrganized: number;
    countries: number;
  };
  membershipTypes: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    amountInr: number;
    durationMonths: number | null;
    isLifetime: boolean;
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    startsAt: string;
    venue: string | null;
  }>;
};

export type AlumniDirectoryRow = {
  id: string;
  fullName: string;
  graduationYear: number | null;
  programme: string | null;
  department: string | null;
  currentOrg: string | null;
  currentRole: string | null;
  occupation: string | null;
  state: string | null;
  country: string | null;
  linkedinUrl: string | null;
};

export async function fetchAlumniPortalInfo() {
  const { data } = await publicClient.get<AlumniPortalInfo>('/v1/alumni/portal/info', {
    headers: getAlumniRequestHeaders(),
  });
  return data;
}

export async function fetchAlumniAdminSettings() {
  const { data } = await api.get<AlumniPortalInfo>('/v1/alumni/settings');
  return data;
}

export async function fetchAlumniDirectory(params?: {
  q?: string;
  graduationYear?: number;
  department?: string;
}) {
  const { data } = await publicClient.get<AlumniDirectoryRow[]>('/v1/alumni/portal/directory', {
    headers: getAlumniRequestHeaders(),
    params,
  });
  return data;
}

export type AlumniEventRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description?: string | null;
  eventType?: string;
  venue: string | null;
  startsAt: string;
  endsAt?: string | null;
  isPublished?: boolean;
  coverUrl?: string | null;
};

export async function fetchAlumniEvents() {
  const { data } = await publicClient.get<AlumniEventRow[]>('/v1/alumni/portal/events', {
    headers: getAlumniRequestHeaders(),
  });
  return data;
}

export async function registerAlumni(payload: Record<string, unknown>) {
  const { data } = await publicClient.post<{
    id: string;
    status: string;
    message: string;
    payment: {
      id: string;
      paymentToken: string;
      amountInr: number;
      currency: string;
      status: string;
    } | null;
  }>('/v1/alumni/portal/register', payload, {
    headers: getAlumniRequestHeaders(),
  });
  return data;
}

export type AlumniPaymentStatus = {
  alumni: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    status: string;
    membershipNumber: string | null;
  };
  payment: {
    id: string;
    status: string;
    amountInr: number;
    currency: string;
    gateway: string | null;
    receiptNumber: string | null;
    paidAt: string | null;
    membershipId: string | null;
  };
  canPay: boolean;
  canDownloadReceipt: boolean;
  canDownloadMembershipCard: boolean;
  demoPaymentEnabled?: boolean;
};

export async function fetchAlumniPaymentStatus(params: {
  alumniId: string;
  paymentId: string;
  paymentToken: string;
}) {
  const { data } = await publicClient.get<AlumniPaymentStatus>(
    '/v1/alumni/portal/payments/status',
    {
      headers: getAlumniRequestHeaders(),
      params,
    },
  );
  return data;
}

export async function initiateAlumniPayment(payload: {
  alumniId: string;
  paymentId: string;
  paymentToken: string;
  forceDemo?: boolean;
}) {
  const { data } = await publicClient.post<{
    alreadyPaid: boolean;
    demo?: boolean;
    payment: {
      id: string;
      status: string;
      amountInr: number;
      currency?: string;
      receiptNumber?: string | null;
    };
    checkout?: Record<string, unknown>;
    description?: string;
    prefill?: { name?: string; email?: string; contact?: string };
  }>('/v1/alumni/portal/payments/initiate', payload, {
    headers: getAlumniRequestHeaders(),
  });
  return data;
}

export async function verifyAlumniPayment(payload: {
  alumniId: string;
  paymentId: string;
  paymentToken: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const { data } = await publicClient.post('/v1/alumni/portal/payments/verify', payload, {
    headers: getAlumniRequestHeaders(),
  });
  return data;
}

export async function confirmAlumniMockPayment(payload: {
  alumniId: string;
  paymentId: string;
  paymentToken: string;
}) {
  const { data } = await publicClient.post('/v1/alumni/portal/payments/confirm-mock', payload, {
    headers: getAlumniRequestHeaders(),
  });
  return data;
}

function openAlumniPortalPdf(
  path: string,
  params: {
    alumniId: string;
    paymentId: string;
    paymentToken: string;
  },
) {
  return publicClient
    .get(path, {
      headers: getAlumniRequestHeaders(),
      params,
      responseType: 'blob',
    })
    .then((res) => {
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
}

export function openAlumniPaymentReceiptPdf(params: {
  alumniId: string;
  paymentId: string;
  paymentToken: string;
}) {
  return openAlumniPortalPdf('/v1/alumni/portal/payments/receipt.pdf', params);
}

export function openAlumniMembershipCardPdf(params: {
  alumniId: string;
  paymentId: string;
  paymentToken: string;
}) {
  return openAlumniPortalPdf('/v1/alumni/portal/membership-card.pdf', params);
}

export async function openAlumniAdminMembershipCard(alumniId: string) {
  const res = await api.get(`/v1/alumni/${alumniId}/membership-card.pdf`, {
    responseType: 'blob',
  });
  const blob = res.data as Blob;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
