'use client';

import { ErpFormGrid, ErpFormSection } from '@/components/erp/erp-workspace-shell';
import { PORTAL_ROLE_OPTIONS } from '@/components/staff-module/add-staff/constants';
import {
  GlassField,
  glassInputClass,
} from '@/components/students-module/add-student/ui/glass-field';
import type { AddStaffDraft } from '@/components/staff-module/add-staff/types/draft';

type Props = {
  draft: AddStaffDraft;
  setDraft: React.Dispatch<React.SetStateAction<AddStaffDraft>>;
  errors: Record<string, string>;
};

export function StepPortal({ draft, setDraft, errors }: Props) {
  return (
    <ErpFormSection
      title="Portal access"
      description="Provision a portal login for this staff member"
    >
      <label className="mb-3 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={draft.createPortalAccount}
          onChange={(e) => setDraft((d) => ({ ...d, createPortalAccount: e.target.checked }))}
        />
        Create portal account on submit
      </label>

      {draft.createPortalAccount ? (
        <ErpFormGrid>
          <GlassField label="Portal email" error={errors.portalEmail}>
            <input
              type="email"
              className={glassInputClass}
              placeholder={draft.email || 'staff@college.edu'}
              value={draft.portalEmail}
              onChange={(e) => setDraft((d) => ({ ...d, portalEmail: e.target.value }))}
            />
          </GlassField>
          <GlassField label="Temporary password" error={errors.portalPassword}>
            <input
              type="password"
              className={glassInputClass}
              placeholder="Min 8 characters (optional — auto-generate)"
              value={draft.portalPassword}
              onChange={(e) => setDraft((d) => ({ ...d, portalPassword: e.target.value }))}
            />
          </GlassField>
          <GlassField label="Roles" className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              {PORTAL_ROLE_OPTIONS.map((role) => {
                const checked = draft.portalRoleSlugs.includes(role.slug);
                return (
                  <label key={role.slug} className="flex items-center gap-1.5 text-[11px]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setDraft((d) => ({
                          ...d,
                          portalRoleSlugs: e.target.checked
                            ? [...d.portalRoleSlugs, role.slug]
                            : d.portalRoleSlugs.filter((s) => s !== role.slug),
                        }));
                      }}
                    />
                    {role.label}
                  </label>
                );
              })}
            </div>
          </GlassField>
        </ErpFormGrid>
      ) : (
        <p className="text-xs text-muted-foreground">
          Portal access can be provisioned later from the staff profile settings tab.
        </p>
      )}
    </ErpFormSection>
  );
}
