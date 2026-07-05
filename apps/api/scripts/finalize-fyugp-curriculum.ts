/**
 * Finalize FYUGP Sem 1–6 curriculum: migrate registrations, retire obsolete
 * courses/pools, and lock seed exclusions so legacy data cannot return.
 *
 *   npx tsx scripts/finalize-fyugp-curriculum.ts
 *   npx tsx scripts/finalize-fyugp-curriculum.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import {
  buildCurriculumOfferingKey,
  mergeCatalogSeedExclusions,
} from '../src/common/services/catalog-seed-exclusions.util';
import {
  CANONICAL_POOL_NAMES,
  LEGACY_EXCLUDED_COURSE_CODES,
  buildCanonicalCourseCodeSet,
  legacyPoolToCanonicalName,
  normalizeCourseCode,
  poolCodesForName,
  resolveCanonicalCourseCode,
} from '../src/modules/academic-engine/domain/fyugp-canonical-catalog.util';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const tenantSlug =
  process.argv.find((a) => a.startsWith('--tenant='))?.split('=')[1] ?? 'demo';

function normalizeShiftCode(code?: string | null): 'DAY' | 'MORNING' {
  return code === 'MORNING' ? 'MORNING' : 'DAY';
}

type Stats = {
  migratedLines: number;
  deletedLines: number;
  retiredCourses: number;
  retiredOfferings: number;
  removedPools: number;
  updatedVtcTracks: number;
};

async function recalcSeatLedger(tenantId: string, sectionId: string) {
  const confirmed = await prisma.semesterRegistrationLine.count({
    where: { offeringSectionId: sectionId, status: 'confirmed' },
  });
  const waitlisted = await prisma.semesterRegistrationLine.count({
    where: { offeringSectionId: sectionId, status: 'waitlisted' },
  });
  await prisma.offeringSeatLedger.upsert({
    where: { offeringSectionId: sectionId },
    create: {
      offeringSectionId: sectionId,
      tenantId,
      confirmedCount: confirmed,
      waitlistCount: waitlisted,
    },
    update: { confirmedCount: confirmed, waitlistCount: waitlisted },
  });
}

async function findCanonicalOffering(
  tenantId: string,
  poolName: string,
  canonicalCode: string,
  semesterNo: number,
  categoryType: string,
  shiftFallback?: 'DAY' | 'MORNING',
) {
  const tryPools = [poolName];
  if (shiftFallback) {
    const alt =
      shiftFallback === 'MORNING'
        ? poolName.replace('Morning', 'Day')
        : poolName.replace('Day', 'Morning');
    if (alt !== poolName) tryPools.push(alt);
  }

  for (const name of tryPools) {
    const pool = await prisma.categoryPool.findFirst({
      where: { tenantId, poolName: name, active: true },
    });
    if (!pool) continue;

    const course = await prisma.course.findFirst({
      where: { tenantId, code: canonicalCode, deletedAt: null },
    });
    if (!course) continue;

    const allowed = poolCodesForName(name);
    if (allowed && !allowed.includes(canonicalCode as never)) continue;

    let offering = await prisma.courseOffering.findFirst({
      where: {
        tenantId,
        categoryPoolId: pool.id,
        courseId: course.id,
        deletedAt: null,
      },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { sectionCode: 'asc' },
        },
      },
    });

    if (!offering && apply) {
      offering = await prisma.courseOffering.create({
        data: {
          tenantId,
          categoryPoolId: pool.id,
          mappingSource: 'SHARED_POOL',
          courseId: course.id,
          semesterSequence: semesterNo,
          category: categoryType,
          programVersionId: null,
        },
        include: {
          sections: {
            where: { deletedAt: null },
            orderBy: { sectionCode: 'asc' },
          },
        },
      });
    }

    if (offering) return { pool, offering, course };
  }

  return null;
}

async function findDirectOffering(
  tenantId: string,
  programVersionId: string,
  canonicalCode: string,
  semesterSequence: number,
) {
  const course = await prisma.course.findFirst({
    where: { tenantId, code: canonicalCode, deletedAt: null },
  });
  if (!course) return null;

  const exact = await prisma.courseOffering.findFirst({
    where: {
      tenantId,
      programVersionId,
      courseId: course.id,
      semesterSequence,
      mappingSource: 'DIRECT',
      deletedAt: null,
    },
    include: {
      sections: {
        where: { deletedAt: null },
        orderBy: { sectionCode: 'asc' },
      },
    },
  });
  if (exact) return exact;

  return prisma.courseOffering.findFirst({
    where: {
      tenantId,
      programVersionId,
      courseId: course.id,
      mappingSource: 'DIRECT',
      deletedAt: null,
    },
    include: {
      sections: {
        where: { deletedAt: null },
        orderBy: { sectionCode: 'asc' },
      },
    },
    orderBy: { semesterSequence: 'asc' },
  });
}

async function migrateRegistrationLine(
  tenantId: string,
  lineId: string,
  targetOfferingId: string,
  targetSectionId: string | null,
  stats: Stats,
) {
  const line = await prisma.semesterRegistrationLine.findUnique({
    where: { id: lineId },
    select: {
      registrationId: true,
      offeringSectionId: true,
      offeringId: true,
    },
  });
  if (!line) return;

  const duplicate = await prisma.semesterRegistrationLine.findFirst({
    where: {
      registrationId: line.registrationId,
      offeringSectionId: targetSectionId ?? undefined,
      id: { not: lineId },
    },
  });

  if (!apply) {
    stats.migratedLines += 1;
    return;
  }

  if (duplicate) {
    await prisma.semesterRegistrationLine.delete({ where: { id: lineId } });
    stats.deletedLines += 1;
    if (line.offeringSectionId) {
      await recalcSeatLedger(tenantId, line.offeringSectionId);
    }
    return;
  }

  await prisma.semesterRegistrationLine.update({
    where: { id: lineId },
    data: {
      offeringId: targetOfferingId,
      offeringSectionId: targetSectionId,
    },
  });
  stats.migratedLines += 1;
  if (line.offeringSectionId) {
    await recalcSeatLedger(tenantId, line.offeringSectionId);
  }
  if (targetSectionId) {
    await recalcSeatLedger(tenantId, targetSectionId);
  }
}

async function dropUnmigratableAliasRegistrations(
  tenantId: string,
  canonicalCodes: Set<string>,
  stats: Stats,
) {
  const aliasCourses = await prisma.course.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true },
  });

  for (const course of aliasCourses) {
    const resolved = resolveCanonicalCourseCode(course.code);
    if (
      normalizeCourseCode(course.code) === resolved ||
      !canonicalCodes.has(resolved)
    ) {
      continue;
    }

    const lines = await prisma.semesterRegistrationLine.findMany({
      where: {
        offering: { courseId: course.id, deletedAt: null },
        status: { in: ['confirmed', 'pending', 'waitlisted'] },
      },
      include: {
        offering: {
          select: {
            programVersionId: true,
            categoryPoolId: true,
            semesterSequence: true,
            category: true,
            categoryPool: { select: { poolName: true } },
          },
        },
        registration: {
          select: {
            semesterSequence: true,
            shift: { select: { code: true } },
          },
        },
        offeringSection: { select: { sectionCode: true } },
      },
    });

    for (const line of lines) {
      let targetOfferingId: string | null = null;

      if (line.offering.categoryPoolId) {
        const shiftCode = normalizeShiftCode(line.registration.shift?.code);
        const canonicalPoolName = legacyPoolToCanonicalName(
          `${line.offering.category ?? line.category} Semester ${line.offering.semesterSequence ?? line.registration.semesterSequence} Pool`,
          shiftCode,
        );
        if (canonicalPoolName) {
          const target = await findCanonicalOffering(
            tenantId,
            canonicalPoolName,
            resolved,
            line.offering.semesterSequence ??
              line.registration.semesterSequence,
            line.offering.category ?? line.category,
            shiftCode,
          );
          targetOfferingId = target?.offering.id ?? null;
        }
      } else if (line.offering.programVersionId) {
        const target = await findDirectOffering(
          tenantId,
          line.offering.programVersionId,
          resolved,
          line.offering.semesterSequence ?? line.registration.semesterSequence,
        );
        targetOfferingId = target?.id ?? null;
      } else {
        const shiftCode = normalizeShiftCode(line.registration.shift?.code);
        const sem =
          line.offering.semesterSequence ?? line.registration.semesterSequence;
        const cat = line.offering.category ?? line.category;
        const canonicalPoolName = legacyPoolToCanonicalName(
          `${cat} Semester ${sem} Pool`,
          shiftCode,
        );
        if (canonicalPoolName) {
          const target = await findCanonicalOffering(
            tenantId,
            canonicalPoolName,
            resolved,
            sem,
            cat,
            shiftCode,
          );
          targetOfferingId = target?.offering.id ?? null;
        }
      }

      if (targetOfferingId) continue;

      console.log(
        `  DROP unmigratable ${course.code} line ${line.id.slice(0, 8)}`,
      );
      if (apply) {
        const sectionId = line.offeringSectionId;
        await prisma.semesterRegistrationLine.delete({
          where: { id: line.id },
        });
        stats.deletedLines += 1;
        if (sectionId) await recalcSeatLedger(tenantId, sectionId);
      } else {
        stats.deletedLines += 1;
      }
    }
  }
}

async function dropLegacyExcludedRegistrations(tenantId: string, stats: Stats) {
  const legacyCourses = await prisma.course.findMany({
    where: {
      tenantId,
      deletedAt: null,
      code: { in: [...LEGACY_EXCLUDED_COURSE_CODES] },
    },
    select: { id: true, code: true },
  });

  for (const course of legacyCourses) {
    const lines = await prisma.semesterRegistrationLine.findMany({
      where: {
        offering: { courseId: course.id },
        status: { in: ['confirmed', 'pending', 'waitlisted'] },
      },
      select: { id: true, offeringSectionId: true },
    });
    if (!lines.length) continue;
    console.log(`  DROP ${lines.length} legacy line(s) on ${course.code}`);
    if (apply) {
      for (const line of lines) {
        await prisma.semesterRegistrationLine.delete({
          where: { id: line.id },
        });
        stats.deletedLines += 1;
        if (line.offeringSectionId) {
          await recalcSeatLedger(tenantId, line.offeringSectionId);
        }
      }
    } else {
      stats.deletedLines += lines.length;
    }
  }
}

async function migrateLegacyPoolRegistrations(
  tenantId: string,
  shifts: Record<string, string>,
  stats: Stats,
) {
  const legacyPools = await prisma.categoryPool.findMany({
    where: {
      tenantId,
      active: true,
      poolName: { contains: 'Semester' },
      NOT: { poolName: { in: [...CANONICAL_POOL_NAMES] } },
    },
    include: {
      offerings: {
        where: { deletedAt: null },
        include: { course: { select: { code: true } } },
      },
    },
  });

  for (const legacyPool of legacyPools) {
    console.log(`\nLegacy pool: ${legacyPool.poolName}`);
    for (const offering of legacyPool.offerings) {
      const lines = await prisma.semesterRegistrationLine.findMany({
        where: {
          offeringId: offering.id,
          status: { in: ['confirmed', 'pending', 'waitlisted'] },
        },
        include: {
          registration: {
            include: {
              shift: { select: { code: true } },
              student: {
                select: {
                  programVersionId: true,
                  primaryShift: { select: { code: true } },
                },
              },
            },
          },
          offeringSection: { select: { sectionCode: true, shiftId: true } },
        },
      });

      for (const line of lines) {
        const shiftCode = normalizeShiftCode(
          line.registration.shift?.code ??
            line.registration.student.primaryShift?.code,
        );
        const canonicalPoolName = legacyPoolToCanonicalName(
          legacyPool.poolName,
          shiftCode,
        );
        if (!canonicalPoolName) {
          console.log(`  SKIP line ${line.id.slice(0, 8)}: no canonical pool`);
          continue;
        }

        const canonicalCode = resolveCanonicalCourseCode(offering.course.code);
        const target = await findCanonicalOffering(
          tenantId,
          canonicalPoolName,
          canonicalCode,
          legacyPool.semesterNo,
          legacyPool.categoryType,
          shiftCode,
        );
        if (!target?.offering) {
          console.log(
            `  SKIP ${offering.course.code} → ${canonicalCode} @ ${canonicalPoolName}: no offering`,
          );
          continue;
        }

        const sectionCode = line.offeringSection?.sectionCode ?? 'A';
        const shiftId = shifts[shiftCode];
        let section =
          target.offering.sections.find(
            (s) =>
              s.sectionCode === sectionCode &&
              (shiftId == null || s.shiftId === shiftId),
          ) ?? target.offering.sections[0];

        if (!section && apply) {
          section = await prisma.offeringSection.create({
            data: {
              tenantId,
              offeringId: target.offering.id,
              sectionCode,
              shiftId: shiftId ?? null,
              capacity: 40,
            },
          });
        }

        console.log(
          `  MOVE ${offering.course.code} → ${canonicalCode} @ ${canonicalPoolName}[${section?.sectionCode ?? '?'}]`,
        );
        await migrateRegistrationLine(
          tenantId,
          line.id,
          target.offering.id,
          section?.id ?? null,
          stats,
        );
      }
    }
  }
}

async function migrateAliasCourseRegistrations(
  tenantId: string,
  canonicalCodes: Set<string>,
  stats: Stats,
) {
  const activeCourses = await prisma.course.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true },
  });

  for (const course of activeCourses) {
    const canonicalCode = resolveCanonicalCourseCode(course.code);
    if (canonicalCode === course.code || !canonicalCodes.has(canonicalCode)) {
      continue;
    }

    const lines = await prisma.semesterRegistrationLine.findMany({
      where: {
        offering: { courseId: course.id, deletedAt: null },
        status: { in: ['confirmed', 'pending', 'waitlisted'] },
      },
      include: {
        offering: {
          select: {
            id: true,
            programVersionId: true,
            categoryPoolId: true,
            semesterSequence: true,
            category: true,
            categoryPool: { select: { poolName: true } },
          },
        },
        registration: {
          select: {
            semesterSequence: true,
            shift: { select: { code: true } },
            student: {
              select: {
                programVersionId: true,
                primaryShift: { select: { code: true } },
              },
            },
          },
        },
        offeringSection: { select: { sectionCode: true } },
      },
    });

    for (const line of lines) {
      let targetOfferingId: string | null = null;
      let targetSectionId: string | null = null;

      if (line.offering.categoryPoolId && line.offering.categoryPool) {
        const shiftCode = normalizeShiftCode(line.registration.shift?.code);
        const poolName =
          legacyPoolToCanonicalName(
            line.offering.categoryPool.poolName.replace(
              /^(Day|Morning) Shift /,
              '',
            ),
            shiftCode,
          ) ?? line.offering.categoryPool.poolName;

        const canonicalPoolName = CANONICAL_POOL_NAMES.has(poolName)
          ? poolName
          : legacyPoolToCanonicalName(
              `${line.offering.category} Semester ${line.offering.semesterSequence} Pool`,
              shiftCode,
            );

        if (canonicalPoolName) {
          const target = await findCanonicalOffering(
            tenantId,
            canonicalPoolName,
            canonicalCode,
            line.offering.semesterSequence ??
              line.registration.semesterSequence,
            line.offering.category ?? line.category,
            normalizeShiftCode(line.registration.shift?.code),
          );
          if (target?.offering) {
            targetOfferingId = target.offering.id;
            const section =
              target.offering.sections.find(
                (s) =>
                  s.sectionCode === (line.offeringSection?.sectionCode ?? 'A'),
              ) ?? target.offering.sections[0];
            targetSectionId = section?.id ?? null;
          }
        }
      } else if (line.offering.programVersionId) {
        const target = await findDirectOffering(
          tenantId,
          line.offering.programVersionId,
          canonicalCode,
          line.offering.semesterSequence ?? line.registration.semesterSequence,
        );
        if (target) {
          targetOfferingId = target.id;
          const section =
            target.sections.find(
              (s) =>
                s.sectionCode === (line.offeringSection?.sectionCode ?? 'A'),
            ) ?? target.sections[0];
          targetSectionId = section?.id ?? null;
        }
      } else {
        const shiftCode = normalizeShiftCode(
          line.registration.shift?.code ??
            line.registration.student?.primaryShift?.code,
        );
        const sem =
          line.offering.semesterSequence ?? line.registration.semesterSequence;
        const cat = line.offering.category ?? line.category;
        const canonicalPoolName = legacyPoolToCanonicalName(
          `${cat} Semester ${sem} Pool`,
          shiftCode,
        );
        if (canonicalPoolName) {
          const target = await findCanonicalOffering(
            tenantId,
            canonicalPoolName,
            canonicalCode,
            sem,
            cat,
            shiftCode,
          );
          if (target?.offering) {
            targetOfferingId = target.offering.id;
            const section =
              target.offering.sections.find(
                (s) =>
                  s.sectionCode === (line.offeringSection?.sectionCode ?? 'A'),
              ) ?? target.offering.sections[0];
            targetSectionId = section?.id ?? null;
          }
        }
      }

      if (!targetOfferingId) {
        console.log(
          `  ALIAS SKIP ${course.code} → ${canonicalCode}: no target offering`,
        );
        continue;
      }

      console.log(`  ALIAS MOVE ${course.code} → ${canonicalCode}`);
      await migrateRegistrationLine(
        tenantId,
        line.id,
        targetOfferingId,
        targetSectionId,
        stats,
      );
    }
  }
}

async function updateVtcTrackReferences(tenantId: string, stats: Stats) {
  const tracks = await prisma.studentVtcTrack.findMany({
    where: { tenantId },
    include: {
      selectedSem3Offering: { include: { course: true } },
      selectedSem4Offering: { include: { course: true } },
      selectedSem6Offering: { include: { course: true } },
    },
  });

  for (const track of tracks) {
    const updates: Record<string, string | null> = {};
    for (const [field, offering] of [
      ['selectedSem3OfferingId', track.selectedSem3Offering],
      ['selectedSem4OfferingId', track.selectedSem4Offering],
      ['selectedSem6OfferingId', track.selectedSem6Offering],
    ] as const) {
      if (!offering || offering.deletedAt) continue;
      const canonicalCode = resolveCanonicalCourseCode(offering.course.code);
      if (canonicalCode === offering.course.code && !offering.deletedAt) {
        continue;
      }
      const replacement = await prisma.courseOffering.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          course: { code: canonicalCode, deletedAt: null },
          categoryPool: {
            active: true,
            semesterNo:
              field === 'selectedSem3OfferingId'
                ? 3
                : field === 'selectedSem4OfferingId'
                  ? 4
                  : 6,
            categoryType: 'VTC',
          },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (replacement && replacement.id !== offering.id) {
        updates[field] = replacement.id;
        console.log(
          `  VTC track ${track.studentId.slice(0, 8)} ${field}: ${offering.course.code} → ${canonicalCode}`,
        );
      }
    }
    if (Object.keys(updates).length && apply) {
      await prisma.studentVtcTrack.update({
        where: { id: track.id },
        data: updates,
      });
      stats.updatedVtcTracks += 1;
    }
  }
}

async function retireObsoleteCourses(
  tenantId: string,
  canonicalCodes: Set<string>,
  stats: Stats,
) {
  const courses = await prisma.course.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      offerings: {
        where: { deletedAt: null },
        include: { course: { select: { code: true } } },
      },
    },
  });

  const toRetire: string[] = [];
  const curriculumKeys: string[] = [];

  for (const course of courses) {
    const resolved = resolveCanonicalCourseCode(course.code);
    const shouldKeep =
      canonicalCodes.has(resolved) &&
      course.code === resolved &&
      !(LEGACY_EXCLUDED_COURSE_CODES as readonly string[]).includes(
        course.code,
      );

    if (shouldKeep) continue;

    const isLegacyImportAlias =
      /^VTC:\s/i.test(course.code) ||
      /^GAR\u2013/i.test(course.code) ||
      /^AEC\u2013/i.test(course.code);

    const activeRegs = await prisma.semesterRegistrationLine.count({
      where: {
        offering: { courseId: course.id },
        status: { in: ['confirmed', 'pending', 'waitlisted'] },
      },
    });
    if (activeRegs > 0 && !isLegacyImportAlias) {
      console.log(`  KEEP (regs=${activeRegs}): ${course.code}`);
      continue;
    }

    toRetire.push(course.code);
    for (const offering of course.offerings) {
      curriculumKeys.push(buildCurriculumOfferingKey(offering));
    }
  }

  if (!toRetire.length) return;

  console.log(`\nRetiring ${toRetire.length} obsolete course(s)`);
  if (apply) {
    await mergeCatalogSeedExclusions(prisma, tenantId, {
      courseCodes: [...toRetire, ...LEGACY_EXCLUDED_COURSE_CODES],
      curriculumKeys,
    });

    const courseIds = courses
      .filter((c) => toRetire.includes(c.code))
      .map((c) => c.id);

    await prisma.$transaction([
      prisma.categoryPoolCourse.updateMany({
        where: { courseId: { in: courseIds }, active: true },
        data: { active: false },
      }),
      prisma.courseOffering.updateMany({
        where: { courseId: { in: courseIds }, tenantId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      prisma.course.updateMany({
        where: { id: { in: courseIds } },
        data: { deletedAt: new Date() },
      }),
    ]);
    stats.retiredCourses = toRetire.length;
  } else {
    for (const code of toRetire) console.log(`  would retire: ${code}`);
    stats.retiredCourses = toRetire.length;
  }
}

async function removeLegacyPools(tenantId: string, stats: Stats) {
  const legacyPools = await prisma.categoryPool.findMany({
    where: {
      tenantId,
      active: true,
      poolName: { contains: 'Semester' },
      NOT: { poolName: { in: [...CANONICAL_POOL_NAMES] } },
    },
  });

  for (const pool of legacyPools) {
    const activeRegs = await prisma.semesterRegistrationLine.count({
      where: {
        offering: { categoryPoolId: pool.id, deletedAt: null },
        status: { in: ['confirmed', 'pending', 'waitlisted'] },
      },
    });
    if (activeRegs > 0) {
      console.log(`  KEEP pool ${pool.poolName} (regs=${activeRegs})`);
      continue;
    }

    console.log(`  REMOVE pool ${pool.poolName}`);
    if (!apply) {
      stats.removedPools += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.courseOffering.updateMany({
        where: { categoryPoolId: pool.id, tenantId },
        data: { deletedAt: new Date() },
      });
      await tx.programmePoolAssignment.updateMany({
        where: { poolId: pool.id },
        data: { active: false },
      });
      await tx.categoryPoolCourse.deleteMany({ where: { poolId: pool.id } });
      await tx.categoryPool.update({
        where: { id: pool.id },
        data: { active: false },
      });
    });
    stats.removedPools += 1;
  }
}

async function deactivateStalePoolOfferings(tenantId: string, stats: Stats) {
  const canonicalPools = await prisma.categoryPool.findMany({
    where: {
      tenantId,
      active: true,
      poolName: { in: [...CANONICAL_POOL_NAMES] },
    },
    include: {
      courses: { include: { course: { select: { code: true } } } },
      offerings: {
        where: { deletedAt: null },
        include: { course: { select: { code: true } } },
      },
    },
  });

  for (const pool of canonicalPools) {
    const allowedCodes = poolCodesForName(pool.poolName);
    if (!allowedCodes) continue;
    const allowed = new Set(allowedCodes);

    for (const offering of pool.offerings) {
      if (allowed.has(offering.course.code as never)) continue;
      const activeRegs = await prisma.semesterRegistrationLine.count({
        where: {
          offeringId: offering.id,
          status: { in: ['confirmed', 'pending', 'waitlisted'] },
        },
      });
      if (activeRegs > 0) {
        console.log(
          `  KEEP stale offering ${offering.course.code} @ ${pool.poolName} (regs=${activeRegs})`,
        );
        continue;
      }
      console.log(
        `  DEACTIVATE offering ${offering.course.code} @ ${pool.poolName}`,
      );
      if (apply) {
        await prisma.courseOffering.update({
          where: { id: offering.id },
          data: { deletedAt: new Date() },
        });
        stats.retiredOfferings += 1;
      }
    }

    for (const row of pool.courses) {
      if (row.active && !allowed.has(row.course.code as never)) {
        if (apply) {
          await prisma.categoryPoolCourse.update({
            where: { id: row.id },
            data: { active: false },
          });
        }
      }
    }
  }
}

/** Sem 4+ never has pool-category DIRECT rows (MDC/AEC/SEC/VAC are Sem 1–3 pools only). */
async function removeInvalidLateSemesterPoolOfferings(
  tenantId: string,
  stats: Stats,
) {
  const poolCategories = ['MDC', 'AEC', 'SEC', 'VAC'] as const;
  const offerings = await prisma.courseOffering.findMany({
    where: {
      tenantId,
      deletedAt: null,
      mappingSource: 'DIRECT',
      semesterSequence: { gte: 4 },
      category: { in: [...poolCategories] },
    },
    include: {
      course: { select: { code: true } },
      programVersion: { include: { program: { select: { code: true } } } },
    },
  });

  for (const offering of offerings) {
    const activeRegs = await prisma.semesterRegistrationLine.count({
      where: {
        offeringId: offering.id,
        status: { in: ['confirmed', 'pending', 'waitlisted'] },
      },
    });
    const programCode = offering.programVersion?.program.code ?? '?';
    if (activeRegs > 0) {
      console.log(
        `  KEEP invalid ${offering.category} offering ${offering.course.code} @ ${programCode} sem ${offering.semesterSequence} (regs=${activeRegs})`,
      );
      continue;
    }
    console.log(
      `  RETIRE invalid ${offering.category} offering ${offering.course.code} @ ${programCode} sem ${offering.semesterSequence}`,
    );
    if (apply) {
      await prisma.courseOffering.update({
        where: { id: offering.id },
        data: { deletedAt: new Date() },
      });
      stats.retiredOfferings += 1;
    }
  }
}

async function removeInvalidPoolAssignments(tenantId: string) {
  const assignments = await prisma.programmePoolAssignment.findMany({
    where: { tenantId, active: true },
    include: { pool: { select: { poolName: true, active: true } } },
  });

  for (const row of assignments) {
    if (!row.pool.active || !CANONICAL_POOL_NAMES.has(row.pool.poolName)) {
      console.log(`  DEACTIVATE pool assignment: ${row.pool.poolName}`);
      if (apply) {
        await prisma.programmePoolAssignment.update({
          where: { id: row.id },
          data: { active: false },
        });
      }
    }
  }
}

async function lockSeedExclusions(tenantId: string) {
  const obsolete = await prisma.course.findMany({
    where: {
      tenantId,
      deletedAt: { not: null },
      code: { notIn: [...buildCanonicalCourseCodeSet()] },
    },
    select: { code: true },
  });
  const codes = [
    ...new Set([
      ...LEGACY_EXCLUDED_COURSE_CODES,
      ...obsolete.map((c) => c.code),
    ]),
  ];
  if (apply) {
    await mergeCatalogSeedExclusions(prisma, tenantId, { courseCodes: codes });
  }
  console.log(`\nSeed exclusions locked: ${codes.length} course codes`);
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" not found`);

  const shifts = Object.fromEntries(
    (
      await prisma.shift.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, code: true },
      })
    ).map((s) => [s.code, s.id]),
  );

  const canonicalCodes = buildCanonicalCourseCodeSet();
  const stats: Stats = {
    migratedLines: 0,
    deletedLines: 0,
    retiredCourses: 0,
    retiredOfferings: 0,
    removedPools: 0,
    updatedVtcTracks: 0,
  };

  console.log(`${apply ? 'APPLY' : 'DRY RUN'} | tenant=${tenantSlug}`);
  console.log(`Canonical course codes: ${canonicalCodes.size}`);

  console.log('\n=== Phase 0: Drop legacy demo registrations ===');
  await dropLegacyExcludedRegistrations(tenant.id, stats);

  console.log('\n=== Phase 1: Migrate legacy pool registrations ===');
  await migrateLegacyPoolRegistrations(tenant.id, shifts, stats);

  console.log('\n=== Phase 2: Migrate alias course registrations ===');
  await migrateAliasCourseRegistrations(tenant.id, canonicalCodes, stats);

  console.log('\n=== Phase 3: Update VTC track references ===');
  await updateVtcTrackReferences(tenant.id, stats);

  console.log('\n=== Phase 4: Deactivate stale pool offerings ===');
  await deactivateStalePoolOfferings(tenant.id, stats);

  console.log(
    '\n=== Phase 4b: Retire invalid Sem 4+ pool-category DIRECT offerings ===',
  );
  await removeInvalidLateSemesterPoolOfferings(tenant.id, stats);

  console.log('\n=== Phase 5: Remove invalid pool assignments ===');
  await removeInvalidPoolAssignments(tenant.id);

  console.log('\n=== Phase 7: Remove legacy pools ===');
  await removeLegacyPools(tenant.id, stats);

  console.log('\n=== Phase 7b: Drop unmigratable alias registrations ===');
  await dropUnmigratableAliasRegistrations(tenant.id, canonicalCodes, stats);

  console.log('\n=== Phase 8: Retire remaining obsolete courses ===');
  await retireObsoleteCourses(tenant.id, canonicalCodes, stats);

  console.log('\n=== Phase 9: Lock seed exclusions ===');
  await lockSeedExclusions(tenant.id);

  console.log('\n--- Summary ---');
  console.log(JSON.stringify(stats, null, 2));
  if (!apply) console.log('\nRe-run with --apply to execute changes.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
