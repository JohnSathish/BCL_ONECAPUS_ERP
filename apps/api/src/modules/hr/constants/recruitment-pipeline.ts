export const RECRUITMENT_PIPELINE_STAGES = [
  {
    id: 'APPLIED',
    label: 'Applied',
    statuses: ['APPLIED', 'SUBMITTED'],
  },
  {
    id: 'UNDER_REVIEW',
    label: 'Under Review',
    statuses: ['UNDER_REVIEW'],
  },
  {
    id: 'SHORTLISTED',
    label: 'Shortlisted',
    statuses: ['SHORTLISTED'],
  },
  {
    id: 'INTERVIEW',
    label: 'Interview',
    statuses: ['INTERVIEW'],
  },
  {
    id: 'SELECTED',
    label: 'Selected',
    statuses: ['SELECTED', 'OFFERED'],
  },
  {
    id: 'WAITING_LIST',
    label: 'Waiting List',
    statuses: ['WAITING_LIST'],
  },
  {
    id: 'APPOINTED',
    label: 'Appointed',
    statuses: ['HIRED', 'APPOINTED'],
  },
  {
    id: 'REJECTED',
    label: 'Rejected',
    statuses: ['REJECTED', 'NOT_JOINED'],
  },
] as const;

export const ALL_RECRUITMENT_STATUSES = [
  'APPLIED',
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'SELECTED',
  'WAITING_LIST',
  'OFFERED',
  'REJECTED',
  'HIRED',
  'APPOINTED',
  'NOT_JOINED',
] as const;

export type RecruitmentStatus = (typeof ALL_RECRUITMENT_STATUSES)[number];

export function stageForStatus(status: string) {
  return (
    RECRUITMENT_PIPELINE_STAGES.find((s) =>
      (s.statuses as readonly string[]).includes(status),
    )?.id ?? 'APPLIED'
  );
}
