'use client';

import { ErpFormGrid, ErpFormSection } from '@/components/erp/erp-workspace-shell';
import {
  GlassField,
  glassInputClass,
} from '@/components/students-module/add-student/ui/glass-field';
import type { AddStaffDraft } from '@/components/staff-module/add-staff/types/draft';

type Props = {
  draft: AddStaffDraft;
  setDraft: React.Dispatch<React.SetStateAction<AddStaffDraft>>;
};

export function StepSalary({ draft, setDraft }: Props) {
  return (
    <ErpFormSection
      title="Salary & bank"
      description="Payroll details (optional — can be updated later)"
    >
      <ErpFormGrid>
        <GlassField label="Bank name">
          <input
            className={glassInputClass}
            value={draft.bankName}
            onChange={(e) => setDraft((d) => ({ ...d, bankName: e.target.value }))}
          />
        </GlassField>
        <GlassField label="Account number">
          <input
            className={glassInputClass}
            value={draft.accountNumber}
            onChange={(e) => setDraft((d) => ({ ...d, accountNumber: e.target.value }))}
          />
        </GlassField>
        <GlassField label="IFSC">
          <input
            className={glassInputClass}
            value={draft.ifsc}
            onChange={(e) => setDraft((d) => ({ ...d, ifsc: e.target.value }))}
          />
        </GlassField>
        <GlassField label="PF number">
          <input
            className={glassInputClass}
            value={draft.pfNumber}
            onChange={(e) => setDraft((d) => ({ ...d, pfNumber: e.target.value }))}
          />
        </GlassField>
        <GlassField label="Basic pay">
          <input
            className={glassInputClass}
            value={draft.basicPay}
            onChange={(e) => setDraft((d) => ({ ...d, basicPay: e.target.value }))}
          />
        </GlassField>
      </ErpFormGrid>
    </ErpFormSection>
  );
}
