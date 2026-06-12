import { buildStudentIdCardModelFromProfile } from '@/components/id-cards/build-student-id-card-model-from-profile';
import { buildIdVerificationReportDocument } from '@/components/id-cards/build-id-verification-report-html';
import { enhanceStudentCardModel } from '@/components/id-cards/enhance-student-card-model';
import type {
  IdVerificationReportMeta,
  IdVerificationReportRow,
  IdVerificationReportSection,
} from '@/components/id-cards/id-card-verification-report-types';
import { formatDisplayGender } from '@/components/id-cards/id-card-pursuit-excellence';
import type { IdCardIssue } from '@/services/id-cards';
import { fetchAllStudentIdCardIssues } from '@/services/id-cards';
import { fetchAllStudents, fetchStudentProfile } from '@/services/students';
import type { InstitutionBranding } from '@/types/branding';
import type { StudentDirectoryRow, StudentProfile } from '@/types/students';
import { toBrandingDocumentContext } from '@/lib/branding-document';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';

export type IdVerificationReportFilters = {
  departmentId?: string;
  semester?: string;
  sessionId?: string;
  academicStatus?: string;
  /** When true, one printable section per department (departmentId must be empty). */
  groupByDepartment?: boolean;
};

export type IdVerificationReportProgress = {
  phase: 'loading' | 'profiles' | 'building';
  done: number;
  total: number;
};

async function fetchStudentProfilesBatch(ids: string[]): Promise<Map<string, StudentProfile>> {
  const map = new Map<string, StudentProfile>();
  const chunkSize = 8;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const profiles = await Promise.all(chunk.map((id) => fetchStudentProfile(id)));
    for (const profile of profiles) {
      map.set(profile.id, profile);
    }
  }
  return map;
}

function sortByName(rows: StudentDirectoryRow[]): StudentDirectoryRow[] {
  return [...rows].sort((a, b) =>
    (a.displayFullName ?? a.fullName).localeCompare(b.displayFullName ?? b.fullName, undefined, {
      sensitivity: 'base',
    }),
  );
}

function departmentLabel(row: StudentDirectoryRow, profile: StudentProfile): string {
  return (
    profile.departmentName?.trim() ||
    row.programme?.trim() ||
    row.majorSubject?.trim() ||
    'General / Unassigned'
  );
}

function rowFromProfile(
  profile: StudentProfile,
  branding?: InstitutionBranding | null,
  issue?: IdCardIssue | null,
): IdVerificationReportRow {
  const base = buildStudentIdCardModelFromProfile({ profile, branding: branding ?? undefined });
  const model = enhanceStudentCardModel(base, { activeIssue: issue ?? null, settings: null });
  const holder = model.holder;

  return {
    studentId: profile.id,
    photoUrl: holder.photoUrl,
    fullName: (holder.displayFullName ?? holder.fullName).toUpperCase(),
    registrationNumber: holder.registrationNumber,
    rollNumber: holder.rollNumber,
    department: holder.department,
    programme: holder.programme ?? holder.subtitle ?? null,
    semester: profile.semester ? String(profile.semester) : null,
    gender: formatDisplayGender(holder.gender) || holder.gender,
    bloodGroup: holder.bloodGroup,
    mobile: profile.mobileNumber ?? profile.email ?? null,
    rfidNumber: holder.rfidNumber,
    validToLabel: model.validity.validToLabel ?? model.validity.validTo ?? null,
    emergencyContact: holder.emergencyContact,
    hasPhoto: Boolean(holder.photoUrl),
  };
}

function groupIntoSections(
  students: StudentDirectoryRow[],
  profilesById: Map<string, StudentProfile>,
  branding?: InstitutionBranding | null,
  issuesByStudentId?: Map<string, IdCardIssue>,
  singleDepartmentName?: string,
): IdVerificationReportSection[] {
  if (singleDepartmentName) {
    const rows = students.map((s) =>
      rowFromProfile(
        profilesById.get(s.id) ?? (s as StudentProfile),
        branding,
        issuesByStudentId?.get(s.id),
      ),
    );
    return [{ departmentName: singleDepartmentName, rows }];
  }

  const buckets = new Map<string, IdVerificationReportRow[]>();
  for (const student of students) {
    const profile = profilesById.get(student.id) ?? (student as StudentProfile);
    const dept = departmentLabel(student, profile);
    const row = rowFromProfile(profile, branding, issuesByStudentId?.get(student.id));
    const list = buckets.get(dept) ?? [];
    list.push(row);
    buckets.set(dept, list);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map(([departmentName, rows]) => ({
      departmentName,
      rows: rows.sort((a, b) =>
        a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }),
      ),
    }));
}

function indexIssues(issues: IdCardIssue[]): Map<string, IdCardIssue> {
  const map = new Map<string, IdCardIssue>();
  for (const issue of issues) {
    if (!issue.studentId) continue;
    if (!map.has(issue.studentId)) map.set(issue.studentId, issue);
  }
  return map;
}

export async function buildIdVerificationReport(options: {
  branding?: InstitutionBranding | null;
  filters: IdVerificationReportFilters;
  departmentName?: string;
  sessionName?: string;
  onProgress?: (progress: IdVerificationReportProgress) => void;
}): Promise<{
  html: string;
  meta: IdVerificationReportMeta;
  sections: IdVerificationReportSection[];
}> {
  const { branding, filters, departmentName, sessionName, onProgress } = options;
  const doc = toBrandingDocumentContext(branding ?? undefined);

  onProgress?.({ phase: 'loading', done: 0, total: 0 });

  const studentsRes = await fetchAllStudents({
    departmentId: filters.departmentId,
    semester: filters.semester,
    sessionId: filters.sessionId,
    academicStatus: filters.academicStatus || 'ACTIVE',
  });

  let students = sortByName(studentsRes.data);
  if (filters.semester) {
    const sem = Number(filters.semester);
    if (!Number.isNaN(sem)) {
      students = students.filter((row) => row.semester === sem);
    }
  }

  if (students.length === 0) {
    throw new Error('No active students match the selected filters.');
  }

  onProgress?.({ phase: 'profiles', done: 0, total: students.length });
  const profilesById = await fetchStudentProfilesBatch(students.map((s) => s.id));
  onProgress?.({ phase: 'profiles', done: students.length, total: students.length });

  const issues = await fetchAllStudentIdCardIssues({ departmentId: filters.departmentId }).catch(
    () => [],
  );
  const issuesByStudentId = indexIssues(issues);

  onProgress?.({ phase: 'building', done: 0, total: 1 });

  const groupAllDepts = filters.groupByDepartment && !filters.departmentId;
  const sections = groupIntoSections(
    students,
    profilesById,
    branding,
    issuesByStudentId,
    groupAllDepts ? undefined : (departmentName ?? 'All Students'),
  );

  const meta: IdVerificationReportMeta = {
    institutionName: doc?.institutionName ?? branding?.displayName ?? 'Institution',
    campusName: doc?.campusName ?? branding?.campusName ?? null,
    logoUrl: doc?.logoUrl ?? resolveUploadAssetUrl(branding?.logoUrl) ?? null,
    reportTitle: 'Student ID Card — Data Verification Report',
    semester: filters.semester ?? null,
    sessionName: sessionName ?? null,
    generatedAt: new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    totalStudents: students.length,
  };

  const html = buildIdVerificationReportDocument(meta, sections);
  onProgress?.({ phase: 'building', done: 1, total: 1 });

  return { html, meta, sections };
}

export function openIdVerificationReportPreview(html: string, title: string) {
  const win = window.open('', '_blank', 'width=1200,height=800');
  if (!win) {
    throw new Error('Pop-up blocked. Allow pop-ups to preview the verification report.');
  }

  win.document.write(`<!DOCTYPE html><html><head><title>${title.replace(/</g, '')}</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #1e293b; color: #fff; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; background: #0f172a; align-items: center; }
  .toolbar button { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; }
  .primary { background: #001B44; color: #fff; }
  .secondary { background: #334155; color: #fff; }
  iframe { width: 100%; height: calc(100vh - 56px); border: 0; background: #94a3b8; }
  .hint { font-size: 12px; color: #94a3b8; margin-left: auto; }
</style></head><body>
  <div class="toolbar">
    <button class="primary" onclick="document.getElementById('report').contentWindow.print()">Print report</button>
    <button class="secondary" onclick="window.close()">Close</button>
    <span class="hint">A4 Landscape · Verify data before ID card printing</span>
  </div>
  <iframe id="report"></iframe>
  <script>
    const doc = document.getElementById('report').contentDocument;
    doc.open();
    doc.write(${JSON.stringify(html)});
    doc.close();
  </script>
</body></html>`);
  win.document.close();
}
