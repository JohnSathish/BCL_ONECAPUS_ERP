export const MEET_TYPES = [
  { code: 'SPORTS_DAY', label: 'Sports Day / Annual Sports Meet' },
  { code: 'CULTURAL_FEST', label: 'Cultural Fest' },
  { code: 'QUIZ', label: 'Quiz Competition' },
  { code: 'DEBATE', label: 'Debate Competition' },
  { code: 'DANCE', label: 'Dance Competition' },
  { code: 'SINGING', label: 'Singing Competition' },
  { code: 'POSTER', label: 'Poster Competition' },
  { code: 'PAPER_PRESENTATION', label: 'Paper Presentation' },
  { code: 'HACKATHON', label: 'Hackathon' },
  { code: 'INTER_DEPARTMENT', label: 'Inter-Department Competition' },
  { code: 'CUSTOM', label: 'Custom Competition' },
] as const;

export type MeetTypeCode = (typeof MEET_TYPES)[number]['code'];

export const MEET_STATUSES = [
  'DRAFT',
  'OPEN',
  'LIVE',
  'COMPLETED',
  'ARCHIVED',
] as const;

export type MeetStatus = (typeof MEET_STATUSES)[number];

export const HOUSE_COORDINATOR_ROLES = [
  'HOUSE_CAPTAIN',
  'VICE_CAPTAIN',
  'HOUSE_MASTER',
  'HOUSE_MISTRESS',
  'FACULTY_COORDINATOR',
] as const;

export const MEET_VOLUNTEER_ROLES = [
  'MARSHAL',
  'TIMEKEEPER',
  'JUDGE_ASSISTANT',
  'CHECK_IN_DESK',
  'ANNOUNCER',
  'FIRST_AID',
  'GENERAL',
] as const;

export const DEFAULT_POINT_RULES = {
  firstPoints: 10,
  secondPoints: 7,
  thirdPoints: 5,
  participationPoints: 2,
};

export type CategorySeed = {
  code: string;
  label: string;
  groupCode: string;
  sortOrder: number;
};

const SPORTS_CATEGORIES: CategorySeed[] = [
  { code: '100M', label: '100m', groupCode: 'TRACK', sortOrder: 1 },
  { code: '200M', label: '200m', groupCode: 'TRACK', sortOrder: 2 },
  { code: '400M', label: '400m', groupCode: 'TRACK', sortOrder: 3 },
  { code: '800M', label: '800m', groupCode: 'TRACK', sortOrder: 4 },
  { code: 'RELAY', label: 'Relay', groupCode: 'TRACK', sortOrder: 5 },
  { code: 'LONG_JUMP', label: 'Long Jump', groupCode: 'FIELD', sortOrder: 10 },
  { code: 'HIGH_JUMP', label: 'High Jump', groupCode: 'FIELD', sortOrder: 11 },
  { code: 'SHOT_PUT', label: 'Shot Put', groupCode: 'FIELD', sortOrder: 12 },
  { code: 'DISCUS', label: 'Discus Throw', groupCode: 'FIELD', sortOrder: 13 },
  { code: 'FOOTBALL', label: 'Football', groupCode: 'TEAM', sortOrder: 20 },
  { code: 'VOLLEYBALL', label: 'Volleyball', groupCode: 'TEAM', sortOrder: 21 },
  { code: 'BASKETBALL', label: 'Basketball', groupCode: 'TEAM', sortOrder: 22 },
  { code: 'CRICKET', label: 'Cricket', groupCode: 'TEAM', sortOrder: 23 },
  { code: 'CHESS', label: 'Chess', groupCode: 'INDOOR', sortOrder: 30 },
  { code: 'CARROM', label: 'Carrom', groupCode: 'INDOOR', sortOrder: 31 },
];

const CULTURAL_CATEGORIES: CategorySeed[] = [
  { code: 'DANCE', label: 'Dance', groupCode: 'CULTURAL', sortOrder: 1 },
  { code: 'SINGING', label: 'Singing', groupCode: 'CULTURAL', sortOrder: 2 },
  { code: 'DRAMA', label: 'Drama', groupCode: 'CULTURAL', sortOrder: 3 },
];

const ACADEMIC_CATEGORIES: CategorySeed[] = [
  { code: 'QUIZ', label: 'Quiz', groupCode: 'ACADEMIC', sortOrder: 1 },
  { code: 'DEBATE', label: 'Debate', groupCode: 'ACADEMIC', sortOrder: 2 },
  { code: 'ESSAY', label: 'Essay', groupCode: 'ACADEMIC', sortOrder: 3 },
  {
    code: 'POSTER',
    label: 'Poster Presentation',
    groupCode: 'ACADEMIC',
    sortOrder: 4,
  },
  {
    code: 'PAPER',
    label: 'Paper Presentation',
    groupCode: 'ACADEMIC',
    sortOrder: 5,
  },
  {
    code: 'HACKATHON',
    label: 'Hackathon',
    groupCode: 'ACADEMIC',
    sortOrder: 6,
  },
];

export function categoriesForMeetType(meetType: string): CategorySeed[] {
  switch (meetType) {
    case 'SPORTS_DAY':
      return SPORTS_CATEGORIES;
    case 'CULTURAL_FEST':
    case 'DANCE':
    case 'SINGING':
      return CULTURAL_CATEGORIES;
    case 'QUIZ':
    case 'DEBATE':
    case 'POSTER':
    case 'PAPER_PRESENTATION':
    case 'HACKATHON':
    case 'INTER_DEPARTMENT':
      return ACADEMIC_CATEGORIES;
    default:
      return [
        ...SPORTS_CATEGORIES,
        ...CULTURAL_CATEGORIES,
        ...ACADEMIC_CATEGORIES,
      ];
  }
}

export function pointsForPosition(
  position: number,
  rules: {
    firstPoints: number;
    secondPoints: number;
    thirdPoints: number;
    participationPoints: number;
  },
): number {
  if (position === 1) return rules.firstPoints;
  if (position === 2) return rules.secondPoints;
  if (position === 3) return rules.thirdPoints;
  return rules.participationPoints;
}

export function metalForPosition(
  position: number,
): 'GOLD' | 'SILVER' | 'BRONZE' | null {
  if (position === 1) return 'GOLD';
  if (position === 2) return 'SILVER';
  if (position === 3) return 'BRONZE';
  return null;
}
