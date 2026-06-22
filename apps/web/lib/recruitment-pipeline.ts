export const RECRUITMENT_PIPELINE_STAGES = [
  { id: 'APPLIED', label: 'Applied', statuses: ['APPLIED', 'SUBMITTED'] },
  { id: 'UNDER_REVIEW', label: 'Under Review', statuses: ['UNDER_REVIEW'] },
  { id: 'SHORTLISTED', label: 'Shortlisted', statuses: ['SHORTLISTED'] },
  { id: 'INTERVIEW', label: 'Interview', statuses: ['INTERVIEW'] },
  { id: 'SELECTED', label: 'Selected', statuses: ['SELECTED', 'OFFERED'] },
  { id: 'WAITING_LIST', label: 'Waiting List', statuses: ['WAITING_LIST'] },
  { id: 'APPOINTED', label: 'Appointed', statuses: ['HIRED', 'APPOINTED'] },
  { id: 'REJECTED', label: 'Rejected', statuses: ['REJECTED', 'NOT_JOINED'] },
] as const;

export const MOVE_OPTIONS: Record<string, string[]> = {
  APPLIED: ['UNDER_REVIEW', 'SHORTLISTED', 'REJECTED'],
  SUBMITTED: ['UNDER_REVIEW', 'SHORTLISTED', 'REJECTED'],
  UNDER_REVIEW: ['SHORTLISTED', 'REJECTED', 'WAITING_LIST'],
  SHORTLISTED: ['INTERVIEW', 'REJECTED', 'WAITING_LIST'],
  INTERVIEW: ['SELECTED', 'REJECTED', 'WAITING_LIST'],
  SELECTED: ['OFFERED', 'APPOINTED', 'REJECTED'],
  OFFERED: ['APPOINTED', 'HIRED', 'REJECTED'],
  WAITING_LIST: ['SHORTLISTED', 'REJECTED'],
  HIRED: ['APPOINTED'],
  APPOINTED: [],
  REJECTED: [],
  NOT_JOINED: [],
};
