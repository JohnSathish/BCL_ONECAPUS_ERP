export type AcademicCategory = 'ARTS' | 'SCIENCE' | 'COMMERCE' | 'PROFESSIONAL' | 'ALL';

export type PublicFacultyCard = {
  id: string;
  name: string;
  photoUrl: string | null;
  designation: string | null;
  qualification: string | null;
  specialization: string | null;
  experienceYears: number | null;
  email: string | null;
  phone: string | null;
  officeLocation: string | null;
  googleScholarUrl: string | null;
  orcidUrl: string | null;
  researchAreas: string | null;
  websiteSlug: string | null;
};

export type DepartmentStats = {
  facultyTotal: number;
  facultyPublic: number;
  facultyCount: number;
  studentCount: number;
  programmeCount: number;
  publicationCount: number;
  establishedYear: number | null;
};

export type DepartmentCard = {
  id: string;
  name: string;
  code: string;
  slug: string;
  category: string;
  tagline: string;
  bannerUrl: string | null;
  establishedYear: number | null;
  primaryProgramme: { name: string; level: string | null; code: string; label: string } | null;
  programmes: { name: string; level: string | null; code: string }[];
  hod: PublicFacultyCard | null;
  stats: DepartmentStats;
  featuredFaculty: PublicFacultyCard[];
  moreFacultyCount: number;
  href: string;
};

export type DepartmentDetail = DepartmentCard & {
  aboutText: string;
  aboutHtml: string;
  hodMessage: string;
  contact: {
    email: string | null;
    phone: string | null;
    officeLocation: string | null;
  };
  programmesByLevel: Record<string, { name: string; level: string | null; code: string }[]>;
  faculty: PublicFacultyCard[];
  activities: Array<{
    id: string;
    title: string;
    activityType: string;
    eventDate: string;
    venue: string;
    description: string;
    posterUrl: string | null;
    bannerUrl: string | null;
  }>;
  publications: Array<{
    id: string;
    title: string;
    publicationType: string;
    journal: string | null;
    doi: string | null;
    publishedAt: string | null;
    authorName: string;
    authorSlug: string | null;
  }>;
  awards: Array<{
    id: string;
    title: string;
    organization: string | null;
    level: string | null;
    awardDate: string | null;
    recipientName: string;
    recipientSlug: string | null;
  }>;
  gallery: unknown[];
  downloads: unknown[];
  timetable: { available: boolean; items: unknown[] };
};

export type FacultyProfile = PublicFacultyCard & {
  department: {
    id: string;
    name: string;
    code: string;
    slug: string | null;
    href: string | null;
  } | null;
  qualifications: Array<{
    id: string;
    qualification: string;
    university: string | null;
    specialization: string | null;
  }>;
  publications: Array<{
    id: string;
    title: string;
    publicationType: string;
    journal: string | null;
    doi: string | null;
    publishedAt: string | null;
  }>;
  awards: Array<{
    id: string;
    title: string;
    organization: string | null;
    level: string | null;
    awardDate: string | null;
  }>;
  coursesTeaching: unknown[];
  timetable: { available: boolean; items: unknown[] };
  profileHref: string | null;
};

export const CATEGORY_LABELS: Record<Exclude<AcademicCategory, 'ALL'>, string> = {
  ARTS: 'Arts',
  SCIENCE: 'Science',
  COMMERCE: 'Commerce',
  PROFESSIONAL: 'Professional',
};
