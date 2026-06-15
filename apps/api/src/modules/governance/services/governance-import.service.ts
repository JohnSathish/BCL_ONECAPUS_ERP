import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  createWorkbookWithSheets,
  parseExcelDataSheet,
} from '../../../common/import/excel.util';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import type { ReviewImportDraftDto } from '../dto/governance.dto';
import { governanceDb } from './governance-prisma.util';

type ParsedMemberDraft = {
  displayName: string;
  role?: string;
  designation?: string;
  email?: string;
  mobile?: string;
  employeeCode?: string;
  staffProfileId?: string;
  userId?: string;
  isExternal?: boolean;
  staffMatchConfidence?: number;
};

type ParsedCommitteeDraft = {
  name: string;
  shortCode?: string;
  category?: string;
  committeeType?: string;
  description?: string;
  members?: ParsedMemberDraft[];
};

type StaffIndexRow = {
  id: string;
  fullName: string;
  employeeCode: string | null;
  shortCode: string | null;
  email: string | null;
  portalUserId: string | null;
};

const EXCEL_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

@Injectable()
export class GovernanceImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async uploadPdf(user: JwtUser, file?: Express.Multer.File) {
    if (!file?.buffer?.length)
      throw new BadRequestException('PDF file is required');
    if (file.mimetype !== 'application/pdf')
      throw new BadRequestException('Only PDF files are supported');

    const storageKey = `governance/${user.tid}/imports/${Date.now()}-${file.originalname}`;
    await this.storage.put(storageKey, file.buffer, {
      contentType: 'application/pdf',
    });

    const pdfParse = (await import('pdf-parse')).default as (
      buffer: Buffer,
    ) => Promise<{ text: string }>;
    const parsed = await pdfParse(file.buffer);
    const drafts = this.parseCommitteeText(parsed.text);

    return this.createBatchFromDrafts(user, {
      fileName: file.originalname,
      storageKey,
      rawText: parsed.text.slice(0, 50000),
      drafts,
      source: 'PDF',
    });
  }

  async uploadExcel(user: JwtUser, file?: Express.Multer.File) {
    if (!file?.buffer?.length)
      throw new BadRequestException('Excel file is required');
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (
      !['xlsx', 'xls', 'csv'].includes(ext ?? '') &&
      !EXCEL_MIME_TYPES.has(file.mimetype)
    ) {
      throw new BadRequestException('Only .xlsx Excel files are supported');
    }

    const storageKey = `governance/${user.tid}/imports/${Date.now()}-${file.originalname}`;
    await this.storage.put(storageKey, file.buffer, {
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const staffIndex = await this.loadStaffIndex(user.tid);
    const drafts = await this.parseExcelBuffer(file.buffer, staffIndex);

    return this.createBatchFromDrafts(user, {
      fileName: file.originalname,
      storageKey,
      rawText: `Excel import: ${drafts.length} committee(s), ${drafts.reduce((n, d) => n + (d.members?.length ?? 0), 0)} member row(s)`,
      drafts,
      source: 'EXCEL',
    });
  }

  async downloadTemplate(): Promise<Buffer> {
    return createWorkbookWithSheets([
      {
        name: 'Instructions',
        headers: ['Guidance'],
        notes: [
          'Use the Committees sheet for committee master rows (one row per committee).',
          'Use the Members sheet for member rows (one row per member). Link members via short_code.',
          'Staff matching: employee_code is tried first, then email, then exact/partial name match.',
          'Set external=Y for non-staff members. Leave employee_code blank for external members.',
          'After upload, review drafts on Committee Master before Approve & create.',
        ],
      },
      {
        name: 'Committees',
        headers: [
          'committee_name',
          'short_code',
          'category',
          'committee_type',
          'description',
        ],
        rows: [
          [
            'Internal Quality Assurance Cell',
            'IQAC',
            'QUALITY',
            'STATUTORY',
            'NAAC-aligned IQAC',
          ],
          [
            'Academic Council',
            'AC',
            'ACADEMIC',
            'STATUTORY',
            'Academic policy and curriculum approval',
          ],
          [
            'Examination Committee',
            'EXAM',
            'EXAMINATION',
            'STANDING',
            'Examination conduct and malpractice',
          ],
        ],
      },
      {
        name: 'Members',
        headers: [
          'short_code',
          'member_name',
          'role',
          'designation',
          'employee_code',
          'email',
          'mobile',
          'external',
        ],
        rows: [
          [
            'IQAC',
            'Fr. Principal Name',
            'CHAIRPERSON',
            'Principal',
            'DBCTCH-26-001',
            '',
            '',
            'N',
          ],
          [
            'IQAC',
            'Dr. IQAC Coordinator',
            'COORDINATOR',
            'Associate Professor',
            'DBCTCH-26-002',
            '',
            '',
            'N',
          ],
          [
            'AC',
            'External Expert',
            'MEMBER',
            'NAAC Peer',
            '',
            'expert@example.com',
            '',
            'Y',
          ],
        ],
      },
    ]);
  }

  private async createBatchFromDrafts(
    user: JwtUser,
    input: {
      fileName: string;
      storageKey: string;
      rawText: string;
      drafts: ParsedCommitteeDraft[];
      source: 'PDF' | 'EXCEL';
    },
  ) {
    const batch = await this.db().governanceImportBatch.create({
      data: {
        tenantId: user.tid,
        fileName: input.fileName,
        storageKey: input.storageKey,
        status: input.drafts.length ? 'PARSED' : 'FAILED',
        rawText: input.rawText.slice(0, 50000),
        createdById: user.sub,
      },
    });

    if (input.drafts.length) {
      await this.db().governanceImportDraft.createMany({
        data: input.drafts.map((draft) => ({
          tenantId: user.tid,
          batchId: batch.id,
          parsedJson: draft,
          confidence: this.scoreDraftConfidence(draft),
          reviewStatus: 'PENDING',
        })),
      });
    }

    return this.getBatch(user.tid, batch.id);
  }

  private scoreDraftConfidence(draft: ParsedCommitteeDraft) {
    const members = draft.members ?? [];
    if (!members.length) return 0.45;
    const matched = members.filter(
      (m) => m.staffProfileId || m.isExternal,
    ).length;
    const ratio = matched / members.length;
    return Math.min(0.98, 0.55 + ratio * 0.4);
  }

  private async parseExcelBuffer(buffer: Buffer, staffIndex: StaffIndexRow[]) {
    const committeeRows = await parseExcelDataSheet(buffer, {
      sheetName: 'Committees',
      dataStartRow: 2,
    });
    const memberRows = await parseExcelDataSheet(buffer, {
      sheetName: 'Members',
      dataStartRow: 2,
    });

    const byCode = new Map<string, ParsedCommitteeDraft>();

    for (const row of committeeRows) {
      const raw = row.raw;
      const name = this.cell(raw, [
        'committee_name',
        'committeeName',
        'name',
        'committee',
      ]);
      if (!name) continue;
      const shortCode = (
        this.cell(raw, ['short_code', 'shortCode', 'code']) ??
        this.deriveShortCode(name)
      ).toUpperCase();
      byCode.set(shortCode, {
        name,
        shortCode,
        category: this.cell(raw, ['category']) ?? this.inferCategory(name),
        committeeType:
          this.cell(raw, ['committee_type', 'committeeType', 'type']) ??
          'STANDING',
        description: this.cell(raw, ['description']),
        members: [],
      });
    }

    for (const row of memberRows) {
      const raw = row.raw;
      const shortCode = (
        this.cell(raw, [
          'short_code',
          'shortCode',
          'committee_code',
          'committeeCode',
        ]) ?? ''
      ).toUpperCase();
      const displayName = this.cell(raw, [
        'member_name',
        'memberName',
        'staff_name',
        'staffName',
        'name',
        'display_name',
        'displayName',
      ]);
      if (!shortCode || !displayName) continue;

      let committee = byCode.get(shortCode);
      if (!committee) {
        committee = {
          name: shortCode,
          shortCode,
          category: 'OTHER',
          committeeType: 'STANDING',
          members: [],
        };
        byCode.set(shortCode, committee);
      }

      const employeeCode = this.cell(raw, [
        'employee_code',
        'employeeCode',
        'staff_code',
        'staffCode',
      ]);
      const email = this.cell(raw, ['email']);
      const externalFlag = this.cell(raw, [
        'external',
        'is_external',
        'isExternal',
      ]);
      const isExternal = ['y', 'yes', 'true', '1'].includes(
        (externalFlag ?? '').toLowerCase(),
      );

      const match = !isExternal
        ? this.matchStaff(staffIndex, { displayName, employeeCode, email })
        : null;

      committee.members!.push({
        displayName,
        role: (this.cell(raw, ['role']) ?? 'MEMBER').toUpperCase(),
        designation: this.cell(raw, ['designation']),
        email: email ?? undefined,
        mobile: this.cell(raw, ['mobile', 'phone']) ?? undefined,
        employeeCode: employeeCode ?? undefined,
        staffProfileId: match?.staffProfileId,
        userId: match?.userId ?? undefined,
        isExternal: isExternal || !match?.staffProfileId,
        staffMatchConfidence: match?.confidence,
      });
    }

    if (!byCode.size) {
      const flatRows = await parseExcelDataSheet(buffer, { dataStartRow: 2 });
      return this.parseFlatExcelRows(flatRows, staffIndex);
    }

    return [...byCode.values()].filter((draft) => draft.name);
  }

  private parseFlatExcelRows(
    rows: Awaited<ReturnType<typeof parseExcelDataSheet>>,
    staffIndex: StaffIndexRow[],
  ) {
    const byKey = new Map<string, ParsedCommitteeDraft>();

    for (const row of rows) {
      const raw = row.raw;
      const name = this.cell(raw, [
        'committee_name',
        'committeeName',
        'committee',
      ]);
      const displayName = this.cell(raw, [
        'member_name',
        'memberName',
        'staff_name',
        'staffName',
        'name',
      ]);
      if (!name) continue;

      const shortCode = (
        this.cell(raw, ['short_code', 'shortCode', 'code']) ??
        this.deriveShortCode(name)
      ).toUpperCase();
      const key = shortCode;
      let committee = byKey.get(key);
      if (!committee) {
        committee = {
          name,
          shortCode,
          category: this.cell(raw, ['category']) ?? this.inferCategory(name),
          committeeType:
            this.cell(raw, ['committee_type', 'committeeType', 'type']) ??
            'STANDING',
          description: this.cell(raw, ['description']),
          members: [],
        };
        byKey.set(key, committee);
      }

      if (!displayName) continue;

      const employeeCode = this.cell(raw, [
        'employee_code',
        'employeeCode',
        'staff_code',
        'staffCode',
      ]);
      const email = this.cell(raw, ['email']);
      const externalFlag = this.cell(raw, [
        'external',
        'is_external',
        'isExternal',
      ]);
      const isExternal = ['y', 'yes', 'true', '1'].includes(
        (externalFlag ?? '').toLowerCase(),
      );
      const match = !isExternal
        ? this.matchStaff(staffIndex, { displayName, employeeCode, email })
        : null;

      committee.members!.push({
        displayName,
        role: (this.cell(raw, ['role']) ?? 'MEMBER').toUpperCase(),
        designation: this.cell(raw, ['designation']),
        email: email ?? undefined,
        mobile: this.cell(raw, ['mobile', 'phone']) ?? undefined,
        employeeCode: employeeCode ?? undefined,
        staffProfileId: match?.staffProfileId,
        userId: match?.userId ?? undefined,
        isExternal: isExternal || !match?.staffProfileId,
        staffMatchConfidence: match?.confidence,
      });
    }

    return [...byKey.values()];
  }

  private cell(raw: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = raw[key];
      if (value == null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return undefined;
  }

  private async loadStaffIndex(tenantId: string): Promise<StaffIndexRow[]> {
    return this.prisma.staffProfile.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        shortCode: true,
        email: true,
        portalUserId: true,
      },
    });
  }

  private matchStaff(
    staffList: StaffIndexRow[],
    input: { displayName?: string; employeeCode?: string; email?: string },
  ) {
    const code = input.employeeCode?.trim().toUpperCase();
    if (code) {
      const byCode = staffList.find(
        (s) =>
          s.employeeCode?.toUpperCase() === code ||
          s.shortCode?.toUpperCase() === code,
      );
      if (byCode) {
        return {
          staffProfileId: byCode.id,
          userId: byCode.portalUserId,
          confidence: 1,
        };
      }
    }

    const email = input.email?.trim().toLowerCase();
    if (email) {
      const byEmail = staffList.find((s) => s.email?.toLowerCase() === email);
      if (byEmail) {
        return {
          staffProfileId: byEmail.id,
          userId: byEmail.portalUserId,
          confidence: 0.95,
        };
      }
    }

    const name = this.normalizeName(input.displayName ?? '');
    if (!name) return null;

    const exact = staffList.find(
      (s) => this.normalizeName(s.fullName) === name,
    );
    if (exact) {
      return {
        staffProfileId: exact.id,
        userId: exact.portalUserId,
        confidence: 0.9,
      };
    }

    const tokens = name.split(' ').filter((t) => t.length > 2);
    const candidates = staffList
      .map((s) => {
        const staffName = this.normalizeName(s.fullName);
        const overlap = tokens.filter((t) => staffName.includes(t)).length;
        return { staff: s, overlap, staffName };
      })
      .filter((c) => c.overlap >= Math.min(2, tokens.length))
      .sort((a, b) => b.overlap - a.overlap);

    if (candidates.length === 1) {
      return {
        staffProfileId: candidates[0].staff.id,
        userId: candidates[0].staff.portalUserId,
        confidence: 0.75,
      };
    }

    const partial = staffList.find((s) => {
      const staffName = this.normalizeName(s.fullName);
      return staffName.includes(name) || name.includes(staffName);
    });
    if (partial) {
      return {
        staffProfileId: partial.id,
        userId: partial.portalUserId,
        confidence: 0.65,
      };
    }

    return null;
  }

  private normalizeName(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async listBatches(tenantId: string) {
    return this.db().governanceImportBatch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { drafts: true } } },
      take: 50,
    });
  }

  async getBatch(tenantId: string, batchId: string) {
    const batch = await this.db().governanceImportBatch.findFirst({
      where: { id: batchId, tenantId },
      include: { drafts: { orderBy: { createdAt: 'asc' } } },
    });
    if (!batch) throw new NotFoundException('Import batch not found');
    return batch;
  }

  async reviewDraft(user: JwtUser, draftId: string, dto: ReviewImportDraftDto) {
    const draft = await this.db().governanceImportDraft.findFirst({
      where: { id: draftId, tenantId: user.tid },
    });
    if (!draft) throw new NotFoundException('Draft not found');

    return this.db().governanceImportDraft.update({
      where: { id: draftId },
      data: {
        reviewStatus: dto.reviewStatus,
        parsedJson: dto.parsedJson ?? draft.parsedJson,
      },
    });
  }

  async commitDraft(user: JwtUser, draftId: string) {
    const draft = await this.db().governanceImportDraft.findFirst({
      where: { id: draftId, tenantId: user.tid },
    });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.reviewStatus !== 'APPROVED') {
      throw new BadRequestException('Draft must be approved before commit');
    }

    const parsed = draft.parsedJson as ParsedCommitteeDraft;
    const shortCode = (
      parsed.shortCode ?? this.deriveShortCode(parsed.name)
    ).toUpperCase();

    const committee = await this.db().governanceCommittee.upsert({
      where: { tenantId_shortCode: { tenantId: user.tid, shortCode } },
      create: {
        tenantId: user.tid,
        name: parsed.name,
        shortCode,
        category: parsed.category ?? 'OTHER',
        description: parsed.description,
        createdById: user.sub,
      },
      update: {
        name: parsed.name,
        description: parsed.description,
        category: parsed.category ?? 'OTHER',
      },
    });

    if (parsed.members?.length) {
      for (const member of parsed.members) {
        let userId = member.userId;
        if (!userId && member.staffProfileId) {
          const staff = await this.prisma.staffProfile.findFirst({
            where: {
              id: member.staffProfileId,
              tenantId: user.tid,
              deletedAt: null,
            },
            select: { portalUserId: true },
          });
          userId = staff?.portalUserId ?? undefined;
        }

        await this.db().governanceCommitteeMember.create({
          data: {
            tenantId: user.tid,
            committeeId: committee.id,
            displayName: member.displayName,
            role: member.role ?? 'MEMBER',
            designation: member.designation,
            staffProfileId: member.staffProfileId,
            userId,
            email: member.email,
            mobile: member.mobile,
            isExternal: member.isExternal ?? !member.staffProfileId,
          },
        });
      }
    }

    await this.db().governanceImportDraft.update({
      where: { id: draftId },
      data: {
        reviewStatus: 'COMMITTED',
        committedAt: new Date(),
        committeeId: committee.id,
      },
    });

    await this.db().governanceImportBatch.update({
      where: { id: draft.batchId },
      data: { status: 'COMMITTED' },
    });

    return committee;
  }

  private parseCommitteeText(text: string): ParsedCommitteeDraft[] {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const drafts: ParsedCommitteeDraft[] = [];
    let current: ParsedCommitteeDraft | null = null;

    for (const line of lines) {
      const committeeMatch = line.match(
        /^(committee|cell|council|club|unit)\s*[:\-]\s*(.+)$/i,
      );
      if (committeeMatch) {
        if (current) drafts.push(current);
        const name = committeeMatch[2].trim();
        current = {
          name,
          shortCode: this.deriveShortCode(name),
          category: this.inferCategory(name),
          members: [],
        };
        continue;
      }

      const memberMatch = line.match(/^(\d+[\).\s]+)?(.+?)(?:\s[-–—]\s(.+))?$/);
      if (current && memberMatch && !/^(minutes|agenda|meeting)/i.test(line)) {
        const displayName = memberMatch[2]?.trim();
        if (displayName && displayName.length > 2) {
          current.members!.push({
            displayName,
            designation: memberMatch[3]?.trim(),
            role: /convener|chair|secretary/i.test(line)
              ? 'CONVENER'
              : 'MEMBER',
          });
        }
      }
    }

    if (current) drafts.push(current);

    if (!drafts.length && lines.length) {
      drafts.push({
        name: lines[0].slice(0, 120),
        shortCode: this.deriveShortCode(lines[0]),
        category: 'OTHER',
        members: lines
          .slice(1, 15)
          .map((line) => ({ displayName: line.slice(0, 80), role: 'MEMBER' })),
      });
    }

    return drafts;
  }

  private deriveShortCode(name: string) {
    const words = name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 6).toUpperCase();
    return words
      .slice(0, 4)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }

  private inferCategory(name: string) {
    const lower = name.toLowerCase();
    if (/iqac|naac|quality/.test(lower)) return 'QUALITY';
    if (/academic|syllabus|curriculum/.test(lower)) return 'ACADEMIC';
    if (/exam/.test(lower)) return 'EXAMINATION';
    if (/admission/.test(lower)) return 'ADMISSION';
    if (/nss|ncc|sports|cultural|green/.test(lower)) return 'CO_CURRICULAR';
    if (/icc|grievance|anti-ragging|women|sc\/st/.test(lower))
      return 'STUDENT_WELFARE';
    if (/finance|purchase/.test(lower)) return 'FINANCE';
    if (/research|rusa|rdc/.test(lower)) return 'RESEARCH';
    if (/rti|governing|admin/.test(lower)) return 'ADMINISTRATIVE';
    return 'OTHER';
  }
}
