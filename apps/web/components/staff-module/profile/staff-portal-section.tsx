'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';

import { PORTAL_ROLE_OPTIONS } from '@/components/staff-module/add-staff/constants';
import {
  SectionCard,
  Field,
  FieldGrid,
  inputClass,
} from '@/components/student-profile/student-profile-shell';
import { Button } from '@/components/ui/button';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { deactivateStaffPortal, provisionStaffPortal } from '@/services/staff';
import type { StaffProfile } from '@/types/staff';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  profile: StaffProfile;
  onRefresh: () => void;
};

function defaultRoleSlugs(profile: StaffProfile): string[] {
  if (profile.staffType === 'TEACHING') return ['faculty'];
  return ['staff'];
}

export function StaffPortalSection({ profile, onRefresh }: Props) {
  const { canPortal } = useStaffPermissions();
  const hasPortal =
    Boolean(profile.portalUser?.id) || profile.portalActive || profile.portalPending;

  const [email, setEmail] = useState(profile.email ?? profile.portalUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [roleSlugs, setRoleSlugs] = useState<string[]>(() => defaultRoleSlugs(profile));
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const provisionMut = useMutation({
    mutationFn: () =>
      provisionStaffPortal(profile.id, {
        email: email.trim(),
        roleSlugs,
        password: password.trim() || undefined,
      }),
    onSuccess: (data: { generatedPassword?: string | null }) => {
      setError(null);
      setGeneratedPassword(data?.generatedPassword ?? null);
      setPassword('');
      onRefresh();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const deactivateMut = useMutation({
    mutationFn: () => deactivateStaffPortal(profile.id),
    onSuccess: () => {
      setError(null);
      setGeneratedPassword(null);
      onRefresh();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const portalStatus = profile.portalActive ? 'Active' : profile.portalPending ? 'Pending' : 'None';

  const toggleRole = (slug: string, checked: boolean) => {
    setRoleSlugs((prev) =>
      checked ? Array.from(new Set([...prev, slug])) : prev.filter((s) => s !== slug),
    );
  };

  return (
    <div className="space-y-3">
      <SectionCard
        title="Portal user"
        description="ERP login linked to this staff profile (same flow as Add Staff → Portal)."
      >
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{portalStatus}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Portal email</dt>
            <dd className="font-medium break-all">
              {profile.portalUser?.email ?? profile.email ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Username</dt>
            <dd className="font-medium">{profile.portalUser?.username ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Admin list</dt>
            <dd>
              <Link href="/admin/administration/portal-users" className="text-primary underline">
                Open Portal Users
              </Link>
            </dd>
          </div>
        </dl>
      </SectionCard>

      {!hasPortal ? (
        <SectionCard
          title="Create portal user"
          description="Creates a login and links it to this staff record so they appear in Portal Users."
        >
          {!canPortal ? (
            <p className="text-xs text-muted-foreground">
              You need the <code className="text-[10px]">staff:portal</code> permission to create
              portal accounts.
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                if (!email.trim()) {
                  setError('Portal email is required');
                  return;
                }
                if (roleSlugs.length === 0) {
                  setError('Select at least one role');
                  return;
                }
                provisionMut.mutate();
              }}
            >
              <FieldGrid>
                <Field label="Portal email">
                  <input
                    type="email"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@college.edu"
                    required
                  />
                </Field>
                <Field label="Temporary password (optional)">
                  <input
                    type="password"
                    className={inputClass}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars — leave blank to auto-generate"
                    minLength={8}
                    autoComplete="new-password"
                  />
                </Field>
              </FieldGrid>

              <div>
                <p className="mb-1.5 text-[11px] font-medium">Roles</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {PORTAL_ROLE_OPTIONS.map((role) => (
                    <label key={role.slug} className="flex items-center gap-1.5 text-[11px]">
                      <input
                        type="checkbox"
                        checked={roleSlugs.includes(role.slug)}
                        onChange={(e) => toggleRole(role.slug, e.target.checked)}
                      />
                      {role.label}
                    </label>
                  ))}
                </div>
              </div>

              {error ? <p className="text-xs text-destructive">{error}</p> : null}

              {generatedPassword ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Account created — temporary password (copy now):
                  </p>
                  <code className="mt-1 block select-all font-mono text-sm">
                    {generatedPassword}
                  </code>
                </div>
              ) : null}

              <Button type="submit" size="sm" disabled={provisionMut.isPending}>
                {provisionMut.isPending ? 'Creating…' : 'Create portal user'}
              </Button>
            </form>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title="Manage access"
          description="Deactivate portal login for this staff member."
        >
          {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
          {canPortal ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={deactivateMut.isPending}
              onClick={() => {
                if (window.confirm('Deactivate portal login for this staff member?')) {
                  deactivateMut.mutate();
                }
              }}
            >
              {deactivateMut.isPending ? 'Deactivating…' : 'Deactivate portal user'}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Portal account is linked. Use Administration → Portal Users to reset password or edit
              roles.
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            To change roles or reset password, open{' '}
            <Link href="/admin/administration/portal-users" className="text-primary underline">
              Portal Users
            </Link>
            .
          </p>
        </SectionCard>
      )}
    </div>
  );
}
