/**
 * Provisional Sem 7 / Sem 8 course catalog for FYUGP programmes.
 * Titles are placeholders — rename from NEHU syllabi in Admin after seed.
 */

import {
  ARTS_FYUGP_DEPARTMENTS,
  type ArtsFyugpCourseDef,
} from './arts-fyugp-odd-catalog';
import { commerceAllowedMinorDeptCodes } from './commerce-fyugp-major-minor.util';
import { COMMERCE_FYUGP_DEPARTMENTS } from './commerce-fyugp-odd-catalog';
import { SCIENCE_FYUGP_DEPARTMENTS } from './science-fyugp-odd-catalog';

export type PlaceholderDept = {
  code: string;
  programCode: string;
  programName: string;
  subjectSlug: string;
  stream: 'ARTS' | 'SCIENCE' | 'COMMERCE' | 'OTHER';
};

const PAPER_ROMAN = ['I', 'II', 'III', 'IV', 'V'] as const;

/** Extra programmes that exist in production but are outside arts/science/commerce catalogs. */
const EXTRA_PLACEHOLDER_DEPARTMENTS: PlaceholderDept[] = [
  {
    code: 'CSC',
    programCode: 'BCA',
    programName: 'Bachelor of Computer Applications',
    subjectSlug: 'computer-science',
    stream: 'OTHER',
  },
  {
    code: 'EVS',
    programCode: 'EVS',
    programName: 'Environmental Studies',
    subjectSlug: 'environmental-studies',
    stream: 'OTHER',
  },
  {
    code: 'COM',
    programCode: 'COM',
    programName: 'Commerce (COM)',
    subjectSlug: 'commerce',
    stream: 'COMMERCE',
  },
];

export function listSem7Sem8PlaceholderDepartments(): PlaceholderDept[] {
  const arts: PlaceholderDept[] = ARTS_FYUGP_DEPARTMENTS.map((d) => ({
    code: d.code,
    programCode: d.programCode,
    programName: d.programName,
    subjectSlug: d.subjectSlug,
    stream: 'ARTS',
  }));
  const science: PlaceholderDept[] = SCIENCE_FYUGP_DEPARTMENTS.map((d) => ({
    code: d.code,
    programCode: d.programCode,
    programName: d.programName,
    subjectSlug: d.subjectSlug,
    stream: 'SCIENCE',
  }));
  const commerce: PlaceholderDept[] = COMMERCE_FYUGP_DEPARTMENTS.map((d) => ({
    code: d.code,
    programCode: d.programCode,
    programName: d.programName,
    subjectSlug: d.subjectSlug,
    stream: 'COMMERCE',
  }));

  const byProgram = new Map<string, PlaceholderDept>();
  for (const dept of [
    ...arts,
    ...science,
    ...commerce,
    ...EXTRA_PLACEHOLDER_DEPARTMENTS,
  ]) {
    byProgram.set(dept.programCode, dept);
  }
  return [...byProgram.values()];
}

function theoryCourse(
  partial: Omit<
    ArtsFyugpCourseDef,
    'deliveryType' | 'theoryCredits' | 'practicalCredits'
  >,
): ArtsFyugpCourseDef {
  const theoryCredits = partial.credits;
  return {
    ...partial,
    deliveryType: 'THEORY',
    theoryCredits,
    practicalCredits: 0,
    theoryHoursPerWeek: theoryCredits,
    practicalHoursPerWeek: 0,
    totalTheoryContactHours: theoryCredits * 15,
    totalPracticalContactHours: 0,
    totalContactHours: theoryCredits * 15,
  };
}

function specialCourse(
  partial: Omit<
    ArtsFyugpCourseDef,
    'deliveryType' | 'theoryCredits' | 'practicalCredits'
  > & { deliveryType: string },
): ArtsFyugpCourseDef {
  return {
    ...partial,
    theoryCredits: 0,
    practicalCredits: 0,
    theoryHoursPerWeek: 0,
    practicalHoursPerWeek: 0,
    totalTheoryContactHours: 0,
    totalPracticalContactHours: 0,
    totalContactHours: partial.credits * 15,
    creditCalculationMode: 'MANUAL_OVERRIDE',
  };
}

function provisionalTitle(
  semester: 7 | 8,
  kind: string,
  roman?: string,
): string {
  const paper = roman ? ` ${roman}` : '';
  return `Provisional Sem ${semester} ${kind}${paper} — replace with NEHU title`;
}

/** All unique course defs (one per dept code) for Sem 7 + Sem 8. */
export function buildSem7Sem8PlaceholderCourses(): ArtsFyugpCourseDef[] {
  const courses: ArtsFyugpCourseDef[] = [];
  const seenDept = new Set<string>();

  for (const dept of listSem7Sem8PlaceholderDepartments()) {
    if (seenDept.has(dept.code)) continue;
    seenDept.add(dept.code);

    // programCode left unset on shared course rows — offerings attach per programme.
    for (let i = 0; i < 3; i++) {
      courses.push(
        theoryCourse({
          code: `${dept.code}-40${i}`,
          title: provisionalTitle(7, 'Major Paper', PAPER_ROMAN[i]),
          credits: 4,
          category: 'MAJOR',
          semesterSequence: 7,
          departmentCode: dept.code,
          subjectSlug: dept.subjectSlug,
          majorPaperIndex: i + 1,
        }),
      );
    }

    for (let i = 0; i < 2; i++) {
      courses.push(
        theoryCourse({
          code: `${dept.code}-40${3 + i}`,
          title: provisionalTitle(7, 'Minor Paper', PAPER_ROMAN[i]),
          credits: 4,
          category: 'MINOR',
          semesterSequence: 7,
          departmentCode: dept.code,
          subjectSlug: dept.subjectSlug,
        }),
      );
    }

    for (let i = 0; i < 5; i++) {
      courses.push(
        theoryCourse({
          code: `${dept.code}-50${i}`,
          title: provisionalTitle(8, 'Major Paper', PAPER_ROMAN[i]),
          credits: 4,
          category: 'MAJOR',
          semesterSequence: 8,
          departmentCode: dept.code,
          subjectSlug: dept.subjectSlug,
          majorPaperIndex: i + 1,
        }),
      );
    }

    courses.push(
      specialCourse({
        code: `${dept.code}-DISS`,
        title: provisionalTitle(8, 'Dissertation'),
        credits: 12,
        category: 'DISSERTATION',
        semesterSequence: 8,
        departmentCode: dept.code,
        subjectSlug: dept.subjectSlug,
        deliveryType: 'PROJECT',
      }),
    );

    courses.push(
      specialCourse({
        code: `${dept.code}-PROJ`,
        title: provisionalTitle(8, 'Project'),
        credits: 8,
        category: 'PROJECT',
        semesterSequence: 8,
        departmentCode: dept.code,
        subjectSlug: dept.subjectSlug,
        deliveryType: 'PROJECT',
      }),
    );
  }

  return courses;
}

function deptByCode(): Map<string, PlaceholderDept> {
  const map = new Map<string, PlaceholderDept>();
  for (const dept of listSem7Sem8PlaceholderDepartments()) {
    map.set(dept.code, dept);
  }
  return map;
}

function minorSourceDeptCodes(host: PlaceholderDept): string[] {
  const all = listSem7Sem8PlaceholderDepartments();
  if (host.stream === 'COMMERCE') {
    const allowed = commerceAllowedMinorDeptCodes('COM');
    return allowed.filter((code) => code !== host.code);
  }
  if (host.stream === 'ARTS' || host.stream === 'SCIENCE') {
    return all
      .filter((d) => d.stream === host.stream && d.code !== host.code)
      .map((d) => d.code);
  }
  // BCA / EVS: allow science + commerce minors as a broad pool
  return all
    .filter(
      (d) =>
        d.code !== host.code &&
        (d.stream === 'SCIENCE' ||
          d.stream === 'COMMERCE' ||
          d.stream === 'ARTS'),
    )
    .map((d) => d.code);
}

/**
 * Sem 7 minor papers from other departments, attached to the host programme.
 * Each source dept contributes two papers (-403, -404).
 */
export function buildSem7MinorCourseDefs(
  hostProgramCode: string,
): ArtsFyugpCourseDef[] {
  const host = listSem7Sem8PlaceholderDepartments().find(
    (d) => d.programCode === hostProgramCode,
  );
  if (!host) return [];

  const byCode = deptByCode();
  const defs: ArtsFyugpCourseDef[] = [];

  for (const sourceCode of minorSourceDeptCodes(host)) {
    const source = byCode.get(sourceCode);
    if (!source) continue;
    for (let i = 0; i < 2; i++) {
      defs.push(
        theoryCourse({
          code: `${source.code}-40${3 + i}`,
          title: provisionalTitle(7, 'Minor Paper', PAPER_ROMAN[i]),
          credits: 4,
          category: 'MINOR',
          semesterSequence: 7,
          departmentCode: source.code,
          subjectSlug: source.subjectSlug,
          programCode: hostProgramCode,
        }),
      );
    }
  }

  return defs;
}

/** Home-dept Sem 7 majors + Sem 8 majors / dissertation / project for a programme. */
export function buildSem7Sem8HomeCourseDefs(
  hostProgramCode: string,
): ArtsFyugpCourseDef[] {
  const host = listSem7Sem8PlaceholderDepartments().find(
    (d) => d.programCode === hostProgramCode,
  );
  if (!host) return [];

  return buildSem7Sem8PlaceholderCourses()
    .filter(
      (c) =>
        c.departmentCode === host.code &&
        (c.category === 'MAJOR' ||
          c.category === 'DISSERTATION' ||
          c.category === 'PROJECT'),
    )
    .map((c) => ({ ...c, programCode: hostProgramCode }));
}
