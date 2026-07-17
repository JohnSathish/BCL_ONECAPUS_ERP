/** Activity type catalog for Department Activities module. */

export type ActivityTypeDef = {
  code: string;
  label: string;
  icon: string;
  /** When true, Phase 2 results flow applies. */
  isCompetition: boolean;
};

export const DEPARTMENT_ACTIVITY_TYPES: ActivityTypeDef[] = [
  {
    code: 'ACADEMIC_SEMINAR',
    label: 'Academic Seminar',
    icon: 'mic',
    isCompetition: false,
  },
  {
    code: 'DEPARTMENT_SEMINAR',
    label: 'Department Seminar',
    icon: 'building',
    isCompetition: false,
  },
  {
    code: 'STUDENT_SEMINAR',
    label: 'Student Seminar',
    icon: 'users',
    isCompetition: false,
  },
  {
    code: 'PAPER_PRESENTATION',
    label: 'Paper Presentation',
    icon: 'file-text',
    isCompetition: false,
  },
  {
    code: 'RESEARCH_PRESENTATION',
    label: 'Research Presentation',
    icon: 'flask',
    isCompetition: false,
  },
  {
    code: 'POSTER_PRESENTATION',
    label: 'Poster Presentation',
    icon: 'image',
    isCompetition: false,
  },
  {
    code: 'QUIZ',
    label: 'Quiz Competition',
    icon: 'help-circle',
    isCompetition: true,
  },
  { code: 'DEBATE', label: 'Debate', icon: 'messages', isCompetition: true },
  { code: 'WORKSHOP', label: 'Workshop', icon: 'wrench', isCompetition: false },
  {
    code: 'CONFERENCE',
    label: 'Conference',
    icon: 'globe',
    isCompetition: false,
  },
  {
    code: 'GUEST_LECTURE',
    label: 'Guest Lecture',
    icon: 'user',
    isCompetition: false,
  },
  {
    code: 'FDP',
    label: 'Faculty Development Programme',
    icon: 'graduation-cap',
    isCompetition: false,
  },
  {
    code: 'SKILL_DEVELOPMENT',
    label: 'Skill Development Programme',
    icon: 'sparkles',
    isCompetition: false,
  },
  {
    code: 'EXTENSION',
    label: 'Extension Activity',
    icon: 'map',
    isCompetition: false,
  },
  {
    code: 'OUTREACH',
    label: 'Outreach Programme',
    icon: 'handshake',
    isCompetition: false,
  },
  {
    code: 'CAREER_GUIDANCE',
    label: 'Career Guidance',
    icon: 'compass',
    isCompetition: false,
  },
  {
    code: 'PLACEMENT_TRAINING',
    label: 'Placement Training',
    icon: 'briefcase',
    isCompetition: false,
  },
  {
    code: 'AWARENESS',
    label: 'Awareness Programme',
    icon: 'megaphone',
    isCompetition: false,
  },
  { code: 'CLUB', label: 'Club Activity', icon: 'heart', isCompetition: false },
  { code: 'NSS', label: 'NSS Activity', icon: 'flag', isCompetition: false },
  {
    code: 'IQAC',
    label: 'IQAC Activity',
    icon: 'badge-check',
    isCompetition: false,
  },
  { code: 'SPORTS', label: 'Sports', icon: 'trophy', isCompetition: true },
  {
    code: 'CULTURAL',
    label: 'Cultural Event',
    icon: 'music',
    isCompetition: true,
  },
  {
    code: 'OTHER',
    label: 'Other',
    icon: 'more-horizontal',
    isCompetition: false,
  },
];

export const ACTIVITY_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'OPEN',
  'CLOSED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export function isValidActivityType(code: string) {
  return DEPARTMENT_ACTIVITY_TYPES.some((t) => t.code === code);
}

export function isCompetitionActivityType(code: string) {
  return DEPARTMENT_ACTIVITY_TYPES.some(
    (t) => t.code === code && t.isCompetition,
  );
}

export const COMPETITION_POSITIONS = [
  'WINNER',
  'RUNNER_UP',
  'SECOND_RUNNER_UP',
  'SPECIAL_PRIZE',
  'CONSOLATION',
  'MERIT',
  'BEST_PRESENTER',
  'BEST_PAPER',
] as const;

export type CompetitionPosition = (typeof COMPETITION_POSITIONS)[number];

export const MEDIA_TYPES = [
  'PHOTO',
  'VIDEO',
  'INVITATION',
  'BANNER',
  'ATTENDANCE',
  'REPORT',
  'PRESS_RELEASE',
  'CERTIFICATE',
  'OTHER',
] as const;

export function positionCertificateType(position: string) {
  switch (position) {
    case 'WINNER':
      return 'WINNER';
    case 'RUNNER_UP':
      return 'RUNNER_UP';
    case 'SECOND_RUNNER_UP':
      return 'SECOND_RUNNER_UP';
    case 'BEST_PRESENTER':
      return 'BEST_PRESENTER';
    case 'BEST_PAPER':
      return 'BEST_PAPER';
    case 'SPECIAL_PRIZE':
      return 'SPECIAL_PRIZE';
    case 'CONSOLATION':
      return 'CONSOLATION';
    case 'MERIT':
      return 'MERIT';
    default:
      return 'ACHIEVEMENT';
  }
}

export function positionLabel(position: string) {
  return position
    .split('_')
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(' ');
}
