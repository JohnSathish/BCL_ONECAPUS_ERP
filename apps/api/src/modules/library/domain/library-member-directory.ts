import { Prisma } from '@prisma/client';
import {
  INACTIVE_LIFECYCLES,
  INACTIVE_PROGRAMMES,
  INACTIVE_STUDENT_STATUSES,
  RESEARCH_LEVELS,
  RESEARCH_TEXT_MARKERS,
} from './library-member-status.logic';

export type MemberDirectoryFilters = {
  search?: string;
  tab?: string;
  departmentId?: string;
  semester?: number;
  academicYear?: string;
  status?: string;
  hasOverdue?: boolean;
  hasFine?: boolean;
  hasActiveLoans?: boolean;
  hasBorrowed?: boolean;
  sort?: string;
  sortDir?: string;
  memberId?: string;
};

function inList(values: readonly string[]) {
  return Prisma.join(values.map((value) => Prisma.sql`${value}`));
}

function researchText(expr: Prisma.Sql) {
  return Prisma.join(
    RESEARCH_TEXT_MARKERS.map(
      (marker) =>
        Prisma.sql`replace(upper(${expr}), '.', '') LIKE ${`%${marker}%`}`,
    ),
    ' OR ',
  );
}

export function studentKindCase() {
  const blob = Prisma.sql`coalesce(p.name, '') || ' ' || coalesce(p.code, '')`;
  return Prisma.sql`
    CASE
      WHEN upper(coalesce(p.level, '')) IN (${inList(RESEARCH_LEVELS)})
        OR ${researchText(blob)}
      THEN 'RESEARCH_SCHOLAR'
      ELSE 'STUDENT'
    END
  `;
}

export function studentDerivedCase() {
  return Prisma.sql`
    CASE
      WHEN upper(coalesce(sp.student_status, '')) IN (${inList(INACTIVE_STUDENT_STATUSES)})
        OR upper(coalesce(st.lifecycle_state, '')) IN (${inList(INACTIVE_LIFECYCLES)})
        OR upper(coalesce(st.programme_status, '')) IN (${inList(INACTIVE_PROGRAMMES)})
      THEN 'INACTIVE'
      ELSE 'ACTIVE'
    END
  `;
}

export function staffKindCase() {
  return Prisma.sql`
    CASE
      WHEN ${researchText(Prisma.sql`coalesce(dg.label, '')`)} THEN 'RESEARCH_SCHOLAR'
      WHEN upper(coalesce(sf.staff_type, '')) = 'TEACHING' THEN 'FACULTY'
      ELSE 'STAFF'
    END
  `;
}

export function staffDerivedCase() {
  return Prisma.sql`
    CASE
      WHEN upper(coalesce(sf.status, '')) <> 'ACTIVE'
        OR (sf.relieving_date IS NOT NULL AND sf.relieving_date < CURRENT_DATE)
      THEN 'INACTIVE'
      ELSE 'ACTIVE'
    END
  `;
}

function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function memberDirectoryCte(tenantId: string, memberId?: string) {
  const tenant = Prisma.sql`CAST(${tenantId} AS uuid)`;
  const studentIdFilter = memberId
    ? Prisma.sql`AND s.id = CAST(${memberId} AS uuid)`
    : Prisma.empty;
  const staffIdFilter = memberId
    ? Prisma.sql`AND sf.id = CAST(${memberId} AS uuid)`
    : Prisma.empty;
  return Prisma.sql`
    WITH loan_agg AS (
      SELECT student_id, staff_profile_id,
        COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active_loans,
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND due_at < NOW())::int AS overdue_loans,
        COUNT(*)::int AS total_loans,
        COUNT(*) FILTER (WHERE status = 'RETURNED' AND returned_at IS NOT NULL AND returned_at <= due_at)::int AS on_time_returns
      FROM library.library_loans
      WHERE tenant_id = ${tenant}
      GROUP BY student_id, staff_profile_id
    ),
    visit_agg AS (
      SELECT student_id, staff_profile_id, COUNT(*)::int AS visits
      FROM library.library_visits
      WHERE tenant_id = ${tenant}
        AND (student_id IS NOT NULL OR staff_profile_id IS NOT NULL)
      GROUP BY student_id, staff_profile_id
    ),
    fine_agg AS (
      SELECT l.student_id, l.staff_profile_id,
        COALESCE(SUM(f.amount) FILTER (WHERE f.paid_at IS NULL AND f.waived_at IS NULL), 0)::float8 AS outstanding,
        COALESCE(SUM(f.amount) FILTER (WHERE f.paid_at IS NOT NULL AND f.waived_at IS NULL), 0)::float8 AS paid,
        COALESCE(SUM(f.amount) FILTER (WHERE f.waived_at IS NOT NULL), 0)::float8 AS waived
      FROM library.library_fines f
      JOIN library.library_loans l ON l.id = f.loan_id
      WHERE f.tenant_id = ${tenant}
      GROUP BY l.student_id, l.staff_profile_id
    ),
    people AS (
      SELECT
        s.id AS member_id,
        s.id AS student_id,
        NULL::uuid AS staff_profile_id,
        ${studentKindCase()} AS member_kind,
        COALESCE(NULLIF(sp.full_name, ''), s.enrollment_number) AS full_name,
        s.enrollment_number AS member_code,
        s.roll_number,
        s.library_card_number AS library_card,
        s.rfid_number AS rfid,
        d.department_name AS department,
        d.id AS department_id,
        p.name AS programme,
        NULL::text AS designation,
        st.current_semester_sequence AS semester,
        ay.name AS academic_year,
        COALESCE(NULLIF(sp.email, ''), u.email) AS email,
        COALESCE(NULLIF(sp.mobile_number, ''), u.phone) AS phone,
        sp.photo_path,
        s.created_at AS record_created_at,
        ${studentDerivedCase()} AS derived_status
      FROM academic.students s
      LEFT JOIN academic.student_profiles sp ON sp.student_id = s.id
      LEFT JOIN academic.student_academic_standings st ON st.student_id = s.id
      LEFT JOIN academic.program_versions pv ON pv.id = s.program_version_id
      LEFT JOIN academic.programs p ON p.id = pv.program_id
      LEFT JOIN core.departments d ON d.id = s.department_id AND d.deleted_at IS NULL
      LEFT JOIN platform.users u ON u.id = s.user_id
      LEFT JOIN academic.student_academic_profiles sap ON sap.student_id = s.id
      LEFT JOIN academic.admission_batches ab ON ab.id = sap.admission_batch_id
      LEFT JOIN core.academic_years ay ON ay.id = ab.entry_session_id
      WHERE s.tenant_id = ${tenant}
        AND s.deleted_at IS NULL
        ${studentIdFilter}
      UNION ALL
      SELECT
        sf.id AS member_id,
        NULL::uuid AS student_id,
        sf.id AS staff_profile_id,
        ${staffKindCase()} AS member_kind,
        sf.full_name,
        sf.employee_code AS member_code,
        NULL::text AS roll_number,
        NULL::text AS library_card,
        sf.rfid_no AS rfid,
        d.department_name AS department,
        d.id AS department_id,
        NULL::text AS programme,
        dg.label AS designation,
        NULL::int AS semester,
        NULL::text AS academic_year,
        COALESCE(NULLIF(sf.email, ''), pu.email) AS email,
        COALESCE(NULLIF(sf.mobile, ''), pu.phone) AS phone,
        sf.photo_url AS photo_path,
        sf.created_at AS record_created_at,
        ${staffDerivedCase()} AS derived_status
      FROM academic.staff_profiles sf
      LEFT JOIN core.departments d ON d.id = sf.department_id AND d.deleted_at IS NULL
      LEFT JOIN core.designations dg ON dg.id = sf.designation_id
      LEFT JOIN platform.users pu ON pu.id = sf.portal_user_id
      WHERE sf.tenant_id = ${tenant}
        AND sf.deleted_at IS NULL
        ${staffIdFilter}
    ),
    members AS (
      SELECT
        p.*,
        m.id AS membership_id,
        CASE WHEN m.status = 'BLOCKED' THEN 'BLOCKED' ELSE p.derived_status END AS display_status,
        m.block_reason,
        m.block_note,
        m.blocked_at,
        m.blocked_by_id,
        m.loan_limit,
        m.loan_days,
        m.max_renewals,
        COALESCE(m.fine_exempt, false) AS fine_exempt,
        m.expires_at,
        m.created_at AS membership_since,
        m.synced_at,
        COALESCE(ls.active_loans, 0)::int AS active_loans,
        COALESCE(ls.overdue_loans, 0)::int AS overdue_loans,
        COALESCE(ls.total_loans, 0)::int AS total_loans,
        COALESCE(ls.on_time_returns, 0)::int AS on_time_returns,
        COALESCE(vs.visits, 0)::int AS visits,
        COALESCE(fs.outstanding, 0)::float8 AS outstanding_fine,
        COALESCE(fs.paid, 0)::float8 AS paid_fine,
        COALESCE(fs.waived, 0)::float8 AS waived_fine
      FROM people p
      LEFT JOIN library.library_memberships m
        ON m.tenant_id = ${tenant}
       AND (
         (p.student_id IS NOT NULL AND m.student_id = p.student_id)
         OR (p.staff_profile_id IS NOT NULL AND m.staff_profile_id = p.staff_profile_id)
       )
      LEFT JOIN loan_agg ls
        ON (p.student_id IS NOT NULL AND ls.student_id = p.student_id)
        OR (p.staff_profile_id IS NOT NULL AND ls.staff_profile_id = p.staff_profile_id)
      LEFT JOIN visit_agg vs
        ON (p.student_id IS NOT NULL AND vs.student_id = p.student_id)
        OR (p.staff_profile_id IS NOT NULL AND vs.staff_profile_id = p.staff_profile_id)
      LEFT JOIN fine_agg fs
        ON (p.student_id IS NOT NULL AND fs.student_id = p.student_id)
        OR (p.staff_profile_id IS NOT NULL AND fs.staff_profile_id = p.staff_profile_id)
    ),
    scored AS (
      SELECT members.*,
        LEAST(
          100,
          LEAST(40, visits * 4)
          + LEAST(30, total_loans * 3)
          + CASE
              WHEN total_loans = 0 THEN 20
              ELSE LEAST(20, ROUND((on_time_returns::numeric / NULLIF(total_loans, 0)) * 20)::int)
            END
          + CASE WHEN display_status = 'ACTIVE' THEN 10 ELSE 0 END
        )::int AS reading_score
      FROM members
    )
  `;
}

export function memberWhereSql(filters: MemberDirectoryFilters) {
  const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
  const tab = filters.tab?.toUpperCase();
  if (
    tab === 'STUDENT' ||
    tab === 'FACULTY' ||
    tab === 'STAFF' ||
    tab === 'RESEARCH_SCHOLAR'
  ) {
    parts.push(Prisma.sql`member_kind = ${tab}`);
  } else if (tab === 'INACTIVE') {
    parts.push(Prisma.sql`display_status = 'INACTIVE'`);
  } else if (tab === 'BLOCKED') {
    parts.push(Prisma.sql`display_status = 'BLOCKED'`);
  }
  if (
    filters.status === 'ACTIVE' ||
    filters.status === 'INACTIVE' ||
    filters.status === 'BLOCKED'
  ) {
    parts.push(Prisma.sql`display_status = ${filters.status}`);
  }
  if (filters.departmentId) {
    parts.push(
      Prisma.sql`department_id = CAST(${filters.departmentId} AS uuid)`,
    );
  }
  if (filters.semester != null) {
    parts.push(Prisma.sql`semester = ${filters.semester}`);
  }
  if (filters.academicYear?.trim()) {
    parts.push(Prisma.sql`academic_year = ${filters.academicYear.trim()}`);
  }
  if (filters.hasOverdue) parts.push(Prisma.sql`overdue_loans > 0`);
  if (filters.hasFine) parts.push(Prisma.sql`outstanding_fine > 0`);
  if (filters.hasActiveLoans) parts.push(Prisma.sql`active_loans > 0`);
  if (filters.hasBorrowed) parts.push(Prisma.sql`total_loans > 0`);
  const search = filters.search?.trim();
  if (search) {
    const pattern = likePattern(search);
    parts.push(Prisma.sql`(
      full_name ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(member_code, '') ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(roll_number, '') ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(email, '') ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(phone, '') ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(library_card, '') ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(rfid, '') ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(department, '') ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(programme, '') ILIKE ${pattern} ESCAPE '\\'
      OR member_id::text ILIKE ${pattern} ESCAPE '\\'
    )`);
  }
  return Prisma.join(parts, ' AND ');
}

export function memberOrderSql(sort?: string, sortDir?: string) {
  const direction = sortDir === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  switch (sort) {
    case 'department':
      return Prisma.sql`department ${direction} NULLS LAST, full_name ASC`;
    case 'loans':
      return Prisma.sql`active_loans ${direction}, full_name ASC`;
    case 'fines':
      return Prisma.sql`outstanding_fine ${direction}, full_name ASC`;
    case 'score':
      return Prisma.sql`reading_score ${direction}, full_name ASC`;
    default:
      return Prisma.sql`full_name ${direction}, member_code ASC`;
  }
}
