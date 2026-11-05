import { formatInr } from '@/utils/currency';

export type StudentFeeSnapshot = {
  due?: number;
  paid?: number;
  status?: string;
  moduleLocked?: boolean;
  moduleEnabled?: boolean;
  statusMessage?: string | null;
};

export type StudentFeeDisplay = {
  moduleEnabled: boolean;
  due: number;
  amountLabel: string;
  hint: string;
  showAmount: boolean;
};

/**
 * Renders the student home fee card from the fee-module status on the home API.
 * Amounts and "No Pending Fees" are shown only when that status says the module is live.
 */
export function resolveStudentFeeDisplay(fees?: StudentFeeSnapshot | null): StudentFeeDisplay {
  const moduleEnabled =
    typeof fees?.moduleEnabled === 'boolean'
      ? fees.moduleEnabled
      : !(fees?.moduleLocked === true || String(fees?.status ?? '').toUpperCase() === 'LOCKED');

  if (!moduleEnabled) {
    return {
      moduleEnabled: false,
      due: 0,
      amountLabel: fees?.statusMessage?.trim() || 'Fee Module Not Yet Enabled',
      hint: '',
      showAmount: false,
    };
  }

  const due = Number(fees?.due ?? 0);
  if (Number.isFinite(due) && due > 0) {
    return {
      moduleEnabled: true,
      due,
      amountLabel: formatInr(due),
      hint: 'Pending',
      showAmount: true,
    };
  }

  return {
    moduleEnabled: true,
    due: 0,
    amountLabel: formatInr(0),
    hint: fees?.statusMessage?.trim() || 'No Pending Fees',
    showAmount: true,
  };
}
