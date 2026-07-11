import type { Prisma } from '@prisma/client';

/** Shared include for LMS workspace list rows (admin + my-workspaces). */
export const lmsWorkspaceListInclude = {
  course: { select: { code: true, title: true, credits: true } },
  shift: { select: { id: true, code: true, name: true } },
  offeringSection: {
    select: {
      sectionCode: true,
      shift: { select: { id: true, code: true, name: true } },
    },
  },
  courseOffering: {
    select: {
      id: true,
      category: true,
      mappingSource: true,
      programVersion: {
        select: {
          program: { select: { code: true, name: true } },
        },
      },
      categoryPool: {
        select: {
          poolName: true,
          categoryType: true,
          shift: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
  _count: {
    select: { materials: true, announcements: true, lessonPlans: true },
  },
} satisfies Prisma.LmsWorkspaceInclude;

export type LmsWorkspaceListRow = Prisma.LmsWorkspaceGetPayload<{
  include: typeof lmsWorkspaceListInclude;
}>;

export type LmsWorkspaceContext = {
  shiftCode: string | null;
  shiftName: string | null;
  sectionCode: string | null;
  programmeCode: string | null;
  programmeName: string | null;
  category: string | null;
  poolName: string | null;
  offeringId: string;
};

export function enrichLmsWorkspaceRow<T extends LmsWorkspaceListRow>(ws: T) {
  const shift =
    ws.shift ??
    ws.offeringSection?.shift ??
    ws.courseOffering?.categoryPool?.shift ??
    null;
  const programme = ws.courseOffering?.programVersion?.program ?? null;
  const pool = ws.courseOffering?.categoryPool ?? null;
  const category = ws.courseOffering?.category ?? pool?.categoryType ?? null;

  const context: LmsWorkspaceContext = {
    shiftCode: shift?.code ?? null,
    shiftName: shift?.name ?? null,
    sectionCode: ws.offeringSection?.sectionCode ?? null,
    programmeCode: programme?.code ?? null,
    programmeName: programme?.name ?? null,
    category,
    poolName: pool?.poolName ?? null,
    offeringId: ws.courseOfferingId,
  };

  return { ...ws, context };
}
