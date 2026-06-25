import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../../shared/queue/queue.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { DirectTcpBiometricConnector } from './connectors/direct-tcp-biometric.connector';
import { DirectZkBiometricConnector } from './connectors/direct-zk-biometric.connector';
import { ETimeTrackLiteWebConnector } from './connectors/etime-track-lite-web.connector';
import { MiddlewareBiometricConnector } from './connectors/middleware-biometric.connector';
import type {
  BiometricConnector,
  DeviceUser,
  PushResult,
  RawPunchInput,
} from './connectors/biometric-connector';
import { StaffAttendanceEngineService } from './staff-attendance-engine.service';
import type {
  AttendanceQueryDto,
  AttendanceRuleDto,
  CorrectionDto,
  DeviceConfigDto,
  MappingDto,
  MiddlewareIngestDto,
  PushUsersDto,
  SyncDeviceDto,
} from './dto/staff-attendance.dto';

type StaffPushPreviewRow = NonNullable<PushResult['preview']>[number];

@Injectable()
export class StaffAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly middlewareConnector: MiddlewareBiometricConnector,
    private readonly directTcpConnector: DirectTcpBiometricConnector,
    private readonly directZkConnector: DirectZkBiometricConnector,
    private readonly eTimeTrackLiteWebConnector: ETimeTrackLiteWebConnector,
    private readonly engine: StaffAttendanceEngineService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private connector(device: Record<string, unknown>): BiometricConnector {
    if (String(device.connectionType ?? '') === 'ETIMETRACKLITE_WEB') {
      return this.eTimeTrackLiteWebConnector;
    }
    if (
      ['TCP_IP', 'DIRECT_TCP'].includes(String(device.connectionType ?? ''))
    ) {
      return this.directZkConnector;
    }
    return device.connectionType === 'DIRECT_TCP_STUB'
      ? this.directTcpConnector
      : this.middlewareConnector;
  }

  async dashboard(tenantId: string) {
    const today = this.dateOnly(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [devices, records, rawPending, mappings] = await Promise.all([
      this.db().staffBiometricDevice.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      this.db().staffAttendanceDailyRecord.findMany({
        where: { tenantId, attendanceDate: today },
        take: 5000,
      }),
      this.db().staffAttendanceRawPunch.count({
        where: { tenantId, processingStatus: 'PENDING' },
      }),
      this.db().staffBiometricMapping.count({
        where: { tenantId, active: true },
      }),
    ]);

    return {
      presentToday: records.filter((r: any) =>
        ['PRESENT', 'LATE', 'EARLY_EXIT', 'OVERTIME'].includes(
          String(r.status),
        ),
      ).length,
      absent: records.filter((r: any) => r.status === 'ABSENT').length,
      late: records.filter(
        (r: any) => (r.lateMinutes ?? 0) > 0 || this.hasFlag(r, 'LATE'),
      ).length,
      halfDay: records.filter((r: any) => r.status === 'HALF_DAY').length,
      earlyOut: records.filter(
        (r: any) => (r.earlyMinutes ?? 0) > 0 || this.hasFlag(r, 'EARLY_OUT'),
      ).length,
      overtime: records.filter(
        (r: any) => (r.overtimeMinutes ?? 0) > 0 || this.hasFlag(r, 'OVERTIME'),
      ).length,
      missingPunch: records.filter(
        (r: any) =>
          this.hasFlag(r, 'MISSING_OUT') ||
          this.hasFlag(r, 'NO_PUNCH') ||
          r.status === 'INCOMPLETE_PUNCH',
      ).length,
      leaveToday: records.filter((r: any) => r.status === 'ON_LEAVE').length,
      wfhToday: records.filter((r: any) => r.status === 'WFH').length,
      holidayToday: records.filter((r: any) => r.status === 'HOLIDAY').length,
      weeklyOff: records.filter((r: any) => r.status === 'WEEKLY_OFF').length,
      deviceOnline: devices.filter(
        (d: any) =>
          ['CONNECTED', 'ONLINE'].includes(String(d.status)) ||
          d.networkStatus === 'ONLINE',
      ).length,
      liveActiveStaff: mappings,
      pendingRawLogs: rawPending,
      devices,
      generatedFor: { from: today, to: tomorrow },
    };
  }

  private dateOnly(value: Date) {
    return new Date(value.toISOString().slice(0, 10));
  }

  async listDevices(tenantId: string) {
    return this.db().staffBiometricDevice.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { mappings: true, rawPunches: true } } },
    });
  }

  async createDevice(user: JwtUser, dto: DeviceConfigDto) {
    const device = await this.db().staffBiometricDevice.create({
      data: {
        tenantId: user.tid,
        name: dto.name,
        model: dto.model ?? 'eSSL X2008',
        serialNumber: dto.serialNumber,
        deviceCode: dto.deviceCode ?? (await this.nextDeviceCode(user.tid)),
        location: dto.location,
        campusId: dto.campusId,
        building: dto.building,
        floor: dto.floor,
        description: dto.description,
        departmentScope: dto.departmentScope,
        connectionType: dto.connectionType ?? 'MIDDLEWARE',
        ipAddress: dto.ipAddress,
        port: dto.port ?? 4370,
        protocol: dto.protocol ?? 'TCP/IP',
        timeoutSec: dto.timeoutSec ?? 30,
        retryCount: dto.retryCount ?? 3,
        sslEnabled: dto.sslEnabled ?? false,
        devicePassword: dto.devicePassword,
        deviceKey: dto.deviceKey,
        machineNumber: dto.machineNumber,
        communicationKey: dto.communicationKey,
        firmwareVersion: dto.firmwareVersion,
        timezone: dto.timezone ?? 'Asia/Kolkata',
        heartbeatIntervalSec: dto.heartbeatIntervalSec ?? 60,
        autoSyncEnabled: dto.autoSyncEnabled ?? true,
        syncFrequencyMin: dto.syncFrequencyMin ?? 15,
        syncDirection: dto.syncDirection ?? 'DEVICE_TO_ERP',
        punchMode: dto.punchMode ?? 'IN_OUT',
        duplicatePunchThresholdMin: dto.duplicatePunchThresholdMin ?? 5,
        timeDriftToleranceSec: dto.timeDriftToleranceSec ?? 60,
        processingStrategy: dto.processingStrategy ?? 'FIRST_IN_LAST_OUT',
        registrationStatus: this.registrationStatus(dto),
        networkStatus: 'UNKNOWN',
        authenticationStatus: 'NOT_TESTED',
        syncHealthStatus: 'NEVER_SYNCED',
        settings: dto.settings,
      },
    });
    await this.audit(
      user,
      'DEVICE_CREATE',
      'DEVICE',
      device.id,
      { dto },
      'SUCCESS',
      device.id,
    );
    return device;
  }

  async updateDevice(user: JwtUser, id: string, dto: DeviceConfigDto) {
    await this.ensureDevice(user.tid, id);
    const device = await this.db().staffBiometricDevice.update({
      where: { id },
      data: {
        name: dto.name,
        model: dto.model ?? 'eSSL X2008',
        serialNumber: dto.serialNumber,
        deviceCode: dto.deviceCode,
        location: dto.location,
        campusId: dto.campusId,
        building: dto.building,
        floor: dto.floor,
        description: dto.description,
        departmentScope: dto.departmentScope,
        connectionType: dto.connectionType ?? 'MIDDLEWARE',
        ipAddress: dto.ipAddress,
        port: dto.port ?? 4370,
        protocol: dto.protocol ?? 'TCP/IP',
        timeoutSec: dto.timeoutSec ?? 30,
        retryCount: dto.retryCount ?? 3,
        sslEnabled: dto.sslEnabled ?? false,
        devicePassword: dto.devicePassword,
        deviceKey: dto.deviceKey,
        machineNumber: dto.machineNumber,
        communicationKey: dto.communicationKey,
        firmwareVersion: dto.firmwareVersion,
        timezone: dto.timezone ?? 'Asia/Kolkata',
        heartbeatIntervalSec: dto.heartbeatIntervalSec ?? 60,
        autoSyncEnabled: dto.autoSyncEnabled ?? true,
        syncFrequencyMin: dto.syncFrequencyMin ?? 15,
        syncDirection: dto.syncDirection ?? 'DEVICE_TO_ERP',
        punchMode: dto.punchMode ?? 'IN_OUT',
        duplicatePunchThresholdMin: dto.duplicatePunchThresholdMin ?? 5,
        timeDriftToleranceSec: dto.timeDriftToleranceSec ?? 60,
        processingStrategy: dto.processingStrategy ?? 'FIRST_IN_LAST_OUT',
        registrationStatus: this.registrationStatus(dto),
        settings: dto.settings,
      },
    });
    await this.audit(
      user,
      'DEVICE_UPDATE',
      'DEVICE',
      id,
      { dto },
      'SUCCESS',
      id,
    );
    return device;
  }

  async deleteDevice(user: JwtUser, id: string) {
    const device = await this.ensureDevice(user.tid, id);
    if (
      ['CONNECTED', 'SYNCING', 'PULLING', 'PUSHING'].includes(
        String(device.status),
      )
    ) {
      throw new BadRequestException(
        'Stop or disconnect the biometric device before deleting it.',
      );
    }
    const runningBatch = await this.db().staffAttendanceSyncBatch.findFirst({
      where: {
        tenantId: user.tid,
        deviceId: id,
        status: { in: ['QUEUED', 'RUNNING', 'SYNCING', 'PULLING', 'PUSHING'] },
      },
    });
    if (runningBatch) {
      throw new BadRequestException(
        'Device has active sync jobs. Stop or wait for sync completion before deleting it.',
      );
    }

    const deleted = await this.db().staffBiometricDevice.update({
      where: { id },
      data: {
        status: 'DELETED',
        registrationStatus: 'DISABLED',
        networkStatus: 'UNKNOWN',
        authenticationStatus: 'NOT_TESTED',
        syncHealthStatus: 'FAILED',
        deletedAt: new Date(),
        failureReason: `Soft deleted by ${user.sub}`,
      },
    });
    await this.db().staffBiometricMapping.updateMany({
      where: { tenantId: user.tid, deviceId: id, active: true },
      data: {
        active: false,
        disabledAt: new Date(),
        syncStatus: 'DEVICE_DELETED',
        enrollmentStatus: 'DEVICE_REMOVED',
        conflictReason: 'Device was soft deleted. Mapping archived.',
      },
    });
    await this.audit(
      user,
      'DEVICE_DELETE_SOFT',
      'DEVICE',
      id,
      {
        deviceName: device.name,
        ipAddress: device.ipAddress,
        removedMappings: true,
        deletedBy: user.sub,
      },
      'SUCCESS',
      id,
    );
    return deleted;
  }

  async testDevice(user: JwtUser, id: string) {
    const device = await this.ensureDevice(user.tid, id);
    const health = await this.connector(device).testConnection(device);
    const updated = await this.db().staffBiometricDevice.update({
      where: { id },
      data: {
        status: this.deriveLegacyStatus(health),
        registrationStatus: health.registrationStatus ?? 'CONFIGURED',
        networkStatus: health.networkStatus ?? 'UNKNOWN',
        authenticationStatus: health.authenticationStatus ?? 'NOT_TESTED',
        syncHealthStatus: health.syncHealthStatus ?? 'NEVER_SYNCED',
        signalHealth: health.signalHealth,
        diagnostics: health.diagnostics,
        lastSeenAt: health.lastSeenAt ?? new Date(),
        lastHeartbeatAt: new Date(),
        lastOnlineAt: health.lastOnlineAt,
        lastOfflineAt: health.lastOfflineAt,
        failureReason: health.failureReason,
        lastDiagnosticAt: new Date(),
        lastDiagnosticPayload: this.toAuditJson(health),
        firmwareVersion: health.deviceInfo?.firmwareVersion ?? undefined,
        userCount: health.deviceInfo?.userCount ?? undefined,
      },
    });
    await this.audit(
      user,
      'DEVICE_TEST_CONNECTION',
      'DEVICE',
      id,
      health,
      health.status,
      id,
    );
    return { device: updated, health };
  }

  async syncDevice(user: JwtUser, id: string, dto: SyncDeviceDto) {
    await this.ensureDevice(user.tid, id);
    const batch = await this.db().staffAttendanceSyncBatch.create({
      data: {
        tenantId: user.tid,
        deviceId: id,
        mode: dto.mode ?? 'INCREMENTAL',
        fromTimestamp: dto.from ? new Date(dto.from) : undefined,
        toTimestamp: dto.to ? new Date(dto.to) : undefined,
        requestedById: user.sub,
      },
    });
    await this.queue.enqueueStaffBiometricSyncDevice({
      tenantId: user.tid,
      deviceId: id,
      batchId: batch.id,
      userId: user.sub,
      mode: dto.mode ?? 'INCREMENTAL',
      from: dto.from,
      to: dto.to,
    });
    await this.audit(
      user,
      'DEVICE_SYNC_QUEUED',
      'SYNC_BATCH',
      batch.id,
      dto,
      'QUEUED',
      id,
    );
    return batch;
  }

  async ingestMiddleware(user: JwtUser, dto: MiddlewareIngestDto) {
    const batch = await this.db().staffAttendanceSyncBatch.create({
      data: {
        tenantId: user.tid,
        deviceId: dto.deviceId,
        mode: 'PUSH_CONNECTOR',
        status: 'RUNNING',
        startedAt: new Date(),
        requestedById: user.sub,
        totalLogs: dto.punches.length,
      },
    });
    const result = await this.storeRawPunches(
      user.tid,
      dto.deviceId,
      batch.id,
      dto.punches.map((p) => ({
        deviceUserId: p.deviceUserId,
        biometricId: p.biometricId,
        punchTimestamp: new Date(p.punchTimestamp),
        verificationMode: p.verificationMode,
        punchDirection: p.punchDirection,
        rawPayload: (p.rawPayload as Record<string, unknown>) ?? p,
      })),
    );
    await this.db().staffAttendanceSyncBatch.update({
      where: { id: batch.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        insertedLogs: result.inserted,
        duplicateLogs: result.duplicates,
        failedLogs: result.failed,
      },
    });
    await this.engine.processBatch(user.tid, batch.id);
    await this.engine.processBatch(user.tid);
    return { batchId: batch.id, ...result };
  }

  async storeRawPunches(
    tenantId: string,
    deviceId: string | undefined,
    batchId: string | undefined,
    punches: RawPunchInput[],
  ) {
    let inserted = 0;
    let duplicates = 0;
    let failed = 0;
    for (const punch of punches) {
      try {
        const mapping = await this.resolveMapping(tenantId, deviceId, punch);
        await this.db().staffAttendanceRawPunch.create({
          data: {
            tenantId,
            deviceId,
            syncBatchId: batchId,
            staffProfileId: mapping?.staffProfileId,
            deviceUserId: punch.deviceUserId,
            biometricId: punch.biometricId,
            punchTimestamp: punch.punchTimestamp,
            verificationMode: punch.verificationMode,
            punchDirection: punch.punchDirection,
            rawPayload: punch.rawPayload,
            sourceHash: this.punchHash(tenantId, deviceId, punch),
          },
        });
        inserted += 1;
      } catch (error: any) {
        if (String(error?.code) === 'P2002') duplicates += 1;
        else failed += 1;
      }
    }
    return { inserted, duplicates, failed, total: punches.length };
  }

  async syncDeviceInternal(
    tenantId: string,
    deviceId: string,
    batchId: string,
  ) {
    const device = await this.ensureDevice(tenantId, deviceId);
    await this.db().staffAttendanceSyncBatch.update({
      where: { id: batchId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    const punches = await this.connector(device).pullPunchLogs(device);
    const result = await this.storeRawPunches(
      tenantId,
      deviceId,
      batchId,
      punches,
    );
    await this.db().staffAttendanceSyncBatch.update({
      where: { id: batchId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        totalLogs: result.total,
        insertedLogs: result.inserted,
        duplicateLogs: result.duplicates,
        failedLogs: result.failed,
      },
    });
    await this.db().staffBiometricDevice.update({
      where: { id: deviceId },
      data: {
        lastSyncAt: new Date(),
        lastSuccessfulSyncAt: result.failed ? undefined : new Date(),
        lastFailedSyncAt: result.failed ? new Date() : undefined,
        syncHealthStatus: result.failed ? 'WARNING' : 'HEALTHY',
        failureReason: result.failed
          ? `${result.failed} punch logs failed during sync`
          : undefined,
        status: result.failed ? 'SYNC_WARNING' : 'CONNECTED',
      },
    });
    await this.engine.processBatch(tenantId, batchId);
    await this.engine.processBatch(tenantId);
    return result;
  }

  async listMappings(tenantId: string) {
    const rows = await this.db().staffBiometricMapping.findMany({
      where: { tenantId, active: true },
      orderBy: { createdAt: 'desc' },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            biometricId: true,
            biometricExternalUserId: true,
            rfidNo: true,
            department: { select: { name: true } },
          },
        },
        device: { select: { id: true, name: true, status: true } },
      },
    });
    return this.dedupeActiveMappings(rows);
  }

  async upsertMapping(user: JwtUser, dto: MappingDto) {
    const staff = await this.db().staffProfile.findFirst({
      where: { id: dto.staffProfileId, tenantId: user.tid, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');
    const duplicate = await this.db().staffBiometricMapping.findFirst({
      where: {
        tenantId: user.tid,
        active: true,
        OR: [
          { biometricId: dto.biometricId },
          { deviceUserId: dto.deviceUserId },
        ],
        NOT: { staffProfileId: dto.staffProfileId },
      },
    });
    if (duplicate)
      throw new BadRequestException('Duplicate biometric ID or device user ID');

    const mapping = await this.db().staffBiometricMapping.upsert({
      where: {
        tenantId_biometricId_active: {
          tenantId: user.tid,
          biometricId: dto.biometricId,
          active: true,
        },
      },
      update: {
        staffProfileId: dto.staffProfileId,
        deviceId: dto.deviceId,
        deviceUserId: dto.deviceUserId,
        syncStatus: 'PENDING_UPLOAD',
        enrollmentStatus: 'NOT_ENROLLED',
      },
      create: {
        tenantId: user.tid,
        staffProfileId: dto.staffProfileId,
        deviceId: dto.deviceId,
        biometricId: dto.biometricId,
        deviceUserId: dto.deviceUserId,
        syncStatus: 'PENDING_UPLOAD',
        enrollmentStatus: 'NOT_ENROLLED',
      },
    });
    await this.db().staffProfile.update({
      where: { id: dto.staffProfileId },
      data: {
        biometricId: dto.biometricId,
        biometricDeviceId: dto.deviceId,
        biometricExternalUserId: dto.deviceUserId,
        biometricSyncStatus: 'PENDING_UPLOAD',
      },
    });
    await this.audit(
      user,
      'MAPPING_UPSERT',
      'MAPPING',
      mapping.id,
      dto,
      'SUCCESS',
      dto.deviceId,
      dto.staffProfileId,
    );
    return mapping;
  }

  async autoMap(user: JwtUser, dto?: { deviceId?: string }) {
    const staffRows = await this.db().staffProfile.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        OR: [
          { biometricId: { not: null } },
          { rfidNo: { not: null } },
          { employeeCode: { not: null } },
        ],
      },
      take: 10000,
    });
    const devices = dto?.deviceId
      ? [await this.ensureDevice(user.tid, dto.deviceId)]
      : await this.db().staffBiometricDevice.findMany({
          where: { tenantId: user.tid, deletedAt: null },
          take: 50,
        });
    const staffByBiometricId = new Map<string, any>(
      staffRows
        .filter((staff: any) => staff.biometricId)
        .map((staff: any) => [this.matchKey(staff.biometricId), staff]),
    );
    const staffByRfid = new Map<string, any>(
      staffRows
        .filter((staff: any) => staff.rfidNo)
        .map((staff: any) => [this.matchKey(staff.rfidNo), staff]),
    );
    const staffByCode = new Map<string, any>(
      staffRows
        .filter((staff: any) => staff.employeeCode)
        .map((staff: any) => [this.matchKey(staff.employeeCode), staff]),
    );
    const staffByName = new Map<string, any>(
      staffRows
        .filter((staff: any) => staff.fullName)
        .map((staff: any) => [this.nameKey(staff.fullName), staff]),
    );
    let created = 0;
    let updated = 0;
    let conflicts = 0;
    let scannedDeviceUsers = 0;
    const diagnostics: Array<Record<string, unknown>> = [];
    for (const device of devices.filter(Boolean)) {
      let deviceUsers: DeviceUser[] = [];
      try {
        deviceUsers = await this.connector(device).pullUsers(device);
      } catch (error) {
        diagnostics.push({
          deviceId: device.id,
          deviceName: device.name,
          status: 'PULL_FAILED',
          reason: error instanceof Error ? error.message : String(error),
        });
        deviceUsers = [];
      }
      scannedDeviceUsers += deviceUsers.length;
      for (const deviceUser of deviceUsers) {
        const match = this.matchDeviceUserToStaff(
          deviceUser,
          staffByBiometricId,
          staffByRfid,
          staffByCode,
          staffByName,
        );
        if (!match.staff?.biometricId) {
          diagnostics.push({
            deviceId: device.id,
            deviceUserId: deviceUser.deviceUserId,
            deviceName: deviceUser.name,
            status: 'NOT_ENROLLED',
            reason: match.reason,
          });
          continue;
        }
        const staff = match.staff;
        const existingConflict =
          await this.db().staffBiometricMapping.findFirst({
            where: {
              tenantId: user.tid,
              active: true,
              OR: [
                { biometricId: staff.biometricId },
                { deviceUserId: String(deviceUser.deviceUserId) },
              ],
              NOT: { staffProfileId: staff.id },
            },
          });
        if (existingConflict) {
          conflicts += 1;
          diagnostics.push({
            deviceId: device.id,
            staffProfileId: staff.id,
            deviceUserId: deviceUser.deviceUserId,
            status: 'MAPPING_CONFLICT',
            reason: `Device UserID ${deviceUser.deviceUserId} or Biometric ID ${staff.biometricId} is already mapped to another staff profile`,
          });
          continue;
        }
        const exists = await this.db().staffBiometricMapping.findFirst({
          where: {
            tenantId: user.tid,
            active: true,
            OR: [
              { staffProfileId: staff.id },
              { biometricId: staff.biometricId },
              { deviceUserId: staff.biometricId },
            ],
          },
        });
        if (exists) {
          await this.db().staffBiometricMapping.update({
            where: { id: exists.id },
            data: {
              staffProfileId: staff.id,
              biometricId: staff.biometricId,
              deviceUserId: String(deviceUser.deviceUserId),
              deviceId: device.id,
              syncStatus: 'SYNCED',
              enrollmentStatus: 'ENROLLED',
              conflictReason: null,
            },
          });
          updated += 1;
        } else {
          await this.db().staffBiometricMapping.create({
            data: {
              tenantId: user.tid,
              staffProfileId: staff.id,
              biometricId: staff.biometricId,
              deviceUserId: String(deviceUser.deviceUserId),
              deviceId: device.id,
              syncStatus: 'SYNCED',
              enrollmentStatus: 'ENROLLED',
            },
          });
          created += 1;
        }
        await this.db().staffProfile.update({
          where: { id: staff.id },
          data: {
            biometricDeviceId: device.id,
            biometricExternalUserId: String(deviceUser.deviceUserId),
            biometricSyncStatus: 'SYNCED',
            biometricLastSyncAt: new Date(),
          },
        });
      }
    }
    if (!scannedDeviceUsers) {
      const fallbackDevice = devices.filter(Boolean)[0];
      for (const staff of staffRows.filter((row: any) => row.biometricId)) {
        const exists = await this.db().staffBiometricMapping.findFirst({
          where: { tenantId: user.tid, staffProfileId: staff.id, active: true },
        });
        if (exists) {
          await this.db().staffBiometricMapping.update({
            where: { id: exists.id },
            data: {
              biometricId: staff.biometricId,
              deviceUserId: staff.biometricId,
              deviceId:
                exists.deviceId ??
                staff.biometricDeviceId ??
                fallbackDevice?.id,
              syncStatus: 'READY_TO_PUSH',
              enrollmentStatus: 'NOT_ENROLLED',
              conflictReason:
                'No device users were returned. Ready to push ERP biometric ID to device.',
            },
          });
          updated += 1;
          continue;
        }
        await this.db().staffBiometricMapping.create({
          data: {
            tenantId: user.tid,
            staffProfileId: staff.id,
            biometricId: staff.biometricId,
            deviceUserId: staff.biometricId,
            deviceId: staff.biometricDeviceId ?? fallbackDevice?.id,
            syncStatus: 'READY_TO_PUSH',
            enrollmentStatus: 'NOT_ENROLLED',
            conflictReason:
              'No device users were returned. Ready to push ERP biometric ID to device.',
          },
        });
        created += 1;
      }
    }
    await this.audit(
      user,
      'MAPPING_AUTO_MAP',
      'MAPPING',
      undefined,
      { created, updated, conflicts, scannedDeviceUsers, diagnostics },
      'SUCCESS',
    );
    return {
      created,
      updated,
      conflicts,
      scannedStaff: staffRows.length,
      scannedDeviceUsers,
      diagnostics,
    };
  }

  async pushUsers(user: JwtUser, deviceId: string, dto: PushUsersDto) {
    const device = await this.ensureDevice(user.tid, deviceId);
    const where: Record<string, unknown> = {
      tenantId: user.tid,
      deletedAt: null,
      status: 'ACTIVE',
    };
    if (dto.staffProfileIds?.length) where.id = { in: dto.staffProfileIds };
    if (dto.departmentId) where.departmentId = dto.departmentId;

    const staffRows = await this.db().staffProfile.findMany({
      where,
      include: { department: { select: { name: true } } },
      take: 10000,
    });
    const preview = this.buildStaffPushPreview(
      staffRows,
      await this.deviceIdentityStrategy(user.tid),
    );
    const invalidRows = preview.filter((row) => row.missing.length);
    if (invalidRows.length) {
      const result: PushResult = {
        total: preview.length,
        successful: 0,
        duplicate: 0,
        invalid: invalidRows.length,
        failed: invalidRows.length,
        errors: invalidRows.map((row) => this.pushValidationMessage(row)),
        validationErrors: invalidRows.map((row) => ({
          staffProfileId: row.staffProfileId,
          employeeCode: row.employeeCode,
          fullName: row.fullName,
          deviceUserId: row.deviceUserId,
          missing: row.missing,
          message: this.pushValidationMessage(row),
        })),
        preview,
      };
      await this.audit(
        user,
        'DEVICE_PUSH_USERS_VALIDATION_FAILED',
        'DEVICE',
        deviceId,
        result,
        'FAILED',
        deviceId,
      );
      return result;
    }
    const users: DeviceUser[] = preview.map((row) => ({
      deviceUserId: row.deviceUserId ?? '',
      biometricId: row.biometricId,
      name: row.name,
      employeeCode: row.employeeCode,
      department: staffRows.find(
        (staff: any) => staff.id === row.staffProfileId,
      )?.department?.name,
      cardNumber: row.cardNumber,
      privilege: row.privilege,
      enabled: row.enabled,
      status: 'ACTIVE',
    }));

    const result = await this.connector(device).pushUsers(device, users);
    let readBackUsers: DeviceUser[] = [];
    try {
      readBackUsers = await this.connector(device).pullUsers(device);
    } catch (error) {
      result.errors.push(
        `Read-back verification failed after push: ${error instanceof Error ? error.message : String(error)}`,
      );
      result.failed = Math.max(result.failed, users.length - result.successful);
    }
    const readBackIds = new Set(
      readBackUsers.map((deviceUser) => this.matchKey(deviceUser.deviceUserId)),
    );
    const unverified = users.filter(
      (deviceUser) => !readBackIds.has(this.matchKey(deviceUser.deviceUserId)),
    );
    if (readBackUsers.length && unverified.length) {
      result.failed += unverified.length;
      result.successful = Math.max(0, result.successful - unverified.length);
      result.errors.push(
        ...unverified.map(
          (deviceUser) =>
            `Push failed. Staff: ${deviceUser.name ?? deviceUser.employeeCode ?? 'Unknown'}. Device User ID: ${deviceUser.deviceUserId}. Cause: User not found during read-back verification.`,
        ),
      );
    }
    result.preview = preview.map((row) => ({
      ...row,
      status: result.failed ? 'PUSH_FAILED' : 'PUSH_SUCCESS',
    }));
    if (staffRows.length) {
      for (const staff of staffRows) {
        const row = preview.find((item) => item.staffProfileId === staff.id);
        if (!row?.deviceUserId || !staff.biometricId) continue;
        await this.db().staffBiometricMapping.upsert({
          where: {
            tenantId_biometricId_active: {
              tenantId: user.tid,
              biometricId: staff.biometricId,
              active: true,
            },
          },
          update: {
            deviceId,
            deviceUserId: row.deviceUserId,
            syncStatus: result.failed ? 'PUSH_FAILED' : 'PUSH_SUCCESS',
            enrollmentStatus: result.failed ? 'UPLOAD_FAILED' : 'UPLOADED',
            conflictReason: result.failed ? result.errors.join('; ') : null,
          },
          create: {
            tenantId: user.tid,
            staffProfileId: staff.id,
            deviceId,
            biometricId: staff.biometricId,
            deviceUserId: row.deviceUserId,
            syncStatus: result.failed ? 'PUSH_FAILED' : 'PUSH_SUCCESS',
            enrollmentStatus: result.failed ? 'UPLOAD_FAILED' : 'UPLOADED',
            conflictReason: result.failed ? result.errors.join('; ') : null,
          },
        });
      }
      await this.db().staffProfile.updateMany({
        where: {
          tenantId: user.tid,
          id: { in: staffRows.map((s: any) => s.id) },
        },
        data: {
          biometricSyncStatus: result.failed ? 'PUSH_FAILED' : 'PUSH_SUCCESS',
          biometricLastSyncAt: new Date(),
        },
      });
    }
    await this.db().staffBiometricDevice.update({
      where: { id: deviceId },
      data: {
        userCount: result.successful,
        status: result.failed ? 'SYNC_WARNING' : 'CONNECTED',
        syncHealthStatus: result.failed ? 'WARNING' : 'HEALTHY',
        lastSuccessfulSyncAt: result.failed ? undefined : new Date(),
        lastFailedSyncAt: result.failed ? new Date() : undefined,
        failureReason: result.errors.join('; ') || undefined,
        lastSyncAt: new Date(),
      },
    });
    await this.audit(
      user,
      'DEVICE_PUSH_USERS',
      'DEVICE',
      deviceId,
      result,
      result.failed ? 'PARTIAL' : 'SUCCESS',
      deviceId,
    );
    return result;
  }

  async previewPushUsers(user: JwtUser, deviceId: string, dto: PushUsersDto) {
    await this.ensureDevice(user.tid, deviceId);
    const where: Record<string, unknown> = {
      tenantId: user.tid,
      deletedAt: null,
      status: 'ACTIVE',
    };
    if (dto.staffProfileIds?.length) where.id = { in: dto.staffProfileIds };
    if (dto.departmentId) where.departmentId = dto.departmentId;
    const staffRows = await this.db().staffProfile.findMany({
      where,
      include: { department: { select: { name: true } } },
      take: 10000,
    });
    const preview = this.buildStaffPushPreview(
      staffRows,
      await this.deviceIdentityStrategy(user.tid),
    );
    return {
      total: preview.length,
      ready: preview.filter((row) => !row.missing.length).length,
      invalid: preview.filter((row) => row.missing.length).length,
      preview,
      validationErrors: preview
        .filter((row) => row.missing.length)
        .map((row) => ({
          staffProfileId: row.staffProfileId,
          employeeCode: row.employeeCode,
          fullName: row.fullName,
          deviceUserId: row.deviceUserId,
          missing: row.missing,
          message: this.pushValidationMessage(row),
        })),
    };
  }

  async pullDeviceUsers(user: JwtUser, deviceId: string) {
    const device = await this.ensureDevice(user.tid, deviceId);
    const deviceUsers = await this.connector(device).pullUsers(device);
    const staffRows = await this.db().staffProfile.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        OR: [
          {
            biometricId: {
              in: deviceUsers.map((item) => item.deviceUserId).filter(Boolean),
            },
          },
          {
            rfidNo: {
              in: deviceUsers.map((item) => item.cardNumber).filter(Boolean),
            },
          },
          {
            employeeCode: {
              in: deviceUsers.map((item) => item.deviceUserId).filter(Boolean),
            },
          },
        ],
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        biometricId: true,
        rfidNo: true,
      },
    });
    const allNamedStaffRows = await this.db().staffProfile.findMany({
      where: { tenantId: user.tid, deletedAt: null },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        biometricId: true,
        rfidNo: true,
      },
      take: 10000,
    });
    const staffByBiometric = new Map<string, any>(
      staffRows
        .filter((staff: any) => staff.biometricId)
        .map((staff: any) => [this.matchKey(staff.biometricId), staff]),
    );
    const staffByRfid = new Map<string, any>(
      staffRows
        .filter((staff: any) => staff.rfidNo)
        .map((staff: any) => [this.matchKey(staff.rfidNo), staff]),
    );
    const staffByCode = new Map<string, any>(
      staffRows
        .filter((staff: any) => staff.employeeCode)
        .map((staff: any) => [this.matchKey(staff.employeeCode), staff]),
    );
    const staffByName = new Map<string, any>(
      allNamedStaffRows
        .filter((staff: any) => staff.fullName)
        .map((staff: any) => [this.nameKey(staff.fullName), staff]),
    );
    const rows = [];
    let matched = 0;
    for (const deviceUser of deviceUsers) {
      const match = this.matchDeviceUserToStaff(
        deviceUser,
        staffByBiometric,
        staffByRfid,
        staffByCode,
        staffByName,
      );
      const staff = match.staff;
      if (staff?.biometricId) {
        matched += 1;
        await this.db().staffBiometricMapping.upsert({
          where: {
            tenantId_biometricId_active: {
              tenantId: user.tid,
              biometricId: staff.biometricId,
              active: true,
            },
          },
          update: {
            staffProfileId: staff.id,
            deviceId,
            deviceUserId: String(deviceUser.deviceUserId),
            syncStatus: 'SYNCED',
            enrollmentStatus: 'PULLED_FROM_DEVICE',
            conflictReason: null,
          },
          create: {
            tenantId: user.tid,
            staffProfileId: staff.id,
            deviceId,
            biometricId: staff.biometricId,
            deviceUserId: String(deviceUser.deviceUserId),
            syncStatus: 'SYNCED',
            enrollmentStatus: 'PULLED_FROM_DEVICE',
          },
        });
        await this.db().staffProfile.update({
          where: { id: staff.id },
          data: {
            biometricDeviceId: deviceId,
            biometricExternalUserId: String(deviceUser.deviceUserId),
            biometricSyncStatus: 'SYNCED',
            biometricLastSyncAt: new Date(),
          },
        });
      }
      rows.push({
        ...deviceUser,
        mappingStatus: staff ? 'MATCHED' : 'UNMAPPED',
        diagnosticReason: staff ? `Matched by ${match.source}` : match.reason,
        deviceName: device.name,
        matchedStaff: staff
          ? {
              id: staff.id,
              employeeCode: staff.employeeCode,
              fullName: staff.fullName,
              biometricId: staff.biometricId,
              rfidNo: staff.rfidNo,
            }
          : null,
      });
    }
    await this.db().staffBiometricDevice.update({
      where: { id: deviceId },
      data: {
        userCount: deviceUsers.length,
        lastSyncAt: new Date(),
        lastSuccessfulSyncAt: new Date(),
        syncHealthStatus: 'HEALTHY',
        failureReason: deviceUsers.length
          ? undefined
          : 'Device returned zero users during pull',
      },
    });
    await this.audit(
      user,
      'DEVICE_PULL_USERS',
      'DEVICE',
      deviceId,
      { total: deviceUsers.length, matched, rows },
      deviceUsers.length ? 'SUCCESS' : 'EMPTY',
      deviceId,
    );
    return rows;
  }

  async dailyRegister(tenantId: string, query: AttendanceQueryDto) {
    const date = this.startOfDay(
      query.date ? new Date(query.date) : new Date(),
    );
    const from = query.from ? this.startOfDay(new Date(query.from)) : date;
    const to = query.to
      ? this.endOfDay(new Date(query.to))
      : this.endOfDay(date);
    return this.db().staffAttendanceDailyRecord.findMany({
      where: {
        tenantId,
        attendanceDate: { gte: from, lte: to },
        status: query.status || undefined,
        staffProfileId: query.staffProfileId,
        shiftId: query.shiftId,
        staff: query.departmentId
          ? { departmentId: query.departmentId }
          : undefined,
      },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
            primaryShift: { select: { name: true } },
          },
        },
      },
      orderBy: [{ attendanceDate: 'asc' }, { staffProfileId: 'asc' }],
      take: 5000,
    });
  }

  async monthlySummary(tenantId: string, query: AttendanceQueryDto) {
    const { from, to } = this.monthBounds(
      query.month ?? query.date ?? query.from,
    );
    const rows = await this.dailyRegister(tenantId, {
      ...query,
      from: this.dateOnlyString(from),
      to: this.dateOnlyString(to),
    });
    const days = this.eachDate(from, to).map((date) =>
      this.dateOnlyString(date),
    );
    const staffMap = new Map<string, any>();
    for (const row of rows) {
      const staffId = row.staffProfileId;
      const item = staffMap.get(staffId) ?? {
        staffProfileId: staffId,
        staff: row.staff,
        present: 0,
        absent: 0,
        leave: 0,
        late: 0,
        earlyExit: 0,
        halfDay: 0,
        weeklyOff: 0,
        holiday: 0,
        overtimeMinutes: 0,
        workedMinutes: 0,
        days: {},
      };
      const key = this.dateOnlyString(row.attendanceDate);
      item.days[key] = {
        status: row.status,
        in: row.firstInAt,
        out: row.lastOutAt,
        workedMinutes: row.workedMinutes,
        lateMinutes: row.lateMinutes,
        overtimeMinutes: row.overtimeMinutes,
      };
      if (['PRESENT', 'LATE', 'EARLY_EXIT', 'OVERTIME'].includes(row.status))
        item.present += 1;
      if (row.status === 'ABSENT') item.absent += 1;
      if (row.status === 'ON_LEAVE') item.leave += 1;
      if (row.status === 'HALF_DAY') item.halfDay += 1;
      if (row.status === 'WEEKLY_OFF') item.weeklyOff += 1;
      if (row.status === 'HOLIDAY') item.holiday += 1;
      if ((row.lateMinutes ?? 0) > 0 || this.hasFlag(row, 'LATE'))
        item.late += 1;
      if ((row.earlyMinutes ?? 0) > 0 || this.hasFlag(row, 'EARLY_OUT'))
        item.earlyExit += 1;
      item.overtimeMinutes += row.overtimeMinutes ?? 0;
      item.workedMinutes += row.workedMinutes ?? 0;
      staffMap.set(staffId, item);
    }
    const staff = Array.from(staffMap.values());
    return {
      from,
      to,
      days,
      staff,
      totals: {
        staff: staff.length,
        present: staff.reduce((sum, row) => sum + row.present, 0),
        absent: staff.reduce((sum, row) => sum + row.absent, 0),
        leave: staff.reduce((sum, row) => sum + row.leave, 0),
        late: staff.reduce((sum, row) => sum + row.late, 0),
        overtimeMinutes: staff.reduce(
          (sum, row) => sum + row.overtimeMinutes,
          0,
        ),
        workedMinutes: staff.reduce((sum, row) => sum + row.workedMinutes, 0),
      },
    };
  }

  async liveAttendance(tenantId: string, query: AttendanceQueryDto) {
    const where: Record<string, unknown> = { tenantId };
    if (query.deviceId) where.deviceId = query.deviceId;
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    return this.db().staffAttendanceRawPunch.findMany({
      where,
      orderBy: { punchTimestamp: 'desc' },
      take: 100,
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            photoUrl: true,
            department: { select: { name: true } },
            primaryShift: { select: { name: true } },
          },
        },
        device: { select: { id: true, name: true, status: true } },
      },
    });
  }

  async rawLogs(tenantId: string, query: AttendanceQueryDto) {
    return this.db().staffAttendanceRawPunch.findMany({
      where: {
        tenantId,
        deviceId: query.deviceId,
        staffProfileId: query.staffProfileId,
      },
      orderBy: { punchTimestamp: 'desc' },
      take: 1000,
    });
  }

  async syncBatches(tenantId: string) {
    return this.db().staffAttendanceSyncBatch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { device: { select: { id: true, name: true, status: true } } },
    });
  }

  async rules(tenantId: string) {
    const [attendanceRules, shiftRules] = await Promise.all([
      this.db().staffAttendanceRule.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.db().staffShiftAttendanceRule.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { attendanceRules, shiftRules };
  }

  async createRule(user: JwtUser, dto: AttendanceRuleDto) {
    const rule = await this.db().staffAttendanceRule.create({
      data: { tenantId: user.tid, ...dto },
    });
    await this.audit(user, 'RULE_CREATE', 'RULE', rule.id, dto, 'SUCCESS');
    return rule;
  }

  async corrections(tenantId: string) {
    return this.db().staffAttendanceCorrection.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        staff: { select: { id: true, fullName: true, employeeCode: true } },
      },
    });
  }

  async requestCorrection(user: JwtUser, dto: CorrectionDto) {
    const correction = await this.db().staffAttendanceCorrection.create({
      data: {
        tenantId: user.tid,
        staffProfileId: dto.staffProfileId,
        attendanceDate: new Date(dto.attendanceDate),
        correctionType: dto.correctionType,
        requestedInAt: dto.requestedInAt
          ? new Date(dto.requestedInAt)
          : undefined,
        requestedOutAt: dto.requestedOutAt
          ? new Date(dto.requestedOutAt)
          : undefined,
        reason: dto.reason,
        requestedById: user.sub,
      },
    });
    await this.audit(
      user,
      'CORRECTION_REQUEST',
      'CORRECTION',
      correction.id,
      dto,
      'PENDING',
      undefined,
      dto.staffProfileId,
    );
    return correction;
  }

  async approveCorrection(user: JwtUser, id: string) {
    const correction = await this.db().staffAttendanceCorrection.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!correction) throw new NotFoundException('Correction not found');
    const updated = await this.db().staffAttendanceCorrection.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: user.sub,
        approvedAt: new Date(),
      },
    });
    await this.engine.recomputeRange(
      user.tid,
      correction.attendanceDate,
      correction.attendanceDate,
      correction.staffProfileId,
    );
    await this.audit(
      user,
      'CORRECTION_APPROVE',
      'CORRECTION',
      id,
      correction,
      'SUCCESS',
      undefined,
      correction.staffProfileId,
    );
    return updated;
  }

  async auditLogs(tenantId: string) {
    return this.db().staffAttendanceAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { device: { select: { id: true, name: true } } },
    });
  }

  async profileSummary(tenantId: string, staffProfileId: string) {
    const [mapping, lastPunch, latestRecord] = await Promise.all([
      this.db().staffBiometricMapping.findFirst({
        where: { tenantId, staffProfileId, active: true },
        include: { device: { select: { id: true, name: true, status: true } } },
      }),
      this.db().staffAttendanceRawPunch.findFirst({
        where: { tenantId, staffProfileId },
        orderBy: { punchTimestamp: 'desc' },
      }),
      this.db().staffAttendanceDailyRecord.findFirst({
        where: { tenantId, staffProfileId },
        orderBy: { attendanceDate: 'desc' },
      }),
    ]);
    return { mapping, lastPunch, latestRecord };
  }

  async processPendingAttendance(user: JwtUser) {
    const pendingResult = await this.engine.processBatch(user.tid);
    const today = this.startOfDay(new Date());
    const recomputeResult = await this.engine.recomputeRange(
      user.tid,
      today,
      today,
    );
    const result = { pending: pendingResult, recomputedToday: recomputeResult };
    await this.audit(
      user,
      'ATTENDANCE_PROCESS_PENDING',
      'ATTENDANCE_PROCESSOR',
      undefined,
      result,
      'SUCCESS',
    );
    return result;
  }

  async report(tenantId: string, type: string, query: AttendanceQueryDto) {
    if (type === 'raw-punches')
      return this.reportPayload(
        'Raw Punch Report',
        await this.rawLogs(tenantId, query),
      );
    if (type === 'device-health')
      return this.reportPayload(
        'Device Health Report',
        await this.listDevices(tenantId),
      );
    if (type === 'sync-failures') {
      return this.reportPayload(
        'Sync Failure Report',
        await this.db().staffAttendanceSyncBatch.findMany({
          where: { tenantId, status: { in: ['FAILED', 'PARTIAL'] } },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
      );
    }
    if (type === 'monthly') return this.monthlySummary(tenantId, query);
    const rows = await this.dailyRegister(tenantId, query);
    const filtered = rows.filter((row: any) => {
      if (type === 'late')
        return (row.lateMinutes ?? 0) > 0 || this.hasFlag(row, 'LATE');
      if (type === 'early-exit' || type === 'early')
        return (row.earlyMinutes ?? 0) > 0 || this.hasFlag(row, 'EARLY_OUT');
      if (type === 'ot' || type === 'overtime')
        return (row.overtimeMinutes ?? 0) > 0 || this.hasFlag(row, 'OVERTIME');
      if (type === 'missing-punch')
        return (
          this.hasFlag(row, 'MISSING_OUT') || this.hasFlag(row, 'NO_PUNCH')
        );
      if (type === 'department-wise') return true;
      if (type === 'shift-wise') return true;
      if (type === 'staff-card')
        return (
          !query.staffProfileId || row.staffProfileId === query.staffProfileId
        );
      return true;
    });
    return this.reportPayload(
      this.reportTitle(type),
      filtered,
      this.summarizeAttendance(filtered),
    );
  }

  private reportPayload(
    title: string,
    rows: any[],
    summary?: Record<string, unknown>,
  ) {
    return {
      title,
      generatedAt: new Date(),
      summary: summary ?? { totalRows: rows.length },
      rows,
      export: {
        csvReady: true,
        excelReady: true,
        pdfReady: true,
        printReady: true,
      },
    };
  }

  private summarizeAttendance(rows: any[]) {
    return {
      totalRows: rows.length,
      present: rows.filter((r) =>
        ['PRESENT', 'LATE', 'EARLY_EXIT', 'OVERTIME'].includes(
          String(r.status),
        ),
      ).length,
      absent: rows.filter((r) => r.status === 'ABSENT').length,
      leave: rows.filter((r) => r.status === 'ON_LEAVE').length,
      halfDay: rows.filter((r) => r.status === 'HALF_DAY').length,
      late: rows.filter(
        (r) => (r.lateMinutes ?? 0) > 0 || this.hasFlag(r, 'LATE'),
      ).length,
      earlyExit: rows.filter(
        (r) => (r.earlyMinutes ?? 0) > 0 || this.hasFlag(r, 'EARLY_OUT'),
      ).length,
      overtimeMinutes: rows.reduce(
        (sum, r) => sum + Number(r.overtimeMinutes ?? 0),
        0,
      ),
      workedMinutes: rows.reduce(
        (sum, r) => sum + Number(r.workedMinutes ?? 0),
        0,
      ),
    };
  }

  private reportTitle(type: string) {
    const titles: Record<string, string> = {
      daily: 'Daily Attendance Report',
      late: 'Late Arrival Report',
      early: 'Early Exit Report',
      'early-exit': 'Early Exit Report',
      ot: 'Overtime Report',
      overtime: 'Overtime Report',
      'missing-punch': 'Missing Punch Report',
      'shift-wise': 'Shift-wise Attendance Report',
      'department-wise': 'Department-wise Attendance Report',
      'staff-card': 'Staff Attendance Card',
    };
    return titles[type] ?? 'Attendance Report';
  }

  private startOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private dateOnlyString(value: Date | string) {
    return new Date(value).toISOString().slice(0, 10);
  }

  private monthBounds(value?: string) {
    const base = value
      ? new Date(value.length === 7 ? `${value}-01` : value)
      : new Date();
    const from = new Date(base.getFullYear(), base.getMonth(), 1);
    const to = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return { from: this.startOfDay(from), to: this.startOfDay(to) };
  }

  private eachDate(from: Date, to: Date) {
    const rows: Date[] = [];
    const cursor = this.startOfDay(from);
    const end = this.startOfDay(to);
    while (cursor <= end) {
      rows.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return rows;
  }

  private hasFlag(row: any, flag: string) {
    return (
      Array.isArray(row.exceptionFlags) && row.exceptionFlags.includes(flag)
    );
  }

  private async resolveMapping(
    tenantId: string,
    deviceId: string | undefined,
    punch: RawPunchInput,
  ) {
    const mapping = await this.db().staffBiometricMapping.findFirst({
      where: {
        tenantId,
        active: true,
        OR: [
          { deviceId, deviceUserId: punch.deviceUserId },
          { biometricId: punch.biometricId || punch.deviceUserId },
        ],
      },
    });
    if (mapping) return mapping;
    const staff = await this.db().staffProfile.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { biometricId: punch.deviceUserId },
          { biometricId: punch.biometricId },
        ].filter((item) => Object.values(item)[0]),
      },
    });
    if (!staff?.biometricId) return null;
    return this.db().staffBiometricMapping.upsert({
      where: {
        tenantId_biometricId_active: {
          tenantId,
          biometricId: staff.biometricId,
          active: true,
        },
      },
      update: {
        staffProfileId: staff.id,
        deviceId,
        deviceUserId: punch.deviceUserId,
        syncStatus: 'SYNCED',
        enrollmentStatus: 'PUNCHED_ON_DEVICE',
      },
      create: {
        tenantId,
        staffProfileId: staff.id,
        deviceId,
        biometricId: staff.biometricId,
        deviceUserId: punch.deviceUserId,
        syncStatus: 'SYNCED',
        enrollmentStatus: 'PUNCHED_ON_DEVICE',
      },
    });
  }

  private matchDeviceUserToStaff(
    deviceUser: DeviceUser,
    staffByBiometricId: Map<string, any>,
    staffByRfid: Map<string, any>,
    staffByCode: Map<string, any>,
    staffByName: Map<string, any>,
  ): { staff?: any; source: string; reason: string } {
    const userIdKey = this.matchKey(deviceUser.deviceUserId);
    const cardKey = this.matchKey(deviceUser.cardNumber);
    const nameKey = this.nameKey(deviceUser.name);
    const byDeviceUserId = userIdKey
      ? staffByBiometricId.get(userIdKey)
      : undefined;
    if (byDeviceUserId)
      return {
        staff: byDeviceUserId,
        source: 'DeviceUserID/BiometricID',
        reason: 'Exact DeviceUserID matched ERP Biometric ID',
      };
    const byRfid = cardKey ? staffByRfid.get(cardKey) : undefined;
    if (byRfid)
      return {
        staff: byRfid,
        source: 'RFID/CardNo',
        reason: 'Device CardNo matched ERP RFID',
      };
    const byName = nameKey ? staffByName.get(nameKey) : undefined;
    if (byName)
      return {
        staff: byName,
        source: 'Name',
        reason: 'Normalized device name matched ERP staff name',
      };
    const byCode = userIdKey ? staffByCode.get(userIdKey) : undefined;
    if (byCode)
      return {
        staff: byCode,
        source: 'StaffCodeFallback',
        reason:
          'Fallback staff code match used after biometric/RFID/name failed',
      };
    return {
      source: 'NONE',
      reason: [
        'No device user found in ERP mapping hierarchy.',
        `Device UserID=${deviceUser.deviceUserId || 'NULL'}`,
        `Device Name=${deviceUser.name || 'NULL'}`,
        `CardNo=${deviceUser.cardNumber || 'NULL'}`,
      ].join(' '),
    };
  }

  private matchKey(value: unknown) {
    return value == null ? '' : String(value).trim().toUpperCase();
  }

  private nameKey(value: unknown) {
    return value == null
      ? ''
      : String(value).replace(/[.\s]/g, '').trim().toUpperCase();
  }

  private punchHash(
    tenantId: string,
    deviceId: string | undefined,
    punch: RawPunchInput,
  ) {
    return createHash('sha256')
      .update(
        [
          tenantId,
          deviceId ?? 'middleware',
          punch.deviceUserId,
          punch.biometricId ?? '',
          punch.punchTimestamp.toISOString(),
          punch.punchDirection ?? '',
        ].join('|'),
      )
      .digest('hex');
  }

  private async dedupeActiveMappings(rows: any[]) {
    const byStaff = new Map<string, any>();
    const duplicates: string[] = [];
    for (const row of rows) {
      const key =
        row.staffProfileId ?? `${row.biometricId}:${row.deviceUserId}`;
      const current = byStaff.get(key);
      if (!current) {
        byStaff.set(key, row);
        continue;
      }
      const winner =
        this.mappingScore(row) > this.mappingScore(current) ? row : current;
      const loser = winner.id === row.id ? current : row;
      byStaff.set(key, winner);
      duplicates.push(loser.id);
    }
    if (duplicates.length) {
      await this.db().staffBiometricMapping.updateMany({
        where: { id: { in: duplicates } },
        data: {
          active: false,
          disabledAt: new Date(),
          conflictReason: 'Archived duplicate active biometric mapping row.',
        },
      });
    }
    return Array.from(byStaff.values()).sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime(),
    );
  }

  private mappingScore(row: any) {
    const synced = ['SYNCED', 'PUSH_SUCCESS'].includes(String(row.syncStatus))
      ? 100
      : 0;
    const hasDevice = row.deviceId ? 20 : 0;
    const notFailed = String(row.syncStatus).includes('FAILED') ? -50 : 0;
    const updated =
      new Date(row.updatedAt ?? row.createdAt).getTime() / 1_000_000_000_000;
    return synced + hasDevice + notFailed + updated;
  }

  private async ensureDevice(tenantId: string, id: string) {
    const device = await this.db().staffBiometricDevice.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!device) throw new NotFoundException('Biometric device not found');
    return device;
  }

  deriveLegacyStatus(health: {
    networkStatus?: string;
    authenticationStatus?: string;
    status?: string;
  }) {
    return health.networkStatus === 'ONLINE' &&
      health.authenticationStatus === 'AUTH_SUCCESS'
      ? 'CONNECTED'
      : health.status === 'SYNC_PENDING'
        ? 'SYNC_PENDING'
        : 'DISCONNECTED';
  }

  private buildStaffPushPreview(
    staffRows: any[],
    identityStrategy = 'BIOMETRIC_ID',
  ): StaffPushPreviewRow[] {
    return staffRows.map((staff) => {
      const deviceUserId = this.resolveDeviceUserId(staff, identityStrategy);
      const name = this.cleanDeviceValue(staff.fullName);
      const privilege = 'USER';
      const enabled = staff.status === 'ACTIVE';
      const missing = [
        !deviceUserId ? 'Biometric ID / Device User ID' : null,
        !name ? 'Device Name' : null,
        enabled !== true ? 'Enabled status' : null,
        !privilege ? 'Privilege' : null,
      ].filter(Boolean) as string[];
      return {
        staffProfileId: staff.id,
        employeeCode: staff.employeeCode,
        fullName: staff.fullName,
        biometricId: deviceUserId,
        deviceUserId,
        name,
        cardNumber: this.cleanDeviceValue(staff.rfidNo),
        privilege,
        enabled,
        status: missing.length ? this.missingStatus(missing) : 'READY_TO_PUSH',
        missing,
      };
    });
  }

  private pushValidationMessage(row: StaffPushPreviewRow) {
    return [
      'Cannot push:',
      row.fullName ?? row.employeeCode ?? 'Unknown staff',
      '',
      'Missing:',
      ...row.missing.map((item) => `• ${item}`),
    ].join('\n');
  }

  private missingStatus(missing: string[]) {
    if (missing.some((item) => item.includes('Biometric')))
      return 'MISSING_BIOMETRIC_ID';
    if (missing.some((item) => item.includes('Name'))) return 'MISSING_NAME';
    return 'PUSH_VALIDATION_FAILED';
  }

  private cleanDeviceValue(value: unknown) {
    const text = value == null ? '' : String(value).trim();
    return text || undefined;
  }

  private resolveDeviceUserId(staff: any, identityStrategy: string) {
    if (identityStrategy === 'CUSTOM_DEVICE_USER_ID')
      return this.cleanDeviceValue(
        staff.biometricExternalUserId ?? staff.biometricId,
      );
    if (identityStrategy === 'RFID_NUMBER')
      return this.cleanDeviceValue(staff.rfidNo ?? staff.biometricId);
    if (identityStrategy === 'STAFF_CODE')
      return this.cleanDeviceValue(staff.employeeCode ?? staff.biometricId);
    return this.cleanDeviceValue(staff.biometricId);
  }

  private async deviceIdentityStrategy(tenantId: string) {
    const settings = await this.db().staffAttendanceMasterSetting.findUnique({
      where: { tenantId },
      select: { deviceIdentityStrategy: true },
    });
    return settings?.deviceIdentityStrategy ?? 'BIOMETRIC_ID';
  }

  private registrationStatus(dto: Partial<DeviceConfigDto>) {
    if (
      ['TCP_IP', 'DIRECT_TCP'].includes(String(dto.connectionType ?? '')) &&
      !dto.ipAddress
    ) {
      return 'DRAFT';
    }
    return 'CONFIGURED';
  }

  private async nextDeviceCode(tenantId: string) {
    const count = await this.db().staffBiometricDevice.count({
      where: { tenantId },
    });
    return `BIO-${String(count + 1).padStart(4, '0')}`;
  }

  private toAuditJson(value: unknown): unknown {
    if (value == null) return {};
    return JSON.parse(
      JSON.stringify(value, (_key, innerValue) => {
        if (innerValue instanceof Date) return innerValue.toISOString();
        if (typeof innerValue === 'bigint') return innerValue.toString();
        return innerValue;
      }),
    );
  }

  private async audit(
    user: JwtUser,
    action: string,
    entityType: string,
    entityId?: string,
    payload?: unknown,
    result = 'SUCCESS',
    deviceId?: string,
    staffProfileId?: string,
  ) {
    await this.db().staffAttendanceAuditLog.create({
      data: {
        tenantId: user.tid,
        actorId: user.sub,
        action,
        entityType,
        entityId,
        payload: this.toAuditJson(payload),
        result,
        deviceId,
        staffProfileId,
      },
    });
  }
}
