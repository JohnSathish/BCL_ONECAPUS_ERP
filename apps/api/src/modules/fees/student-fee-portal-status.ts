/** Copy returned to student dashboards when the fee module is not live. */
export const FEE_MODULE_NOT_ENABLED_MESSAGE = 'Fee Module Not Yet Enabled';

/** Copy returned only after a live fee module reports a real zero balance. */
export const NO_PENDING_FEES_MESSAGE = 'No Pending Fees';

export type StudentFeePortalStatus = 'LOCKED' | 'PENDING' | 'PAID';

export type StudentFeePortalView = {
  moduleEnabled: boolean;
  moduleLocked: boolean;
  paid: number;
  due: number;
  status: StudentFeePortalStatus;
  semesterLabel: string;
  statusMessage: string | null;
};

/**
 * Student-facing fee card state.
 * Disabled portal flag, or a portal that has never published fee demand,
 * must not be presented as a genuine zero balance.
 */
export function studentFeePortalView(input: {
  portalEnabled: boolean;
  demandPublished: boolean;
  outstanding: number;
  paid: number;
}): StudentFeePortalView {
  const moduleEnabled = input.portalEnabled && input.demandPublished;
  if (!moduleEnabled) {
    return {
      moduleEnabled: false,
      moduleLocked: true,
      paid: 0,
      due: 0,
      status: 'LOCKED',
      semesterLabel: FEE_MODULE_NOT_ENABLED_MESSAGE,
      statusMessage: FEE_MODULE_NOT_ENABLED_MESSAGE,
    };
  }

  const due = Number(input.outstanding) || 0;
  const paid = Number(input.paid) || 0;
  if (due > 0) {
    return {
      moduleEnabled: true,
      moduleLocked: false,
      paid,
      due,
      status: 'PENDING',
      semesterLabel: 'Current semester',
      statusMessage: null,
    };
  }

  return {
    moduleEnabled: true,
    moduleLocked: false,
    paid,
    due: 0,
    status: 'PAID',
    semesterLabel: 'Current semester',
    statusMessage: NO_PENDING_FEES_MESSAGE,
  };
}
