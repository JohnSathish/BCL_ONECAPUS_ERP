import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

const QR_PREFIX = 'LIB:';

@Injectable()
export class LibraryQrService {
  constructor(private readonly prisma: PrismaService) {}

  /** Normalize kiosk/phone scan — supports LIB:E:enrollment and LIB:V:pass formats. */
  resolveScanCode(raw: string) {
    const trimmed = raw
      .trim()
      .replace(/\r?\n$/, '')
      .trim();
    if (!trimmed.toUpperCase().startsWith(QR_PREFIX))
      return { code: trimmed, entryMethod: 'RFID' as const };

    const body = trimmed.slice(QR_PREFIX.length);
    if (body.toUpperCase().startsWith('E:')) {
      return { code: body.slice(2).trim(), entryMethod: 'QR' as const };
    }
    if (body.toUpperCase().startsWith('V:')) {
      return { code: body.slice(2).trim(), entryMethod: 'QR' as const };
    }
    return { code: body.trim(), entryMethod: 'QR' as const };
  }

  buildStudentPayload(enrollmentNumber: string) {
    return `${QR_PREFIX}E:${enrollmentNumber}`;
  }

  buildVisitorPayload(passNumber: string) {
    return `${QR_PREFIX}V:${passNumber}`;
  }

  qrImageUrl(payload: string) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
  }

  async getStudentQr(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      include: { masterProfile: true },
    });
    if (!student) throw new NotFoundException('Student record not found');

    const payload = this.buildStudentPayload(student.enrollmentNumber);
    return {
      payload,
      enrollmentNumber: student.enrollmentNumber,
      fullName: student.masterProfile?.fullName ?? student.enrollmentNumber,
      qrImageUrl: this.qrImageUrl(payload),
    };
  }
}
