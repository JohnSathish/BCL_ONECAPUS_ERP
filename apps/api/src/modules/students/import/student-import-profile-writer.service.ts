import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { NormalizedStudentImportRow } from './student-import.handler';

@Injectable()
export class StudentImportProfileWriterService {
  async persistExtendedProfile(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    n: NormalizedStudentImportRow,
  ) {
    if (n.boardExam) {
      const existing = await tx.studentBoardExam.findFirst({
        where: { tenantId, studentId },
        orderBy: { examYear: 'desc' },
      });
      const data = {
        boardName: n.boardExam.boardName,
        schoolName: n.boardExam.schoolName,
        examYear: n.boardExam.examYear,
        totalMarks: n.boardExam.totalMarks,
        percentage: n.boardExam.percentage,
        division: n.boardExam.division,
        registrationType: n.boardExam.registrationType,
      };
      if (existing) {
        await tx.studentBoardExam.update({ where: { id: existing.id }, data });
      } else {
        await tx.studentBoardExam.create({
          data: { tenantId, studentId, ...data },
        });
      }
    }

    if (n.cuetDetail) {
      await tx.studentCuetDetail.upsert({
        where: { studentId },
        create: {
          tenantId,
          studentId,
          cuetApplied: Boolean(
            n.cuetDetail.cuetRollNumber || n.cuetDetail.cuetScore,
          ),
          cuetRollNumber: n.cuetDetail.cuetRollNumber,
          cuetScore: n.cuetDetail.cuetScore,
        },
        update: {
          cuetApplied: Boolean(
            n.cuetDetail.cuetRollNumber || n.cuetDetail.cuetScore,
          ),
          cuetRollNumber: n.cuetDetail.cuetRollNumber,
          cuetScore: n.cuetDetail.cuetScore,
        },
      });
    }

    const academicUpdates: Prisma.StudentAcademicProfileUpdateInput = {};
    if (n.residenceType) academicUpdates.residenceType = n.residenceType;
    if (n.hostelBlock) academicUpdates.hostelBlock = n.hostelBlock;
    if (n.hostelRoom) academicUpdates.hostelRoom = n.hostelRoom;

    if (
      Object.keys(academicUpdates).length > 0 ||
      n.streamId ||
      n.admissionBatchId
    ) {
      const createData: Prisma.StudentAcademicProfileUncheckedCreateInput = {
        tenantId,
        studentId,
        streamId: n.streamId,
        admissionBatchId: n.admissionBatchId,
        class12Subjects: [],
        ...(academicUpdates.residenceType
          ? { residenceType: academicUpdates.residenceType as string }
          : {}),
        ...(academicUpdates.hostelBlock
          ? { hostelBlock: academicUpdates.hostelBlock as string }
          : {}),
        ...(academicUpdates.hostelRoom
          ? { hostelRoom: academicUpdates.hostelRoom as string }
          : {}),
      };
      const updateData: Prisma.StudentAcademicProfileUncheckedUpdateInput = {
        ...(n.streamId ? { streamId: n.streamId } : {}),
        ...(n.admissionBatchId ? { admissionBatchId: n.admissionBatchId } : {}),
        ...(academicUpdates.residenceType
          ? { residenceType: academicUpdates.residenceType as string }
          : {}),
        ...(academicUpdates.hostelBlock
          ? { hostelBlock: academicUpdates.hostelBlock as string }
          : {}),
        ...(academicUpdates.hostelRoom
          ? { hostelRoom: academicUpdates.hostelRoom as string }
          : {}),
      };
      await tx.studentAcademicProfile.upsert({
        where: { studentId },
        create: createData,
        update: updateData,
      });
    }

    if (n.transportNote) {
      await tx.studentRemark.create({
        data: {
          tenantId,
          studentId,
          remarkType: 'IMPORT',
          body: `Transport: ${n.transportNote}`,
          visibility: 'INTERNAL',
        },
      });
    }

    if (n.scholarshipCategory) {
      await tx.studentRemark.create({
        data: {
          tenantId,
          studentId,
          remarkType: 'IMPORT',
          body: `Scholarship category: ${n.scholarshipCategory}`,
          visibility: 'INTERNAL',
        },
      });
    }
  }

  async upsertExtendedGuardians(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    n: NormalizedStudentImportRow,
  ) {
    const upsert = async (
      guardianType: string,
      fullName?: string,
      contactNumber?: string,
      occupation?: string,
    ) => {
      if (!fullName && !contactNumber && !occupation) return;
      await tx.studentGuardian.upsert({
        where: { studentId_guardianType: { studentId, guardianType } },
        create: {
          tenantId,
          studentId,
          guardianType,
          fullName,
          contactNumber,
          occupation,
        },
        update: {
          ...(fullName ? { fullName } : {}),
          ...(contactNumber ? { contactNumber } : {}),
          ...(occupation ? { occupation } : {}),
        },
      });
    };

    await upsert('FATHER', n.fatherName, n.fatherMobile, n.fatherOccupation);
    await upsert('MOTHER', n.motherName, n.motherMobile, n.motherOccupation);
    if (n.guardianName || n.guardianMobile) {
      await upsert('LOCAL', n.guardianName, n.guardianMobile);
    }
  }

  async upsertExtendedAddresses(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    n: NormalizedStudentImportRow,
  ) {
    if (n.turaAddress) {
      await tx.studentAddress.upsert({
        where: { studentId_addressType: { studentId, addressType: 'TURA' } },
        create: {
          tenantId,
          studentId,
          addressType: 'TURA',
          line1: n.turaAddress.line1,
          line2: n.turaAddress.line2,
          city: n.turaAddress.city,
          district: n.turaAddress.district,
          state: n.turaAddress.state,
          pinCode: n.turaAddress.pinCode,
        },
        update: {
          line1: n.turaAddress.line1,
          line2: n.turaAddress.line2,
          city: n.turaAddress.city,
          district: n.turaAddress.district,
          state: n.turaAddress.state,
          pinCode: n.turaAddress.pinCode,
        },
      });
    }
    if (n.homeAddress) {
      await tx.studentAddress.upsert({
        where: { studentId_addressType: { studentId, addressType: 'HOME' } },
        create: {
          tenantId,
          studentId,
          addressType: 'HOME',
          line1: n.homeAddress.line1,
          line2: n.homeAddress.line2,
          city: n.homeAddress.city,
          district: n.homeAddress.district,
          state: n.homeAddress.state,
          pinCode: n.homeAddress.pinCode,
        },
        update: {
          line1: n.homeAddress.line1,
          line2: n.homeAddress.line2,
          city: n.homeAddress.city,
          district: n.homeAddress.district,
          state: n.homeAddress.state,
          pinCode: n.homeAddress.pinCode,
        },
      });
    }
  }
}
