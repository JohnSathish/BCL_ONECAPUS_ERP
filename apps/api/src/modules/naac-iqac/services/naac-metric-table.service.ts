import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { naacDb } from './naac-prisma.util';

type ColDef = { key: string; label: string; dataType?: string };

@Injectable()
export class NaacMetricTableService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return naacDb(this.prisma);
  }

  private canManage(user: JwtUser) {
    return user.permissions?.includes('naac-iqac:manage') ?? false;
  }

  private async resolveAcademicYear(tenantId: string, year?: string) {
    if (year) return year;
    const settings = await this.db().naacSettings.findUnique({
      where: { tenantId },
    });
    return settings?.activeAqarYear ?? '2025-26';
  }

  private async assertWorkspaceAccess(user: JwtUser, workspaceId: string) {
    const workspace = await this.db().naacMetricWorkspace.findFirst({
      where: { id: workspaceId, tenantId: user.tid },
      include: { assignments: true, metric: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (this.canManage(user)) return workspace;
    if (user.permissions?.includes('naac-iqac:read')) return workspace;
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId: user.tid,
        portalUserId: user.sub,
        deletedAt: null,
      },
      select: { id: true },
    });
    const assigned = workspace.assignments.some(
      (a: { staffProfileId: string }) => staff && a.staffProfileId === staff.id,
    );
    if (!assigned) {
      throw new ForbiddenException('Not assigned to this metric');
    }
    return workspace;
  }

  private metricMatches(codes: string[], metricCode: string) {
    return codes.some((c) => c === metricCode);
  }

  async listTablesForMetric(
    user: JwtUser,
    metricCode: string,
    academicYear?: string,
  ) {
    const year = await this.resolveAcademicYear(user.tid, academicYear);
    const metric = await this.db().naacMetric.findFirst({
      where: { tenantId: user.tid, code: metricCode },
    });
    if (!metric) throw new NotFoundException('Metric not found');

    let workspace = await this.db().naacMetricWorkspace.findUnique({
      where: {
        tenantId_metricId_academicYear: {
          tenantId: user.tid,
          metricId: metric.id,
          academicYear: year,
        },
      },
      include: { assignments: true },
    });
    if (!workspace) {
      workspace = await this.db().naacMetricWorkspace.create({
        data: {
          tenantId: user.tid,
          metricId: metric.id,
          academicYear: year,
          status: 'NOT_STARTED',
          progressPct: 0,
        },
        include: { assignments: true },
      });
    }
    await this.assertWorkspaceAccess(user, workspace.id);

    const defs = await this.db().naacMetricTableDefinition.findMany({
      where: { tenantId: user.tid },
      orderBy: { sortOrder: 'asc' },
    });
    const matched = defs.filter((d: { metricCodes: unknown }) =>
      this.metricMatches(
        Array.isArray(d.metricCodes) ? (d.metricCodes as string[]) : [],
        metricCode,
      ),
    );

    const tables = [];
    for (const def of matched) {
      const dataset = await this.ensureDataset(
        user.tid,
        workspace.id,
        def.id,
        year,
        1,
      );
      const rows = await this.db().naacMetricTableRow.findMany({
        where: { datasetId: dataset.id },
        orderBy: { rowIndex: 'asc' },
      });
      tables.push({
        definition: def,
        dataset,
        rows,
      });
    }

    return {
      academicYear: year,
      metricCode,
      workspaceId: workspace.id,
      tables,
    };
  }

  private async ensureDataset(
    tenantId: string,
    workspaceId: string,
    tableDefinitionId: string,
    academicYear: string,
    yearIndex = 1,
  ) {
    return this.db().naacMetricTableDataset.upsert({
      where: {
        workspaceId_tableDefinitionId_yearIndex: {
          workspaceId,
          tableDefinitionId,
          yearIndex,
        },
      },
      update: {},
      create: {
        tenantId,
        workspaceId,
        tableDefinitionId,
        academicYear,
        yearIndex,
      },
    });
  }

  async getDataset(user: JwtUser, datasetId: string) {
    const dataset = await this.db().naacMetricTableDataset.findFirst({
      where: { id: datasetId, tenantId: user.tid },
      include: {
        tableDefinition: true,
        rows: { orderBy: { rowIndex: 'asc' } },
      },
    });
    if (!dataset) throw new NotFoundException('Dataset not found');
    await this.assertWorkspaceAccess(user, dataset.workspaceId);
    return dataset;
  }

  async upsertRows(
    user: JwtUser,
    datasetId: string,
    rows: Array<{
      id?: string;
      rowIndex?: number;
      cells: Record<string, unknown>;
      source?: string;
      locked?: boolean;
    }>,
  ) {
    const dataset = await this.getDataset(user, datasetId);
    if (
      !user.permissions?.includes('naac-iqac:manage') &&
      !user.permissions?.includes('naac-iqac:collect')
    ) {
      throw new ForbiddenException('collect or manage required');
    }

    const existing = await this.db().naacMetricTableRow.findMany({
      where: { datasetId },
      orderBy: { rowIndex: 'desc' },
      take: 1,
    });
    let nextIndex = (existing[0]?.rowIndex ?? -1) + 1;
    const saved = [];

    for (const row of rows) {
      if (row.id) {
        const cur = await this.db().naacMetricTableRow.findFirst({
          where: { id: row.id, datasetId },
        });
        if (!cur) continue;
        if (cur.locked && !this.canManage(user)) continue;
        saved.push(
          await this.db().naacMetricTableRow.update({
            where: { id: row.id },
            data: {
              cells: row.cells,
              source: row.source ?? 'MANUAL',
              locked: row.locked ?? cur.locked,
            },
          }),
        );
      } else {
        const idx = row.rowIndex ?? nextIndex++;
        saved.push(
          await this.db().naacMetricTableRow.upsert({
            where: {
              datasetId_rowIndex: { datasetId, rowIndex: idx },
            },
            update: {
              cells: row.cells,
              source: row.source ?? 'MANUAL',
            },
            create: {
              tenantId: user.tid,
              datasetId,
              rowIndex: idx,
              cells: row.cells,
              source: row.source ?? 'MANUAL',
            },
          }),
        );
      }
    }

    await this.db().naacAuditEvent.create({
      data: {
        tenantId: user.tid,
        entityType: 'NaacMetricTableDataset',
        entityId: datasetId,
        action: 'UPSERT_ROWS',
        actorId: user.sub,
        payload: { count: saved.length },
      },
    });

    return { datasetId, rows: saved };
  }

  async pullErp(user: JwtUser, datasetId: string) {
    if (
      !user.permissions?.includes('naac-iqac:manage') &&
      !user.permissions?.includes('naac-iqac:collect')
    ) {
      throw new ForbiddenException('collect or manage required');
    }
    const dataset = await this.getDataset(user, datasetId);
    const def = dataset.tableDefinition;
    const columns = (def.columns ?? []) as ColDef[];
    const code = def.code as string;

    const generated = await this.generateErpRows(
      user.tid,
      code,
      columns,
      dataset.academicYear,
    );

    // Keep MANUAL / IMPORT / locked rows
    const keep = await this.db().naacMetricTableRow.findMany({
      where: {
        datasetId,
        OR: [{ source: { in: ['MANUAL', 'IMPORT'] } }, { locked: true }],
      },
      orderBy: { rowIndex: 'asc' },
    });

    await this.db().naacMetricTableRow.deleteMany({
      where: { datasetId, source: 'ERP', locked: false },
    });

    const startIndex = keep.length
      ? Math.max(...keep.map((r: { rowIndex: number }) => r.rowIndex)) + 1
      : 0;

    const created = [];
    for (let i = 0; i < generated.length; i++) {
      created.push(
        await this.db().naacMetricTableRow.create({
          data: {
            tenantId: user.tid,
            datasetId,
            rowIndex: startIndex + i,
            cells: generated[i],
            source: 'ERP',
          },
        }),
      );
    }

    await this.db().naacMetricTableDataset.update({
      where: { id: datasetId },
      data: { lastPulledAt: new Date() },
    });

    const ws = await this.db().naacMetricWorkspace.findFirst({
      where: { id: dataset.workspaceId },
    });
    if (ws?.status === 'NOT_STARTED') {
      await this.db().naacMetricWorkspace.update({
        where: { id: dataset.workspaceId },
        data: {
          status: 'IN_PROGRESS',
          progressPct: Math.max(ws.progressPct, 25),
        },
      });
    }

    await this.db().naacAuditEvent.create({
      data: {
        tenantId: user.tid,
        entityType: 'NaacMetricTableDataset',
        entityId: datasetId,
        action: 'PULL_ERP_TABLE',
        actorId: user.sub,
        payload: { erpRows: created.length, kept: keep.length },
      },
    });

    return this.getDataset(user, datasetId);
  }

  private async generateErpRows(
    tenantId: string,
    tableCode: string,
    columns: ColDef[],
    academicYear: string,
  ): Promise<Record<string, unknown>[]> {
    const mapRow = (values: Record<string, unknown>) => {
      const cells: Record<string, unknown> = {};
      for (const col of columns) {
        cells[col.key] =
          values[col.key] ??
          values[col.label] ??
          this.pickByLabel(values, col.label) ??
          '';
      }
      return cells;
    };

    if (tableCode === '1.1' || tableCode.startsWith('1.1')) {
      return this.fillStudents(tenantId, academicYear, mapRow, columns);
    }
    if (tableCode.includes('2.1_2.2') || tableCode.includes('2.4.2')) {
      return this.fillFaculty(tenantId, mapRow, columns);
    }
    if (tableCode.includes('2.1.1') || tableCode.includes('2.1.2')) {
      return this.fillEnrolmentSeats(tenantId, mapRow, columns);
    }
    if (tableCode.startsWith('3.3.1') || tableCode === '3.3.1') {
      return this.fillPublications(tenantId, mapRow, columns, 'journal');
    }
    if (tableCode.startsWith('3.3.2') || tableCode === '3.3.2') {
      return this.fillPublications(tenantId, mapRow, columns, 'book');
    }
    if (tableCode.startsWith('5.1.1') || tableCode === '5.1.1') {
      return this.fillScholarships(tenantId, mapRow, columns);
    }
    if (tableCode.startsWith('5.1.2') || tableCode === '5.1.2') {
      return this.fillCapacityBuilding(tenantId, mapRow, columns);
    }
    if (tableCode.startsWith('5.2.1') || tableCode === '5.2.1') {
      return this.fillPlacements(tenantId, mapRow, columns);
    }
    if (
      tableCode === '3.1' ||
      tableCode.startsWith('4.1.2') ||
      tableCode.startsWith('4.4.1')
    ) {
      return this.fillExpenditure(
        tenantId,
        academicYear,
        mapRow,
        columns,
        tableCode,
      );
    }
    if (tableCode.startsWith('3.1.1') || tableCode === '3.1.1') {
      return this.fillResearchGrants(tenantId, mapRow, columns);
    }
    if (tableCode.startsWith('3.5.1') || tableCode === '3.5.1') {
      return this.fillMous(tenantId, mapRow, columns);
    }
    if (tableCode.startsWith('2.6.2') || tableCode === '2.6.2') {
      return this.fillPassPercentage(tenantId, academicYear, mapRow, columns);
    }
    if (tableCode.startsWith('2.7.1') || tableCode === '2.7.1') {
      return this.fillSss(tenantId, academicYear, mapRow, columns);
    }
    if (tableCode.startsWith('3.2.2') || tableCode === '3.2.2') {
      return this.fillEvents(tenantId, mapRow, columns, 'workshop');
    }
    if (tableCode.startsWith('3.4.3') || tableCode === '3.4.3') {
      return this.fillEvents(tenantId, mapRow, columns, 'extension');
    }
    if (tableCode.startsWith('1.3.2') || tableCode === '1.3.2') {
      return this.fillInternships(tenantId, mapRow, columns);
    }
    if (tableCode.startsWith('5.3.1') || tableCode === '5.3.1') {
      return this.fillStudentAchievements(tenantId, mapRow, columns);
    }
    if (tableCode.startsWith('6.5.2') || tableCode === '6.5.2') {
      return this.fillIqacMeetings(tenantId, mapRow, columns);
    }
    if (tableCode.includes('1.2.1') || tableCode.includes('1.2.2')) {
      return this.fillValueAddedCourses(tenantId, mapRow, columns);
    }
    if (tableCode.startsWith('5.1.3') || tableCode === '5.1.3') {
      return this.fillCapacityBuilding(tenantId, mapRow, columns);
    }
    if (tableCode.startsWith('5.2.2') || tableCode === '5.2.2') {
      return this.fillCompetitiveExams(tenantId, mapRow, columns);
    }
    if (tableCode.startsWith('5.3.2') || tableCode === '5.3.2') {
      return this.fillSportsCultural(tenantId, mapRow, columns);
    }
    if (tableCode.startsWith('6.3.2') || tableCode === '6.3.2') {
      return this.fillEvents(tenantId, mapRow, columns, 'workshop');
    }
    if (tableCode.startsWith('6.3.3') || tableCode === '6.3.3') {
      return this.fillStaffDevelopment(tenantId, mapRow, columns);
    }

    void academicYear;
    return [];
  }

  private pickByLabel(values: Record<string, unknown>, label: string) {
    const needle = label.toLowerCase();
    for (const [k, v] of Object.entries(values)) {
      if (k.toLowerCase().includes(needle.slice(0, 12))) return v;
    }
    return undefined;
  }

  private async fillStudents(
    tenantId: string,
    academicYear: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const students = await this.prisma.student.findMany({
      where: { tenantId, deletedAt: null },
      take: 500,
      orderBy: { enrollmentNumber: 'asc' },
      include: {
        masterProfile: { select: { fullName: true } },
        programVersion: {
          include: { program: { select: { name: true, code: true } } },
        },
        department: { select: { name: true } },
      },
    });
    const yearLabel = academicYear.split('-')[0] || academicYear;
    return students.map((s) =>
      mapRow({
        year: yearLabel,
        Year: yearLabel,
        name: s.masterProfile?.fullName ?? s.enrollmentNumber,
        Name: s.masterProfile?.fullName ?? s.enrollmentNumber,
        student_enrollment_number: s.enrollmentNumber,
        'Student enrollment number': s.enrollmentNumber,
        date_of_enrolment: s.admissionDate
          ? s.admissionDate.toISOString().slice(0, 10)
          : '',
        'Date of enrolment': s.admissionDate
          ? s.admissionDate.toISOString().slice(0, 10)
          : '',
        programme: s.programVersion?.program?.name ?? '',
        department: s.department?.name ?? '',
        _columns: columns,
      }),
    );
  }

  private async fillFaculty(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const staff = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        staffType: 'TEACHING',
      },
      take: 500,
      include: {
        department: { select: { name: true } },
        designation: { select: { label: true } },
        qualifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    return staff.map((s) =>
      mapRow({
        name: s.fullName,
        Name: s.fullName,
        id_number: s.employeeCode,
        'ID number': s.employeeCode,
        vidwan_id: '',
        'Vidwan Id': '',
        email: s.email ?? s.personalEmail ?? s.publicEmail ?? '',
        Email: s.email ?? s.personalEmail ?? s.publicEmail ?? '',
        gender: s.gender ?? '',
        Gender: s.gender ?? '',
        designation: s.designation?.label ?? s.qualification ?? '',
        Designation: s.designation?.label ?? '',
        date_of_joining_institution: s.joiningDate
          ? s.joiningDate.toISOString().slice(0, 10)
          : '',
        'Date of joining institution': s.joiningDate
          ? s.joiningDate.toISOString().slice(0, 10)
          : '',
        nature_of_appointment_temporary_permanent: s.employmentType ?? '',
        name_of_the_department: s.department?.name ?? '',
        'Name of the Department': s.department?.name ?? '',
        highest_qualification_net_set_slet_ph_d_d_sc_d_litt:
          s.qualifications?.[0]?.qualification ?? s.qualification ?? '',
        _columns: columns,
      }),
    );
  }

  private async fillEnrolmentSeats(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const intakes = await this.prisma.admissionIntake.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        program: { select: { name: true, code: true } },
        _count: { select: { applications: true } },
      },
      take: 200,
    });
    return intakes.map((i) =>
      mapRow({
        programme_name: i.program?.name ?? i.name,
        'Programme name': i.program?.name ?? i.name,
        programme_code: i.program?.code ?? i.code,
        'Programme Code': i.program?.code ?? i.code,
        number_of_seats_sanctioned: i.totalSeats,
        'Number of seats sanctioned': i.totalSeats,
        number_of_students_admitted: i._count?.applications ?? 0,
        'Number of Students admitted': i._count?.applications ?? 0,
        _columns: columns,
      }),
    );
  }

  private async fillPublications(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
    kind: 'journal' | 'book' = 'journal',
  ) {
    const pubs = await this.prisma.staffPublication.findMany({
      where: { tenantId },
      take: 500,
      orderBy: { createdAt: 'desc' },
      include: {
        staffProfile: {
          select: {
            fullName: true,
            department: { select: { name: true } },
          },
        },
      },
    });
    const filtered = pubs.filter((p) => {
      const t = (p.publicationType ?? '').toLowerCase();
      if (kind === 'book') {
        return (
          t.includes('book') || t.includes('chapter') || t.includes('edited')
        );
      }
      return !(
        t.includes('book') ||
        t.includes('chapter') ||
        t.includes('edited')
      );
    });
    return filtered.map((p) => {
      return mapRow({
        title_of_paper: p.title,
        'Title of paper': p.title,
        name_of_the_author_s: p.staffProfile?.fullName ?? p.coAuthors ?? '',
        'Name of the author/s': p.staffProfile?.fullName ?? p.coAuthors ?? '',
        department_of_the_teacher: p.staffProfile?.department?.name ?? '',
        'Department of the teacher': p.staffProfile?.department?.name ?? '',
        name_of_journal: p.journal ?? '',
        'Name of journal': p.journal ?? '',
        calendar_year_of_publication: p.publishedAt
          ? p.publishedAt.getFullYear()
          : '',
        'Calendar Year of publication': p.publishedAt
          ? p.publishedAt.getFullYear()
          : '',
        issn_number: p.isbnIssn ?? '',
        'ISSN number': p.isbnIssn ?? '',
        _columns: columns,
      });
    });
  }

  private async fillScholarships(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const rows = await this.prisma.feeConcession.findMany({
      where: { tenantId, status: 'APPROVED' },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => {
      return mapRow({
        year: new Date().getFullYear(),
        Year: new Date().getFullYear(),
        name_of_the_scheme: r.concessionType || r.reason || 'Concession',
        'Name of the scheme': r.concessionType || r.reason || 'Concession',
        government_non_government: 'Non-government',
        'Government/Non-government': 'Non-government',
        number_of_students_benefited: 1,
        'Number of students benefited': 1,
        amount_in_inr: Number(r.approvedAmount ?? r.value ?? 0),
        'Amount (in INR)': Number(r.approvedAmount ?? r.value ?? 0),
        _columns: columns,
      });
    });
  }

  private async fillPlacements(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const apps = await this.prisma.placementApplication.findMany({
      where: {
        tenantId,
        status: { in: ['OFFERED', 'SELECTED', 'JOINED', 'PLACED'] },
      },
      take: 500,
      include: {
        drive: { include: { recruiter: true } },
      },
    });
    return apps.map((a) =>
      mapRow({
        year: new Date(a.createdAt).getFullYear(),
        Year: new Date(a.createdAt).getFullYear(),
        name_of_student: a.studentId,
        name_of_employer: a.drive?.recruiter?.name ?? '',
        package: a.offerPackageLpa ?? '',
        _columns: columns,
      }),
    );
  }

  private async fillExpenditure(
    tenantId: string,
    academicYear: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
    tableCode: string,
  ) {
    const expenses = await this.prisma.accountingExpense.findMany({
      where: {
        tenantId,
        status: { in: ['APPROVED', 'POSTED', 'PAID'] },
      },
      take: 500,
      orderBy: { expenseDate: 'desc' },
      include: {
        ledgerAccount: { select: { name: true, code: true } },
      },
    });
    const yearLabel = academicYear.split('-')[0] || academicYear;
    return expenses.map((e) => {
      const acct =
        `${e.ledgerAccount?.name ?? ''} ${e.ledgerAccount?.code ?? ''} ${e.description ?? ''}`.toLowerCase();
      const infra =
        acct.includes('infra') ||
        acct.includes('building') ||
        acct.includes('equipment') ||
        acct.includes('augment');
      const maintenance =
        acct.includes('maintenance') ||
        acct.includes('repair') ||
        acct.includes('upkeep');
      const pending =
        tableCode.startsWith('4.') && !infra && !maintenance
          ? 'pending-tag'
          : '';
      return mapRow({
        year: e.expenseDate.getFullYear() || yearLabel,
        Year: e.expenseDate.getFullYear() || yearLabel,
        expenditure_for_infrastructure_development_and_a: infra
          ? Number(e.amount)
          : '',
        expenditure_on_maintenance_of_academic_facilitie: maintenance
          ? Number(e.amount)
          : '',
        expenditure_on_maintenance_of_physical_facilitie: '',
        other_expenses_excluding_salary_inr_in_lakh_d:
          !infra && !maintenance ? Number(e.amount) : '',
        total_expenditure_excluding_salary_inr_in_lakh_e: Number(e.amount),
        budget_allocated: Number(e.amount),
        expenditure: Number(e.amount),
        description: e.description ?? e.ledgerAccount?.name ?? '',
        pending,
        _columns: columns,
      });
    });
  }

  private async fillResearchGrants(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const grants = await this.prisma.researchGrant.findMany({
      where: { tenantId },
      take: 200,
      orderBy: { createdAt: 'desc' },
    });
    return grants.map((g) =>
      mapRow({
        name_of_the_project_endowments_chairs: g.title,
        name_of_the_principal_investigator_co_investigator:
          g.principalInvestigatorId ?? '',
        name_of_the_funding_agency: g.fundingAgency ?? '',
        amount: Number(g.amount ?? 0),
        year_of_award: g.startDate ? g.startDate.getFullYear() : '',
        duration:
          g.endDate && g.startDate
            ? `${g.startDate.toISOString().slice(0, 10)} – ${g.endDate.toISOString().slice(0, 10)}`
            : '',
        _columns: columns,
      }),
    );
  }

  private async fillMous(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const mous = await this.db().naacMou.findMany({
      where: { tenantId },
      take: 200,
      orderBy: { createdAt: 'desc' },
      include: { activities: { take: 3 } },
    });
    return mous.map(
      (m: {
        partnerName: string;
        partnerType: string;
        signedAt: Date | null;
        activities: Array<{ title: string }>;
      }) =>
        mapRow({
          organisation_with_which_mou_is_signed: m.partnerName,
          name_of_the_institution_industry_corporate_house: m.partnerName,
          year_of_signing_mou: m.signedAt ? m.signedAt.getFullYear() : '',
          duration: '',
          list_the_actual_activities_under_each_mou: m.activities
            .map((a) => a.title)
            .join('; '),
          partner_type: m.partnerType,
          _columns: columns,
        }),
    );
  }

  private async fillPassPercentage(
    tenantId: string,
    academicYear: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const results = await this.prisma.examResultSummary.findMany({
      where: { tenantId, deletedAt: null, publishStatus: 'PUBLISHED' },
      take: 1000,
    });
    if (!results.length) {
      return [
        mapRow({
          year: academicYear.split('-')[0],
          pending: 'ExamResultSummary empty — publish results to auto-fill',
          _columns: columns,
        }),
      ];
    }
    const passed = results.filter((r) =>
      ['PASS', 'PASSED', 'PROMOTED'].includes(
        (r.resultStatus ?? '').toUpperCase(),
      ),
    ).length;
    const pct =
      results.length > 0
        ? Math.round((passed / results.length) * 10000) / 100
        : 0;
    return [
      mapRow({
        year: academicYear.split('-')[0],
        number_of_students_appeared: results.length,
        number_of_students_passed: passed,
        pass_percentage: pct,
        _columns: columns,
      }),
    ];
  }

  private async fillSss(
    tenantId: string,
    academicYear: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const campaigns = await this.db().feedbackCampaign.findMany({
      where: {
        tenantId,
        academicYear,
        audience: 'STUDENT',
      },
      include: { _count: { select: { responses: true } } },
      take: 50,
    });
    return campaigns.map(
      (c: {
        title: string;
        academicYear: string;
        status: string;
        _count: { responses: number };
      }) =>
        mapRow({
          year: c.academicYear,
          name_of_the_survey: c.title,
          number_of_students: c._count.responses,
          status: c.status,
          _columns: columns,
        }),
    );
  }

  private async fillEvents(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
    kind: 'workshop' | 'extension',
  ) {
    const events = await this.prisma.governanceEvent.findMany({
      where: { tenantId },
      take: 300,
      orderBy: { startDate: 'desc' },
    });
    const filtered = events.filter((e) => {
      const hay = `${e.eventType} ${e.title}`.toLowerCase();
      if (kind === 'workshop') {
        return (
          hay.includes('workshop') ||
          hay.includes('seminar') ||
          hay.includes('conference')
        );
      }
      return (
        hay.includes('extension') ||
        hay.includes('outreach') ||
        hay.includes('nss') ||
        hay.includes('community')
      );
    });
    return filtered.map((e) =>
      mapRow({
        year: e.startDate.getFullYear(),
        name_of_the_workshop_seminar: e.title,
        name_of_the_activity: e.title,
        date: e.startDate.toISOString().slice(0, 10),
        number_of_participants: '',
        _columns: columns,
      }),
    );
  }

  private async fillInternships(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const rows = await this.prisma.internshipPlacement.findMany({
      where: { tenantId },
      take: 300,
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) =>
      mapRow({
        name_of_the_student: r.studentId,
        program_name: r.title,
        name_of_the_organization: r.company?.name ?? '',
        year: r.startDate ? r.startDate.getFullYear() : '',
        _columns: columns,
      }),
    );
  }

  private async fillStudentAchievements(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const rows = await this.db().naacStudentAchievement.findMany({
      where: { tenantId, status: { in: ['APPROVED', 'PENDING'] } },
      take: 300,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(
      (r: {
        title: string;
        achievementType: string;
        achievementDate: Date | null;
        studentId: string | null;
      }) =>
        mapRow({
          name_of_the_student: r.studentId ?? '',
          name_of_the_award: r.title,
          name_of_the_event: r.title,
          year: r.achievementDate ? r.achievementDate.getFullYear() : '',
          type: r.achievementType,
          _columns: columns,
        }),
    );
  }

  private async fillIqacMeetings(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const meetings = await this.prisma.governanceMeeting.findMany({
      where: { tenantId },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    return meetings.map((m) =>
      mapRow({
        date_of_meeting: m.meetingDate
          ? m.meetingDate.toISOString().slice(0, 10)
          : '',
        title: m.title ?? '',
        year: m.meetingDate
          ? m.meetingDate.getFullYear()
          : new Date(m.createdAt).getFullYear(),
        _columns: columns,
      }),
    );
  }

  private async fillCapacityBuilding(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const events = await this.prisma.governanceEvent.findMany({
      where: { tenantId },
      take: 200,
      orderBy: { startDate: 'desc' },
    });
    const filtered = events.filter((e) => {
      const hay = `${e.eventType} ${e.title}`.toLowerCase();
      return (
        hay.includes('skill') ||
        hay.includes('capacity') ||
        hay.includes('soft skill') ||
        hay.includes('language') ||
        hay.includes('ict')
      );
    });
    return filtered.map((e) =>
      mapRow({
        name_of_the_capability_enhancement_scheme: e.title,
        year: e.startDate.getFullYear(),
        number_of_students_enrolled: '',
        name_of_the_agencies_consultants: '',
        _columns: columns,
      }),
    );
  }

  private fillPendingStub(
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
    tableCode: string,
  ) {
    return [
      mapRow({
        pending: `No ERP rows for ${tableCode} — enter manually or import sheet`,
        _columns: columns,
      }),
    ];
  }

  private async fillValueAddedCourses(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const courses = await this.prisma.course.findMany({
      where: { tenantId, deletedAt: null },
      take: 400,
      orderBy: { code: 'asc' },
      select: { code: true, title: true, courseType: true, credits: true },
    });
    const filtered = courses.filter((c) => {
      const hay = `${c.courseType ?? ''} ${c.title} ${c.code}`.toLowerCase();
      return (
        hay.includes('certificate') ||
        hay.includes('value') ||
        hay.includes('add-on') ||
        hay.includes('addon') ||
        hay.includes('mooc') ||
        hay.includes('swayam') ||
        hay.includes('nptel') ||
        hay.includes('skill') ||
        hay.includes('vac')
      );
    });
    const rows = filtered.length ? filtered : courses.slice(0, 25);
    return rows.map((c) =>
      mapRow({
        name_of_the_certificate_course: c.title,
        name_of_add_on_course: c.title,
        course_code: c.code,
        year: new Date().getFullYear(),
        number_of_students_enrolled: '',
        number_of_students_completing: '',
        _columns: columns,
      }),
    );
  }

  private async fillCompetitiveExams(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const rows = await this.db().naacStudentAchievement.findMany({
      where: {
        tenantId,
        OR: [
          { achievementType: { contains: 'EXAM', mode: 'insensitive' } },
          { achievementType: { contains: 'NET', mode: 'insensitive' } },
          { achievementType: { contains: 'GATE', mode: 'insensitive' } },
          { title: { contains: 'NET', mode: 'insensitive' } },
          { title: { contains: 'GATE', mode: 'insensitive' } },
          { title: { contains: 'SLET', mode: 'insensitive' } },
          { title: { contains: 'competitive', mode: 'insensitive' } },
        ],
      },
      take: 300,
      orderBy: { createdAt: 'desc' },
    });
    if (!rows.length) {
      return this.fillPendingStub(mapRow, columns, '5.2.2');
    }
    return rows.map(
      (r: {
        title: string;
        achievementType: string;
        achievementDate: Date | null;
        studentId: string | null;
      }) =>
        mapRow({
          name_of_the_student: r.studentId ?? '',
          name_of_the_exam: r.title,
          year: r.achievementDate ? r.achievementDate.getFullYear() : '',
          type: r.achievementType,
          _columns: columns,
        }),
    );
  }

  private async fillSportsCultural(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const events = await this.prisma.governanceEvent.findMany({
      where: { tenantId },
      take: 300,
      orderBy: { startDate: 'desc' },
    });
    const filtered = events.filter((e) => {
      const hay = `${e.eventType} ${e.title}`.toLowerCase();
      return (
        hay.includes('sport') ||
        hay.includes('cultural') ||
        hay.includes('fest') ||
        hay.includes('athlet') ||
        hay.includes('music') ||
        hay.includes('drama')
      );
    });
    if (!filtered.length) {
      return this.fillPendingStub(mapRow, columns, '5.3.2');
    }
    return filtered.map((e) =>
      mapRow({
        date_of_event_competition: e.startDate.toISOString().slice(0, 10),
        name_of_the_event_competition: e.title,
        year: e.startDate.getFullYear(),
        number_of_students_participated: '',
        _columns: columns,
      }),
    );
  }

  private async fillStaffDevelopment(
    tenantId: string,
    mapRow: (v: Record<string, unknown>) => Record<string, unknown>,
    columns: ColDef[],
  ) {
    const events = await this.prisma.governanceEvent.findMany({
      where: { tenantId },
      take: 300,
      orderBy: { startDate: 'desc' },
    });
    const filtered = events.filter((e) => {
      const hay = `${e.eventType} ${e.title}`.toLowerCase();
      return (
        hay.includes('fdp') ||
        hay.includes('mdp') ||
        hay.includes('faculty development') ||
        hay.includes('professional development') ||
        hay.includes('training') ||
        hay.includes('workshop')
      );
    });
    if (!filtered.length) {
      return this.fillEvents(tenantId, mapRow, columns, 'workshop');
    }
    return filtered.map((e) =>
      mapRow({
        title_of_the_program: e.title,
        year: e.startDate.getFullYear(),
        date: e.startDate.toISOString().slice(0, 10),
        number_of_participants: '',
        _columns: columns,
      }),
    );
  }

  async exportXlsx(user: JwtUser, datasetId: string) {
    const dataset = await this.getDataset(user, datasetId);
    const columns = (dataset.tableDefinition.columns ?? []) as ColDef[];
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(dataset.tableDefinition.sheetName.slice(0, 31));
    ws.addRow([dataset.tableDefinition.title]);
    ws.addRow(columns.map((c) => c.label));
    for (const row of dataset.rows) {
      const cells = (row.cells ?? {}) as Record<string, unknown>;
      ws.addRow(columns.map((c) => cells[c.key] ?? ''));
    }
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="naac-${dataset.tableDefinition.code}.xlsx"`,
    });
  }

  async importXlsx(
    user: JwtUser,
    datasetId: string,
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('File required');
    if (
      !user.permissions?.includes('naac-iqac:manage') &&
      !user.permissions?.includes('naac-iqac:collect')
    ) {
      throw new ForbiddenException('collect or manage required');
    }
    const dataset = await this.getDataset(user, datasetId);
    const columns = (dataset.tableDefinition.columns ?? []) as ColDef[];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new BadRequestException('No sheet in workbook');

    // Find header row matching column labels
    let headerRow = 2;
    sheet.eachRow((row, n) => {
      if (n > 10) return;
      const vals = row.values as unknown[];
      const joined = vals.map((v) => String(v ?? '')).join('|');
      if (columns.some((c) => joined.includes(c.label.slice(0, 12)))) {
        headerRow = n;
      }
    });

    const imported: Array<{
      rowIndex: number;
      cells: Record<string, unknown>;
      source: string;
    }> = [];
    sheet.eachRow((row, n) => {
      if (n <= headerRow) return;
      const cells: Record<string, unknown> = {};
      let any = false;
      columns.forEach((c, i) => {
        const v = row.getCell(i + 1).value;
        const text =
          v == null
            ? ''
            : typeof v === 'object' && v !== null && 'text' in v
              ? String((v as { text?: string }).text ?? '')
              : String(v);
        cells[c.key] = text;
        if (text) any = true;
      });
      if (any) {
        imported.push({
          rowIndex: imported.length,
          cells,
          source: 'IMPORT',
        });
      }
    });

    await this.db().naacMetricTableRow.deleteMany({
      where: { datasetId, source: 'IMPORT', locked: false },
    });
    return this.upsertRows(user, datasetId, imported);
  }

  async exportWorkbook(user: JwtUser, academicYear?: string) {
    if (
      !user.permissions?.includes('naac-iqac:manage') &&
      !user.permissions?.includes('naac-iqac:reports')
    ) {
      throw new ForbiddenException('reports or manage required');
    }
    const year = await this.resolveAcademicYear(user.tid, academicYear);
    const defs = await this.db().naacMetricTableDefinition.findMany({
      where: { tenantId: user.tid },
      orderBy: { sortOrder: 'asc' },
    });
    const wb = new ExcelJS.Workbook();
    for (const def of defs) {
      const columns = (def.columns ?? []) as ColDef[];
      const ws = wb.addWorksheet(String(def.sheetName).slice(0, 31));
      ws.addRow([def.title]);
      ws.addRow(columns.map((c) => c.label));

      const datasets = await this.db().naacMetricTableDataset.findMany({
        where: {
          tenantId: user.tid,
          academicYear: year,
          tableDefinitionId: def.id,
        },
        include: { rows: { orderBy: { rowIndex: 'asc' } } },
      });
      for (const ds of datasets) {
        for (const row of ds.rows) {
          const cells = (row.cells ?? {}) as Record<string, unknown>;
          ws.addRow(columns.map((c) => cells[c.key] ?? ''));
        }
      }
    }
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="naac-qnms-${year}.xlsx"`,
    });
  }
}
