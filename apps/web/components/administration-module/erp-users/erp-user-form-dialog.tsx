'use client';

import { Eye, EyeOff, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ErpUserDetail, ErpUserFormPayload, ErpUsersOptions } from '@/types/erp-users';
import { cn } from '@/utils/cn';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  user: ErpUserDetail | null;
  options: ErpUsersOptions | undefined;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: ErpUserFormPayload) => void;
};

const EMPTY: ErpUserFormPayload = {
  fullName: '',
  email: '',
  mobile: '',
  employeeId: '',
  departmentId: '',
  designation: '',
  username: '',
  password: '',
  confirmPassword: '',
  accountStatus: 'active',
  roleSlug: '',
  extraPermissions: [],
  erpAccessEnabled: true,
  forcePasswordChange: true,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60';

export function ErpUserFormDialog({
  open,
  mode,
  user,
  options,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<ErpUserFormPayload>(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setPermissionSearch('');
    setShowPassword(false);
    if (mode === 'edit' && user) {
      setForm({
        fullName: user.name,
        email: user.email,
        mobile: user.mobile ?? '',
        employeeId: user.employeeId ?? '',
        departmentId: user.department?.id ?? '',
        designation: user.designation ?? '',
        username: user.username ?? '',
        roleSlug: user.role?.slug ?? '',
        extraPermissions: user.extraPermissions ?? [],
        erpAccessEnabled: user.erpAccessEnabled,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, mode, user]);

  const set = <K extends keyof ErpUserFormPayload>(key: K, value: ErpUserFormPayload[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const roles = options?.roles ?? [];
  const selectedRole = roles.find((r) => r.slug === form.roleSlug);

  const permissionGroups = useMemo(() => {
    const term = permissionSearch.trim().toLowerCase();
    const groups = new Map<string, ErpUsersOptions['permissions']>();
    for (const permission of options?.permissions ?? []) {
      const text = `${permission.slug} ${permission.description ?? ''}`.toLowerCase();
      if (term && !text.includes(term)) continue;
      const list = groups.get(permission.resource) ?? [];
      list.push(permission);
      groups.set(permission.resource, list);
    }
    return [...groups.entries()];
  }, [options?.permissions, permissionSearch]);

  const togglePermission = (slug: string) =>
    set(
      'extraPermissions',
      form.extraPermissions.includes(slug)
        ? form.extraPermissions.filter((s) => s !== slug)
        : [...form.extraPermissions, slug],
    );

  const submit = () => {
    setLocalError(null);
    if (!form.fullName.trim() || !form.email.trim() || !form.username.trim()) {
      setLocalError('Full name, official email and username are required.');
      return;
    }
    if (!form.roleSlug) {
      setLocalError('Assign a role.');
      return;
    }
    if (mode === 'create') {
      if (!form.password) {
        setLocalError('Enter a password.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setLocalError('Password and Confirm Password do not match.');
        return;
      }
      onSubmit(form);
      return;
    }
    onSubmit({
      fullName: form.fullName,
      email: form.email,
      mobile: form.mobile,
      employeeId: form.employeeId,
      departmentId: form.departmentId,
      designation: form.designation,
      username: form.username,
      roleSlug: form.roleSlug,
      extraPermissions: form.extraPermissions,
      erpAccessEnabled: form.erpAccessEnabled,
    });
  };

  const shownError = localError ?? error;

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create ERP User' : `Edit ${user?.name ?? 'ERP user'}`}
          </DialogTitle>
          <DialogDescription>
            ERP users sign in to the main ERP dashboard. This is a separate account from any
            student, staff or parent login, so use the person&apos;s official email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Section title="Personal Information">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full Name" htmlFor="erp-fullName" required>
                <Input
                  id="erp-fullName"
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                />
              </Field>
              <Field label="Official Email Address" htmlFor="erp-email" required>
                <Input
                  id="erp-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </Field>
              <Field label="Mobile Number" htmlFor="erp-mobile">
                <Input
                  id="erp-mobile"
                  inputMode="tel"
                  value={form.mobile ?? ''}
                  onChange={(e) => set('mobile', e.target.value)}
                />
              </Field>
              <Field label="Employee ID" htmlFor="erp-employeeId" hint="Optional">
                <Input
                  id="erp-employeeId"
                  value={form.employeeId ?? ''}
                  onChange={(e) => set('employeeId', e.target.value)}
                />
              </Field>
              <Field label="Department" htmlFor="erp-department">
                <select
                  id="erp-department"
                  className={selectClass}
                  value={form.departmentId ?? ''}
                  onChange={(e) => set('departmentId', e.target.value)}
                >
                  <option value="">No department</option>
                  {(options?.departments ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Designation" htmlFor="erp-designation">
                <Input
                  id="erp-designation"
                  list="erp-designation-options"
                  value={form.designation ?? ''}
                  onChange={(e) => set('designation', e.target.value)}
                />
                <datalist id="erp-designation-options">
                  {(options?.designations ?? []).map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </Field>
            </div>
          </Section>

          <Section title="Login Credentials">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Username"
                htmlFor="erp-username"
                required
                hint="3–40 characters: letters, numbers, dot, dash or underscore."
              >
                <Input
                  id="erp-username"
                  autoComplete="off"
                  value={form.username}
                  onChange={(e) => set('username', e.target.value)}
                />
              </Field>
              {mode === 'create' ? (
                <Field label="Account Status" htmlFor="erp-status">
                  <select
                    id="erp-status"
                    className={selectClass}
                    value={form.accountStatus}
                    onChange={(e) => set('accountStatus', e.target.value as 'active' | 'inactive')}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
              ) : (
                <p className="self-end text-xs text-slate-500">
                  Status and password are changed from the row actions (Activate, Deactivate, Lock,
                  Reset Password).
                </p>
              )}
              {mode === 'create' ? (
                <>
                  <Field
                    label="Password"
                    htmlFor="erp-password"
                    required
                    hint="At least 8 characters with upper and lower case, a number and a symbol."
                  >
                    <div className="relative">
                      <Input
                        id="erp-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={form.password ?? ''}
                        onChange={(e) => set('password', e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm Password" htmlFor="erp-confirm" required>
                    <Input
                      id="erp-confirm"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={form.confirmPassword ?? ''}
                      onChange={(e) => set('confirmPassword', e.target.value)}
                    />
                  </Field>
                </>
              ) : null}
            </div>
          </Section>

          <Section title="Access Configuration">
            <Field
              label="Assign Role"
              htmlFor="erp-role"
              required
              hint={
                selectedRole
                  ? `${selectedRole.permissionCount} permissions come with this role. Menus follow these permissions.`
                  : 'Roles and their permissions are managed in Roles & Permissions.'
              }
            >
              <select
                id="erp-role"
                className={selectClass}
                value={form.roleSlug}
                onChange={(e) => set('roleSlug', e.target.value)}
              >
                <option value="">Select a role…</option>
                {roles.map((r) => (
                  <option key={r.slug} value={r.slug} disabled={!r.assignable || !r.opensErp}>
                    {r.name}
                    {!r.opensErp ? ' — no ERP permissions yet' : ''}
                    {!r.assignable ? ' — Super Admin only' : ''}
                  </option>
                ))}
              </select>
            </Field>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Additional Permissions</Label>
                <span className="text-xs text-slate-500">
                  {form.extraPermissions.length} added on top of the role
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search permissions…"
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                />
              </div>
              <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {permissionGroups.length === 0 ? (
                  <p className="text-xs text-slate-500">No permissions match.</p>
                ) : (
                  permissionGroups.map(([resource, list]) => (
                    <div key={resource}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {resource}
                      </p>
                      <div className="grid gap-1 sm:grid-cols-2">
                        {list.map((p) => (
                          <label
                            key={p.id}
                            className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50"
                            title={p.description ?? p.slug}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={form.extraPermissions.includes(p.slug)}
                              onChange={() => togglePermission(p.slug)}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-mono text-xs">{p.slug}</span>
                              {p.description ? (
                                <span className="block truncate text-xs text-slate-500">
                                  {p.description}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <span>
                  <span className="block text-sm font-medium">Allow ERP Dashboard Access</span>
                  <span className="block text-xs text-slate-500">
                    When off, this account cannot sign in to the ERP.
                  </span>
                </span>
                <Switch
                  checked={form.erpAccessEnabled}
                  onCheckedChange={(v) => set('erpAccessEnabled', v)}
                />
              </label>
              {mode === 'create' ? (
                <label className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
                  <span>
                    <span className="block text-sm font-medium">
                      Force Password Change on First Login
                    </span>
                    <span className="block text-xs text-slate-500">
                      The user must set their own password before using the ERP.
                    </span>
                  </span>
                  <Switch
                    checked={Boolean(form.forcePasswordChange)}
                    onCheckedChange={(v) => set('forcePasswordChange', v)}
                  />
                </label>
              ) : null}
            </div>
          </Section>
        </div>

        {shownError ? (
          <p className={cn('mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700')}>
            {shownError}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create ERP User' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
