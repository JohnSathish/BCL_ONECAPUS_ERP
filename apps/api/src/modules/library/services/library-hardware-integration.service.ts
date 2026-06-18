import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import type { HardwareScanDto } from '../dto/library.dto';
import { LibraryAccessService } from './library-access.service';
import { LibraryMemberLookupService } from './library-member-lookup.service';
import { LibrarySettingsService } from './library-settings.service';

@Injectable()
export class LibraryHardwareIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LibraryAccessService,
    private readonly lookup: LibraryMemberLookupService,
    private readonly settings: LibrarySettingsService,
  ) {}

  /**
   * RFID / biometric / barcode reader at library gate or CAMS LIBRARY access point.
   * Optionally mirrors the event into CAMS EntryExitLog when accessPointId is supplied.
   */
  async hardwareScan(tenantId: string, dto: HardwareScanDto) {
    const libSettings = await this.settings.getSettings(tenantId);
    const method = (dto.method ?? 'RFID').toUpperCase();

    if (method === 'RFID' && libSettings.rfidEntryEnabled === false) {
      throw new BadRequestException(
        'RFID library entry is disabled in settings',
      );
    }

    const scanCode = dto.scanCode.trim();
    if (!scanCode) throw new BadRequestException('scanCode is required');

    let profile;
    try {
      profile = await this.lookup.lookup(tenantId, scanCode);
    } catch {
      throw new NotFoundException(`No member for ${method} identifier`);
    }

    const entryMethod =
      method === 'BIOMETRIC'
        ? 'BIOMETRIC'
        : method === 'BARCODE'
          ? 'BARCODE'
          : 'RFID';

    const result = await this.access.scanWithMethod(
      tenantId,
      {
        scanCode,
        zoneId: dto.zoneId,
      },
      entryMethod,
    );

    let camsLogId: string | null = null;
    if (dto.accessPointId) {
      const point = await this.prisma.accessPoint.findFirst({
        where: { tenantId, id: dto.accessPointId, deletedAt: null },
      });
      if (!point) throw new NotFoundException('Access point not found');

      const direction = result.action === 'ENTRY' ? 'IN' : 'OUT';
      const log = await this.prisma.entryExitLog.create({
        data: {
          id: randomUUID(),
          tenantId,
          accessPointId: point.id,
          direction,
          allowed: true,
          memberType: profile.memberType,
          studentId: profile.studentId ?? null,
          staffProfileId: profile.staffProfileId ?? null,
          visitorId: profile.visitorId ?? null,
          displayName: profile.fullName,
          enrollmentNumber: profile.registrationNumber ?? null,
          programme: profile.programme ?? null,
          department: profile.department ?? null,
          scanCode,
          entryMethod,
          metadata: {
            source: 'library_hardware_integration',
            libraryVisitId: result.visit.id,
          },
        },
      });
      camsLogId = log.id;
    }

    return {
      ...result,
      entryMethod,
      camsLogId,
      hardwareMethod: method,
    };
  }

  /** Resolve CAMS LIBRARY access point by code and run a kiosk-compatible scan. */
  async camsLibraryBridge(
    tenantId: string,
    accessPointCode: string,
    scanCode: string,
    method?: string,
  ) {
    const point = await this.prisma.accessPoint.findFirst({
      where: {
        tenantId,
        code: accessPointCode,
        deletedAt: null,
        accessType: 'LIBRARY',
      },
    });
    if (!point) {
      throw new NotFoundException('LIBRARY access point not found');
    }

    return this.hardwareScan(tenantId, {
      scanCode,
      method: method ?? 'RFID',
      accessPointId: point.id,
    });
  }
}
