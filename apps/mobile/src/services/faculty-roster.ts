import { apiFetch } from '@/api/client';

export type SectionRosterStudent = {
  id: string;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
  fullName: string;
  gender?: string | null;
  department?: { name?: string; code?: string } | null;
  status?: string;
};

export type SectionRoster = {
  section: {
    id: string;
    sectionCode: string;
    semesterNo?: number | null;
    shift?: { id: string; code: string; name: string } | null;
    course?: { code: string; title: string };
  };
  students: SectionRosterStudent[];
};

export function fetchSectionRoster(sectionId: string) {
  return apiFetch<SectionRoster>(`/v1/staff/me/sections/${sectionId}/roster`);
}
