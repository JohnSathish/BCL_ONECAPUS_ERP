import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateAccountGroupDto,
  CreateLedgerAccountDto,
  ListQueryDto,
  UpdateAccountGroupDto,
  UpdateLedgerAccountDto,
} from '../dto/accounting.dto';
import { AccountingBootstrapService } from './accounting-bootstrap.service';

@Injectable()
export class ChartOfAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bootstrap: AccountingBootstrapService,
  ) {}

  async listGroups(tenantId: string) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    const groups = await this.prisma.accountingAccountGroup.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        ledgers: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    return groups.map((g) => ({
      ...g,
      openingBalance: g.ledgers.reduce(
        (sum, l) => sum + Number(l.openingBalance),
        0,
      ),
      currentBalance: g.ledgers.reduce(
        (sum, l) => sum + Number(l.currentBalance),
        0,
      ),
    }));
  }

  async createGroup(tenantId: string, dto: CreateAccountGroupDto) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    const existing = await this.prisma.accountingAccountGroup.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Account group ${dto.code} already exists`);
    }

    return this.prisma.accountingAccountGroup.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        nature: dto.nature,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder ?? 100,
      },
    });
  }

  async updateGroup(tenantId: string, id: string, dto: UpdateAccountGroupDto) {
    const group = await this.prisma.accountingAccountGroup.findFirst({
      where: { tenantId, id },
    });
    if (!group) throw new NotFoundException('Account group not found');

    return this.prisma.accountingAccountGroup.update({
      where: { id },
      data: dto,
    });
  }

  async listLedgers(tenantId: string, query: ListQueryDto) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      isActive: true,
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                code: { contains: query.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.accountingLedgerAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { group: true },
      }),
      this.prisma.accountingLedgerAccount.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getLedger(tenantId: string, id: string) {
    const ledger = await this.prisma.accountingLedgerAccount.findFirst({
      where: { tenantId, id },
      include: { group: true },
    });
    if (!ledger) throw new NotFoundException('Ledger account not found');
    return ledger;
  }

  async createLedger(tenantId: string, dto: CreateLedgerAccountDto) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    const group = await this.prisma.accountingAccountGroup.findFirst({
      where: { tenantId, id: dto.groupId },
    });
    if (!group) throw new NotFoundException('Account group not found');

    const existing = await this.prisma.accountingLedgerAccount.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Ledger ${dto.code} already exists`);
    }

    const opening = dto.openingBalance ?? 0;
    return this.prisma.accountingLedgerAccount.create({
      data: {
        tenantId,
        groupId: dto.groupId,
        code: dto.code,
        name: dto.name,
        ledgerType: dto.ledgerType ?? 'GENERAL',
        isCash: dto.isCash ?? false,
        isBank: dto.isBank ?? false,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        openingBalance: opening,
        currentBalance: opening,
      },
      include: { group: true },
    });
  }

  async updateLedger(
    tenantId: string,
    id: string,
    dto: UpdateLedgerAccountDto,
  ) {
    const ledger = await this.prisma.accountingLedgerAccount.findFirst({
      where: { tenantId, id },
    });
    if (!ledger) throw new NotFoundException('Ledger account not found');

    return this.prisma.accountingLedgerAccount.update({
      where: { id },
      data: dto,
      include: { group: true },
    });
  }
}
