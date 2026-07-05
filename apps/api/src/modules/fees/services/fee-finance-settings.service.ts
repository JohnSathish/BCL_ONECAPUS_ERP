import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../shared/cache/cache.service';
import {
  COLLECTION_MODE_LABELS,
  COLLECTION_MODE_ORDER,
  INSTITUTION_FEE_DEFAULTS,
  type CollectionModeKey,
  type CollectionModesConfig,
  enabledCollectionModes,
  resolveCollectionModes,
  studentPortalPaymentHints,
} from '../constants/collection-modes.constants';
import { resolveReceiptTemplateFormat } from '../templates/fee-receipt.template';

export const DEFAULT_PAYMENT_METHOD_VALUES = [
  'NONE',
  'cash',
  'college_qr',
  'gateway',
  'cheque',
  'dd',
  'bank_transfer',
  'other',
] as const;

export type DefaultPaymentMethodValue =
  (typeof DEFAULT_PAYMENT_METHOD_VALUES)[number];

export type FeeFinanceSettingsDto = {
  monthlyDueDay?: number;
  lateFeeEnabled?: boolean;
  lateFeeMode?: string;
  lateFeeAmount?: number;
  lateFeeGraceDays?: number;
  receiptPrefix?: string;
  cashReceiptPrefix?: string;
  onlinePaymentEnabled?: boolean;
  cashCollectionEnabled?: boolean;
  paymentRequestExpiryMinutes?: number;
  officeQrEnabled?: boolean;
  blockHallTicketOnDue?: boolean;
  blockRegistrationOnDue?: boolean;
  collectionModes?: Partial<CollectionModesConfig>;
  defaultPaymentMethod?: DefaultPaymentMethodValue | string;
  rememberLastPaymentMethod?: boolean;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class FeeFinanceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  normalize(settings: Record<string, unknown>): Record<string, unknown> {
    const modes = resolveCollectionModes(
      settings as Parameters<typeof resolveCollectionModes>[0],
    );
    const defaultPaymentMethod = String(
      settings.defaultPaymentMethod ?? 'NONE',
    );
    return {
      ...settings,
      collectionModes: modes,
      cashCollectionEnabled: modes.cash,
      onlinePaymentEnabled: modes.gateway,
      officeQrEnabled: modes.upi_qr,
      cashReceiptPrefix: String(settings.cashReceiptPrefix ?? 'DBC/CASH'),
      defaultPaymentMethod,
      rememberLastPaymentMethod: Boolean(
        settings.rememberLastPaymentMethod ?? false,
      ),
      availablePaymentMethods: enabledCollectionModes(modes),
      defaultPaymentMethodOptions: [
        { value: 'NONE', label: 'None (Always ask)', deskId: '' },
        { value: 'cash', label: 'Cash', deskId: 'cash' },
        {
          value: 'college_qr',
          label: 'UPI / QR Payment',
          deskId: 'college_qr',
        },
        {
          value: 'gateway',
          label: 'Online Payment Gateway (Card / Net Banking)',
          deskId: 'gateway',
        },
        { value: 'cheque', label: 'Cheque', deskId: 'cheque' },
        { value: 'dd', label: 'Demand Draft (DD)', deskId: 'dd' },
        {
          value: 'bank_transfer',
          label: 'Bank Transfer (NEFT/RTGS/IMPS)',
          deskId: 'bank_transfer',
        },
        { value: 'other', label: 'POS / Other', deskId: 'other' },
      ],
      studentPortal: studentPortalPaymentHints(
        modes,
        settings.metadata as Record<string, unknown> | null,
      ),
      receiptTemplate: resolveReceiptTemplateFormat(
        settings.metadata as Record<string, unknown> | null,
      ),
      metadata: settings.metadata ?? {},
    };
  }

  async get(tenantId: string) {
    return this.cache.wrap(`fee-settings:${tenantId}`, 3600, async () => {
      let settings = await this.db().feeFinanceSettings.findUnique({
        where: { tenantId },
      });
      if (!settings) {
        settings = await this.db().feeFinanceSettings.create({
          data: {
            tenantId,
            ...INSTITUTION_FEE_DEFAULTS,
            collectionModes: INSTITUTION_FEE_DEFAULTS.collectionModes,
          },
        });
      }
      return this.normalize(settings);
    });
  }

  async getCollectionModes(tenantId: string): Promise<CollectionModesConfig> {
    const settings = await this.get(tenantId);
    return settings.collectionModes as CollectionModesConfig;
  }

  async isModeEnabled(tenantId: string, mode: CollectionModeKey) {
    const modes = await this.getCollectionModes(tenantId);
    return Boolean(modes[mode]);
  }

  async update(user: JwtUser, dto: FeeFinanceSettingsDto) {
    const current = await this.db().feeFinanceSettings.findUnique({
      where: { tenantId: user.tid },
    });
    const currentModes = resolveCollectionModes(current ?? {});

    let nextModes = { ...currentModes };
    if (dto.collectionModes) {
      nextModes = { ...nextModes, ...dto.collectionModes };
    }
    if (dto.onlinePaymentEnabled !== undefined)
      nextModes.gateway = dto.onlinePaymentEnabled;
    if (dto.cashCollectionEnabled !== undefined)
      nextModes.cash = dto.cashCollectionEnabled;
    if (dto.officeQrEnabled !== undefined)
      nextModes.upi_qr = dto.officeQrEnabled;

    const updated = await this.db().feeFinanceSettings.update({
      where: { tenantId: user.tid },
      data: {
        ...(dto.monthlyDueDay !== undefined
          ? { monthlyDueDay: dto.monthlyDueDay }
          : {}),
        ...(dto.lateFeeEnabled !== undefined
          ? { lateFeeEnabled: dto.lateFeeEnabled }
          : {}),
        ...(dto.lateFeeMode !== undefined
          ? { lateFeeMode: dto.lateFeeMode }
          : {}),
        ...(dto.lateFeeAmount !== undefined
          ? { lateFeeAmount: dto.lateFeeAmount }
          : {}),
        ...(dto.lateFeeGraceDays !== undefined
          ? { lateFeeGraceDays: dto.lateFeeGraceDays }
          : {}),
        ...(dto.receiptPrefix !== undefined
          ? { receiptPrefix: dto.receiptPrefix }
          : {}),
        ...(dto.cashReceiptPrefix !== undefined
          ? { cashReceiptPrefix: dto.cashReceiptPrefix }
          : {}),
        ...(dto.paymentRequestExpiryMinutes !== undefined
          ? { paymentRequestExpiryMinutes: dto.paymentRequestExpiryMinutes }
          : {}),
        ...(dto.blockHallTicketOnDue !== undefined
          ? { blockHallTicketOnDue: dto.blockHallTicketOnDue }
          : {}),
        ...(dto.blockRegistrationOnDue !== undefined
          ? { blockRegistrationOnDue: dto.blockRegistrationOnDue }
          : {}),
        ...(dto.defaultPaymentMethod !== undefined
          ? {
              defaultPaymentMethod: DEFAULT_PAYMENT_METHOD_VALUES.includes(
                dto.defaultPaymentMethod as DefaultPaymentMethodValue,
              )
                ? dto.defaultPaymentMethod
                : 'NONE',
            }
          : {}),
        ...(dto.rememberLastPaymentMethod !== undefined
          ? { rememberLastPaymentMethod: dto.rememberLastPaymentMethod }
          : {}),
        ...(dto.metadata !== undefined
          ? {
              metadata: {
                ...((current?.metadata as Record<string, unknown> | null) ??
                  {}),
                ...dto.metadata,
              },
            }
          : {}),
        collectionModes: nextModes,
        onlinePaymentEnabled: nextModes.gateway,
        cashCollectionEnabled: nextModes.cash,
        officeQrEnabled: nextModes.upi_qr,
      },
    });
    await this.cache.del(`fee-settings:${user.tid}`);
    return this.normalize(updated);
  }

  collectionModeCatalog() {
    return COLLECTION_MODE_ORDER.map((key) => ({
      key,
      label: COLLECTION_MODE_LABELS[key],
    }));
  }

  dueDateForPeriod(tenantId: string, billingPeriod: string) {
    return this.get(tenantId).then((s) => {
      const [year, month] = billingPeriod.split('-').map(Number);
      const day = Number(s.monthlyDueDay) || 10;
      return new Date(year, month - 1, day);
    });
  }
}
