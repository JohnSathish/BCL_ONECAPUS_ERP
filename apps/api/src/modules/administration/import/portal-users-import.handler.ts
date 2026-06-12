import { Injectable } from '@nestjs/common';
import { createWorkbookWithSheets } from '../../../common/import/excel.util';
import type {
  ImportModuleHandler,
  ImportModuleHandlerContext,
  ImportRowValidationResult,
  ParsedImportRow,
} from '../../../common/import/import.types';
import { PrismaService } from '../../../database/prisma.service';
import { UserProvisioningService } from '../services/user-provisioning.service';

export type NormalizedPortalUserRow = {
  email: string;
  roleSlug: string;
  username?: string;
  displayName?: string;
  phone?: string;
  accountStatus?: string;
};

@Injectable()
export class PortalUsersImportHandler implements ImportModuleHandler<NormalizedPortalUserRow> {
  readonly module = 'PORTAL_USERS' as const;
  readonly columnDefs = [
    { key: 'email', header: 'Email', required: true },
    { key: 'role', header: 'Role Slug', required: true },
    { key: 'username', header: 'Username', required: false },
    { key: 'displayName', header: 'Display Name', required: false },
    { key: 'phone', header: 'Phone', required: false },
    { key: 'status', header: 'Status', required: false },
  ];
  readonly nepForbiddenHeaders: string[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: UserProvisioningService,
  ) {}

  async parseAndValidate(
    tenantId: string,
    rows: ParsedImportRow[],
  ): Promise<ImportRowValidationResult[]> {
    const roles = await this.prisma.role.findMany({
      where: { tenantId, deletedAt: null },
    });
    const roleSlugs = new Set(roles.map((r) => r.slug));
    const emails = new Set<string>();

    return rows.map((row) => {
      const errors: string[] = [];
      const email = String(row.raw.email ?? row.raw.Email ?? '')
        .trim()
        .toLowerCase();
      const roleSlug = String(row.raw.role ?? row.raw['Role Slug'] ?? '')
        .trim()
        .toLowerCase();
      const username =
        String(row.raw.username ?? row.raw.Username ?? '').trim() || undefined;
      const displayName =
        String(row.raw.displayName ?? row.raw['Display Name'] ?? '').trim() ||
        undefined;
      const phone =
        String(row.raw.phone ?? row.raw.Phone ?? '').trim() || undefined;
      const accountStatus = String(row.raw.status ?? row.raw.Status ?? 'active')
        .trim()
        .toLowerCase();

      if (!email) errors.push('Email is required');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        errors.push('Invalid email');
      else if (emails.has(email)) errors.push('Duplicate email in file');
      else emails.add(email);

      if (!roleSlug) errors.push('Role slug is required');
      else if (!roleSlugs.has(roleSlug))
        errors.push(`Unknown role: ${roleSlug}`);

      const normalized: NormalizedPortalUserRow = {
        email,
        roleSlug,
        username,
        displayName,
        phone,
        accountStatus,
      };

      return {
        rowNumber: row.rowNumber,
        status: errors.length ? 'INVALID' : 'VALID',
        raw: row.raw,
        normalized: errors.length ? undefined : normalized,
        errors,
        displayCode: email,
        displayTitle: displayName ?? email,
      };
    });
  }

  async commitRows(
    ctx: ImportModuleHandlerContext,
    rows: { rowNumber: number; normalized: NormalizedPortalUserRow }[],
  ) {
    const results: { rowNumber: number; entityId: string }[] = [];
    for (const row of rows) {
      const n = row.normalized;
      const { user } = await this.provisioning.ensureUserWithRoles(
        ctx.tenantId,
        n.email,
        [n.roleSlug],
        {
          username: n.username,
          displayName: n.displayName,
          phone: n.phone,
          accountStatus: n.accountStatus ?? 'active',
          mustResetPassword: true,
        },
      );
      results.push({ rowNumber: row.rowNumber, entityId: user.id });
    }
    return results;
  }

  async buildTemplateWorkbook(): Promise<Buffer> {
    return createWorkbookWithSheets([
      {
        name: 'Portal Users',
        headers: this.columnDefs.map((c) => c.header),
        rows: [
          [
            'student@demo.edu',
            'student',
            '',
            'Demo Student',
            '9876543210',
            'active',
          ],
        ],
      },
    ]);
  }

  async buildErrorReportWorkbook(
    rows: ImportRowValidationResult[],
  ): Promise<Buffer> {
    return createWorkbookWithSheets([
      {
        name: 'Errors',
        headers: ['Row', 'Email', 'Errors'],
        rows: rows
          .filter((r) => r.status === 'INVALID')
          .map((r) => [
            r.rowNumber,
            String(r.raw.email ?? r.raw.Email ?? ''),
            r.errors.join('; '),
          ]),
      },
    ]);
  }
}
