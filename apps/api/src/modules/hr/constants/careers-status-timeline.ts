export const CAREERS_PUBLIC_STATUS_STEPS = [
  { id: 'submitted', statuses: ['APPLIED', 'SUBMITTED'], label: 'Submitted' },
  { id: 'review', statuses: ['UNDER_REVIEW'], label: 'Under Review' },
  {
    id: 'shortlisted',
    statuses: ['SHORTLISTED', 'WAITING_LIST'],
    label: 'Shortlisted',
  },
  { id: 'interview', statuses: ['INTERVIEW'], label: 'Interview Scheduled' },
  { id: 'selected', statuses: ['SELECTED', 'OFFERED'], label: 'Selected' },
  {
    id: 'appointed',
    statuses: ['APPOINTED', 'HIRED'],
    label: 'Appointment Issued',
  },
] as const;

export function buildCareersStatusTimeline(currentStatus: string) {
  if (currentStatus === 'REJECTED') {
    return {
      currentStatus,
      rejected: true,
      steps: CAREERS_PUBLIC_STATUS_STEPS.map((s) => ({
        ...s,
        state: 'upcoming' as const,
      })),
    };
  }

  const currentIndex = CAREERS_PUBLIC_STATUS_STEPS.findIndex((s) =>
    (s.statuses as readonly string[]).includes(currentStatus),
  );
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return {
    currentStatus,
    rejected: false,
    steps: CAREERS_PUBLIC_STATUS_STEPS.map((step, index) => ({
      ...step,
      state:
        index < activeIndex
          ? ('completed' as const)
          : index === activeIndex
            ? ('current' as const)
            : ('upcoming' as const),
    })),
  };
}
