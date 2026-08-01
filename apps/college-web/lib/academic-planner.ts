import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';

export type PublicPlannerEvent = {
  title: string;
  type: string;
};

export type PublicPlannerDay = {
  id: string;
  date: string;
  dayOfWeek: string;
  dayOfMonth: number;
  statusLabel: string;
  description: string;
  isWorkingDay: boolean;
  isHighlighted: boolean;
  dayKind?: string;
  events?: PublicPlannerEvent[];
};

export type PublicPlannerMonth = {
  key: string;
  year: number;
  month: number;
  title: string;
  workingDays: number;
  days: PublicPlannerDay[];
};

export type PublicAcademicPlanner = {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  status: string;
  months: PublicPlannerMonth[];
  source?: string;
};

function mapEvent(row: Record<string, unknown>): PublicPlannerEvent | null {
  if (typeof row.title !== 'string' || !row.title.trim()) return null;
  return {
    title: row.title.trim(),
    type: typeof row.type === 'string' ? row.type : 'OTHER',
  };
}

function mapDay(row: Record<string, unknown>): PublicPlannerDay | null {
  if (typeof row.id !== 'string' || typeof row.date !== 'string') return null;
  const events = Array.isArray(row.events)
    ? row.events
        .map((item) => (isRecord(item) ? mapEvent(item) : null))
        .filter((item): item is PublicPlannerEvent => Boolean(item))
    : undefined;
  return {
    id: row.id,
    date: row.date,
    dayOfWeek: typeof row.dayOfWeek === 'string' ? row.dayOfWeek : '',
    dayOfMonth: typeof row.dayOfMonth === 'number' ? row.dayOfMonth : Number(row.date.slice(8, 10)),
    statusLabel: typeof row.statusLabel === 'string' ? row.statusLabel : '',
    description: typeof row.description === 'string' ? row.description : '',
    isWorkingDay: Boolean(row.isWorkingDay),
    isHighlighted: Boolean(row.isHighlighted),
    dayKind: typeof row.dayKind === 'string' ? row.dayKind : undefined,
    events,
  };
}

function mapMonth(row: Record<string, unknown>): PublicPlannerMonth | null {
  if (typeof row.key !== 'string' || typeof row.title !== 'string') return null;
  const days = Array.isArray(row.days)
    ? row.days
        .map((item) => (isRecord(item) ? mapDay(item) : null))
        .filter((item): item is PublicPlannerDay => Boolean(item))
    : [];
  return {
    key: row.key,
    year: typeof row.year === 'number' ? row.year : Number(row.key.slice(0, 4)),
    month: typeof row.month === 'number' ? row.month : Number(row.key.slice(5, 7)),
    title: row.title,
    workingDays:
      typeof row.workingDays === 'number'
        ? row.workingDays
        : days.filter((d) => d.isWorkingDay).length,
    days,
  };
}

export async function getPublicAcademicPlanner(): Promise<PublicAcademicPlanner | null> {
  const payload = await fetchCms('academic-planner', {}, 60, 8000);
  if (!isRecord(payload)) return null;
  if (typeof payload.id !== 'string' || typeof payload.title !== 'string') return null;
  const months = Array.isArray(payload.months)
    ? payload.months
        .map((item) => (isRecord(item) ? mapMonth(item) : null))
        .filter((item): item is PublicPlannerMonth => Boolean(item))
    : [];
  return {
    id: payload.id,
    title: payload.title,
    slug: typeof payload.slug === 'string' ? payload.slug : '',
    startDate: typeof payload.startDate === 'string' ? payload.startDate : '',
    endDate: typeof payload.endDate === 'string' ? payload.endDate : '',
    status: typeof payload.status === 'string' ? payload.status : 'PUBLISHED',
    months,
    source: typeof payload.source === 'string' ? payload.source : undefined,
  };
}
