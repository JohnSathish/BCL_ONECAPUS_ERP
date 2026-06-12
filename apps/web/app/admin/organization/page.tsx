'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DataTable } from '@/components/erp/data-table';
import {
  FormField,
  FormGrid,
  erpInputCompact,
  erpSelectClass,
} from '@/components/erp/form-primitives';
import { PAGE_GRID, FORM_COL, TABLE_COL } from '@/components/erp/page-section';
import { PageTabs } from '@/components/erp/page-tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { useRequireAuth } from '@/hooks/use-auth';
import { formatShortDate } from '@/utils/format-date';
import {
  createAcademicYear,
  createCampus,
  createDepartment,
  createInstitution,
  createSemester,
  deleteCampus,
  deleteDepartment,
  deleteInstitution,
  fetchAcademicSettings,
  fetchAcademicYears,
  fetchCampuses,
  fetchDepartments,
  fetchFacultyForHod,
  fetchInstitutions,
  fetchSetupSummary,
  updateAcademicSettings,
  updateDepartment,
} from '@/services/organization';
import {
  createShift,
  deleteShift,
  fetchShifts,
  updateShift,
  type ShiftRow,
} from '@/services/shifts';
import {
  DEPARTMENT_TYPE_OPTIONS,
  type AcademicYear,
  type Campus,
  type Department,
  type FacultyHodOption,
  type Institution,
} from '@/types/organization';

type TabId =
  | 'overview'
  | 'institutions'
  | 'campuses'
  | 'departments'
  | 'shifts'
  | 'calendar'
  | 'settings';

const institutionSchema = z.object({
  name: z.string().min(2),
  code: z.string().optional(),
});

const campusSchema = z.object({
  institutionId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().optional(),
});

const departmentSchema = z.object({
  institutionId: z.string().uuid(),
  campusId: z.string().uuid().optional().or(z.literal('')),
  name: z.string().min(2),
  code: z.string().min(2).max(12),
  departmentType: z.enum([
    'ACADEMIC',
    'ARTS',
    'SCIENCE',
    'COMMERCE',
    'PROFESSIONAL',
    'INTERDISCIPLINARY',
    'ADMINISTRATIVE',
  ]),
  hodId: z.string().uuid().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

const editDepartmentSchema = departmentSchema.omit({ institutionId: true });

function facultyDisplayLabel(faculty: FacultyHodOption | NonNullable<Department['hod']>) {
  const contact =
    faculty.portalUser?.email ?? faculty.user?.email ?? faculty.fullName ?? 'No portal email';
  return `${faculty.employeeCode} — ${contact}`;
}

const academicYearSchema = z.object({
  name: z.string().min(2),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
});

type SemesterFormValues = {
  academicYearId: string;
  name: string;
  sequence: string;
  startDate: string;
  endDate: string;
};

type InstitutionFormValues = z.infer<typeof institutionSchema>;
type CampusFormValues = z.infer<typeof campusSchema>;
type DepartmentFormValues = z.infer<typeof departmentSchema>;
type EditDepartmentFormValues = z.infer<typeof editDepartmentSchema>;
type AcademicYearFormValues = z.infer<typeof academicYearSchema>;

export default function AdminOrganizationSetupPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabId>('overview');
  const [shiftCampusId, setShiftCampusId] = useState('');
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingShift, setEditingShift] = useState<ShiftRow | null>(null);

  const [shiftForm, setShiftForm] = useState({
    name: '',
    code: '',
    startTime: '09:00',
    endTime: '17:00',
    status: 'ACTIVE',
  });

  const toTimeInput = (t: string) => (t.length >= 5 ? t.slice(0, 5) : t);

  const summary = useQuery({
    queryKey: ['org', 'setup-summary'],
    queryFn: fetchSetupSummary,
    enabled: Boolean(session),
  });

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });

  const campuses = useQuery({
    queryKey: ['org', 'campuses'],
    queryFn: () => fetchCampuses(),
    enabled: Boolean(session),
  });

  const departments = useQuery({
    queryKey: ['org', 'departments'],
    queryFn: () => fetchDepartments(),
    enabled: Boolean(session),
  });

  const shiftList = useQuery({
    queryKey: ['shifts', shiftCampusId],
    queryFn: () => fetchShifts({ campusId: shiftCampusId || undefined }),
    enabled: Boolean(session) && Boolean(shiftCampusId),
  });

  const academicYears = useQuery({
    queryKey: ['org', 'academic-years'],
    queryFn: fetchAcademicYears,
    enabled: Boolean(session),
  });

  const settings = useQuery({
    queryKey: ['org', 'academic-settings'],
    queryFn: fetchAcademicSettings,
    enabled: Boolean(session),
  });

  const canManage = useMemo(() => session?.user.roles.includes('college-admin'), [session]);

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['org', 'setup-summary'] }),
      qc.invalidateQueries({ queryKey: ['org', 'institutions'] }),
      qc.invalidateQueries({ queryKey: ['org', 'campuses'] }),
      qc.invalidateQueries({ queryKey: ['org', 'departments'] }),
      qc.invalidateQueries({ queryKey: ['org', 'academic-years'] }),
      qc.invalidateQueries({ queryKey: ['org', 'academic-settings'] }),
      qc.invalidateQueries({ queryKey: ['shifts'] }),
    ]);
  };

  const resetShiftForm = () => {
    setShiftForm({ name: '', code: '', startTime: '09:00', endTime: '17:00', status: 'ACTIVE' });
  };

  const createShiftMut = useMutation({
    mutationFn: () => {
      const inst = institutions.data?.[0];
      const campus = campuses.data?.find((c) => c.id === shiftCampusId);
      if (!inst || !campus) throw new Error('Select campus');
      return createShift({
        institutionId: inst.id,
        campusId: campus.id,
        name: shiftForm.name,
        code: shiftForm.code.toUpperCase(),
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        status: shiftForm.status,
      });
    },
    onSuccess: async () => {
      resetShiftForm();
      await invalidate();
    },
  });

  const updateShiftMut = useMutation({
    mutationFn: () => {
      if (!editingShift) throw new Error('No shift selected');
      return updateShift(editingShift.id, {
        name: shiftForm.name,
        code: shiftForm.code.toUpperCase(),
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        status: shiftForm.status,
      });
    },
    onSuccess: async () => {
      setEditingShift(null);
      resetShiftForm();
      await invalidate();
    },
  });

  const openShiftEdit = (s: ShiftRow) => {
    setEditingShift(s);
    setShiftCampusId(s.campusId);
    setShiftForm({
      name: s.name,
      code: s.code,
      startTime: toTimeInput(s.startTime),
      endTime: toTimeInput(s.endTime),
      status: s.status,
    });
  };

  const cancelShiftEdit = () => {
    setEditingShift(null);
    resetShiftForm();
  };

  const deleteShiftMut = useMutation({
    mutationFn: (id: string) => deleteShift(id),
    onSuccess: () => void invalidate(),
  });

  const institutionForm = useForm<InstitutionFormValues>({
    resolver: zodResolver(institutionSchema),
    defaultValues: { name: '', code: '' },
  });

  const campusForm = useForm<CampusFormValues>({
    resolver: zodResolver(campusSchema),
    defaultValues: { institutionId: '', name: '', code: '' },
  });

  const departmentForm = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      institutionId: '',
      campusId: '',
      name: '',
      code: '',
      departmentType: 'ACADEMIC',
      hodId: '',
      status: 'ACTIVE',
    },
  });

  const deptInstitutionId = departmentForm.watch('institutionId');

  const editDepartmentForm = useForm<EditDepartmentFormValues>({
    resolver: zodResolver(editDepartmentSchema),
    defaultValues: {
      campusId: '',
      name: '',
      code: '',
      departmentType: 'ACADEMIC',
      hodId: '',
      status: 'ACTIVE',
    },
  });

  const facultyInstitutionId =
    editingDepartment?.institutionId ?? editingDepartment?.institution?.id ?? deptInstitutionId;

  const departmentCampusOptions = useMemo((): Campus[] => {
    const active = campuses.data ?? [];
    if (!editingDepartment) {
      return deptInstitutionId
        ? active.filter((c) => c.institutionId === deptInstitutionId)
        : active;
    }
    const instId = editingDepartment.institutionId ?? editingDepartment.institution?.id ?? '';
    const filtered = instId ? active.filter((c) => c.institutionId === instId) : active;
    const options = filtered.length > 0 ? filtered : active;
    const current = editingDepartment.campus;
    if (current && !options.some((c) => c.id === current.id)) {
      return [
        {
          id: current.id,
          institutionId: instId || current.id,
          name: current.name,
          code: current.code ?? null,
        },
        ...options,
      ];
    }
    return options;
  }, [campuses.data, editingDepartment, deptInstitutionId]);

  const facultyForHod = useQuery({
    queryKey: ['org', 'faculty-hod', facultyInstitutionId, editingDepartment?.id],
    queryFn: () => fetchFacultyForHod(editingDepartment?.id),
    enabled: Boolean(session) && Boolean(facultyInstitutionId),
  });

  const academicYearForm = useForm<AcademicYearFormValues>({
    resolver: zodResolver(academicYearSchema),
    defaultValues: { name: '', startDate: '', endDate: '' },
  });

  const semesterForm = useForm<SemesterFormValues>({
    defaultValues: { academicYearId: '', name: '', sequence: '1', startDate: '', endDate: '' },
  });

  const createInstitutionMut = useMutation({
    mutationFn: (values: InstitutionFormValues) => createInstitution(values),
    onSuccess: async () => {
      institutionForm.reset({ name: '', code: '' });
      await invalidate();
    },
  });

  const createCampusMut = useMutation({
    mutationFn: (values: CampusFormValues) => createCampus(values),
    onSuccess: async () => {
      campusForm.reset({ institutionId: '', name: '', code: '' });
      await invalidate();
    },
  });

  const createDepartmentMut = useMutation({
    mutationFn: (values: DepartmentFormValues) =>
      createDepartment({
        institutionId: values.institutionId,
        campusId: values.campusId || undefined,
        name: values.name,
        code: values.code.toUpperCase(),
        departmentType: values.departmentType,
        hodId: values.hodId || undefined,
        status: values.status,
      }),
    onSuccess: async () => {
      departmentForm.reset({
        institutionId: institutions.data?.[0]?.id ?? '',
        campusId: '',
        name: '',
        code: '',
        departmentType: 'ACADEMIC',
        hodId: '',
        status: 'ACTIVE',
      });
      await invalidate();
    },
  });

  const updateDepartmentMut = useMutation({
    mutationFn: ({ id, values }: { id: string; values: EditDepartmentFormValues }) =>
      updateDepartment(id, {
        campusId: values.campusId || null,
        name: values.name,
        code: values.code.toUpperCase(),
        departmentType: values.departmentType,
        hodId: values.hodId || null,
        status: values.status,
      }),
    onSuccess: async () => {
      setEditingDepartment(null);
      await invalidate();
    },
  });

  const openDepartmentEdit = (d: Department) => {
    setEditingDepartment(d);
    editDepartmentForm.reset({
      campusId: d.campusId ?? '',
      name: d.name,
      code: d.code,
      departmentType: d.departmentType,
      hodId: d.hodId ?? '',
      status: d.status,
    });
  };

  const cancelDepartmentEdit = () => {
    setEditingDepartment(null);
    editDepartmentForm.reset();
  };

  useEffect(() => {
    if (institutions.data?.length && !departmentForm.getValues('institutionId')) {
      departmentForm.setValue('institutionId', institutions.data[0]!.id);
    }
  }, [institutions.data, departmentForm]);

  useEffect(() => {
    if (!deptInstitutionId || !campuses.data?.length) return;
    const forInst = campuses.data.filter((c) => c.institutionId === deptInstitutionId);
    const defaultCampus = forInst[0] ?? campuses.data[0];
    if (defaultCampus && !departmentForm.getValues('campusId')) {
      departmentForm.setValue('campusId', defaultCampus.id);
    }
  }, [deptInstitutionId, campuses.data, departmentForm]);

  useEffect(() => {
    if (campuses.data?.length && !shiftCampusId) {
      setShiftCampusId(campuses.data[0]!.id);
    }
  }, [campuses.data, shiftCampusId]);

  const createAcademicYearMut = useMutation({
    mutationFn: (values: AcademicYearFormValues) => createAcademicYear(values),
    onSuccess: async () => {
      academicYearForm.reset({ name: '', startDate: '', endDate: '' });
      await invalidate();
    },
  });

  const createSemesterMut = useMutation({
    mutationFn: (values: SemesterFormValues) =>
      createSemester({
        ...values,
        sequence: values.sequence ? Number(values.sequence) : undefined,
      }),
    onSuccess: async () => {
      semesterForm.reset({
        academicYearId: '',
        name: '',
        sequence: '1',
        startDate: '',
        endDate: '',
      });
      await invalidate();
    },
  });

  const deleteInstitutionMut = useMutation({
    mutationFn: (id: string) => deleteInstitution(id),
    onSuccess: invalidate,
  });

  const deleteCampusMut = useMutation({
    mutationFn: (id: string) => deleteCampus(id),
    onSuccess: invalidate,
  });

  const deleteDepartmentMut = useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: invalidate,
  });

  const updateSettingsMut = useMutation({
    mutationFn: (payload: {
      cbcsEnabled?: boolean;
      creditPolicy?: { defaultSharedPoolCapacity?: number };
    }) => updateAcademicSettings(payload),
    onSuccess: invalidate,
  });

  const sharedPoolCapacity =
    typeof settings.data?.creditPolicy?.defaultSharedPoolCapacity === 'number'
      ? settings.data.creditPolicy.defaultSharedPoolCapacity
      : 200;

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Organization setup">
      <div className="min-w-0 space-y-4">
        <PageTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'institutions', label: 'Institutions' },
            { id: 'campuses', label: 'Campuses' },
            { id: 'departments', label: 'Departments' },
            { id: 'shifts', label: 'Shifts' },
            { id: 'calendar', label: 'Academic calendar' },
            { id: 'settings', label: 'Academic settings' },
          ]}
        />

        {tab === 'overview' ? (
          <Card>
            <CardHeader>
              <CardTitle>Setup progress</CardTitle>
              <CardDescription>Quick snapshot of your tenant configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Stat label="Institutions" value={summary.data?.institutions} />
                <Stat label="Campuses" value={summary.data?.campuses} />
                <Stat label="Departments" value={summary.data?.departments} />
                <Stat label="Academic years" value={summary.data?.academicYears} />
                <Stat label="Semesters" value={summary.data?.semesters} />
                <Stat label="CBCS" value={summary.data?.cbcsEnabled ? 'Enabled' : 'Disabled'} />
              </div>
              {!canManage ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Your role does not have admin permissions to edit configuration.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {tab === 'institutions' ? (
          <div className={PAGE_GRID}>
            <CompactCard className={FORM_COL}>
              <CompactCardHeader title="Add institution" description="Profile and optional code" />
              <CompactCardBody>
                <form
                  onSubmit={institutionForm.handleSubmit((v) => createInstitutionMut.mutate(v))}
                >
                  <FormGrid>
                    <FormField label="Name" htmlFor="inst-name">
                      <Input
                        id="inst-name"
                        className={erpInputCompact}
                        {...institutionForm.register('name')}
                        disabled={!canManage}
                      />
                    </FormField>
                    <FormField label="Code" htmlFor="inst-code">
                      <Input
                        id="inst-code"
                        className={erpInputCompact}
                        {...institutionForm.register('code')}
                        disabled={!canManage}
                      />
                    </FormField>
                  </FormGrid>
                  <Button
                    type="submit"
                    size="sm"
                    className="mt-3"
                    disabled={!canManage || createInstitutionMut.isPending}
                  >
                    {createInstitutionMut.isPending ? 'Saving…' : 'Create institution'}
                  </Button>
                </form>
              </CompactCardBody>
            </CompactCard>
            <CompactCard className={TABLE_COL}>
              <CompactCardHeader title="Institutions" />
              <CompactCardBody className="p-0 sm:p-0">
                <DataTable
                  rows={institutions.data ?? []}
                  getRowKey={(i) => i.id}
                  canManage={Boolean(canManage)}
                  deletePending={deleteInstitutionMut.isPending}
                  onDelete={(i) => deleteInstitutionMut.mutate(i.id)}
                  columns={[
                    {
                      key: 'name',
                      header: 'Name',
                      cell: (i: Institution) => <span className="font-medium">{i.name}</span>,
                    },
                    { key: 'code', header: 'Code', cell: (i: Institution) => i.code ?? '—' },
                  ]}
                />
              </CompactCardBody>
            </CompactCard>
          </div>
        ) : null}

        {tab === 'campuses' ? (
          <div className={PAGE_GRID}>
            <CompactCard className={FORM_COL}>
              <CompactCardHeader title="Add campus" description="Attach to an institution" />
              <CompactCardBody>
                <form onSubmit={campusForm.handleSubmit((v) => createCampusMut.mutate(v))}>
                  <FormGrid>
                    <FormField label="Institution" span={2}>
                      <select
                        className={erpSelectClass}
                        {...campusForm.register('institutionId')}
                        disabled={!canManage}
                      >
                        <option value="">Select</option>
                        {(institutions.data ?? []).map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Name" htmlFor="camp-name">
                      <Input
                        id="camp-name"
                        className={erpInputCompact}
                        {...campusForm.register('name')}
                        disabled={!canManage}
                      />
                    </FormField>
                    <FormField label="Code" htmlFor="camp-code">
                      <Input
                        id="camp-code"
                        className={erpInputCompact}
                        {...campusForm.register('code')}
                        disabled={!canManage}
                      />
                    </FormField>
                  </FormGrid>
                  <Button
                    type="submit"
                    size="sm"
                    className="mt-3"
                    disabled={!canManage || createCampusMut.isPending}
                  >
                    {createCampusMut.isPending ? 'Saving…' : 'Create campus'}
                  </Button>
                </form>
              </CompactCardBody>
            </CompactCard>
            <CompactCard className={TABLE_COL}>
              <CompactCardHeader title="Campuses" />
              <CompactCardBody className="p-0 sm:p-0">
                <DataTable
                  rows={campuses.data ?? []}
                  getRowKey={(c) => c.id}
                  canManage={Boolean(canManage)}
                  deletePending={deleteCampusMut.isPending}
                  onDelete={(c) => deleteCampusMut.mutate(c.id)}
                  columns={[
                    {
                      key: 'name',
                      header: 'Name',
                      cell: (c: Campus) => <span className="font-medium">{c.name}</span>,
                    },
                    { key: 'code', header: 'Code', cell: (c: Campus) => c.code ?? '—' },
                  ]}
                />
              </CompactCardBody>
            </CompactCard>
          </div>
        ) : null}

        {tab === 'departments' ? (
          <div className={PAGE_GRID}>
            <div className="col-span-full rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              Manage department master data in{' '}
              <a
                href="/admin/administration/support-data"
                className="font-medium text-primary underline"
              >
                Administration → Support Data
              </a>{' '}
              (Departments). Use this page for HoD assignment and institution linkage.
            </div>
            <CompactCard className={FORM_COL}>
              <CompactCardHeader
                title={
                  editingDepartment
                    ? `Edit department — ${editingDepartment.code}`
                    : 'Add department'
                }
                description={
                  editingDepartment
                    ? 'Update name, code, campus, type, status, or HoD'
                    : 'Codes are stored uppercase; names unique per institution'
                }
              />
              <CompactCardBody>
                {editingDepartment ? (
                  <form
                    onSubmit={editDepartmentForm.handleSubmit((v) =>
                      updateDepartmentMut.mutate({ id: editingDepartment.id, values: v }),
                    )}
                  >
                    <p className="mb-3 text-xs text-muted-foreground">
                      Institution: <strong>{editingDepartment.institution?.name ?? '—'}</strong>
                    </p>
                    <FormGrid>
                      <FormField label="Campus (optional)" span={2}>
                        <select
                          className={erpSelectClass}
                          {...editDepartmentForm.register('campusId')}
                          disabled={!canManage}
                        >
                          <option value="">All campuses / none</option>
                          {departmentCampusOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Name" htmlFor="dept-edit-name">
                        <Input
                          id="dept-edit-name"
                          className={erpInputCompact}
                          {...editDepartmentForm.register('name')}
                          disabled={!canManage}
                        />
                      </FormField>
                      <FormField label="Code" htmlFor="dept-edit-code">
                        <Input
                          id="dept-edit-code"
                          className={erpInputCompact}
                          {...editDepartmentForm.register('code')}
                          disabled={!canManage}
                        />
                      </FormField>
                      <FormField label="Type">
                        <select
                          className={erpSelectClass}
                          {...editDepartmentForm.register('departmentType')}
                          disabled={!canManage}
                        >
                          {DEPARTMENT_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Status">
                        <select
                          className={erpSelectClass}
                          {...editDepartmentForm.register('status')}
                          disabled={!canManage}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      </FormField>
                      <FormField label="Head of department" span={2}>
                        <select
                          className={erpSelectClass}
                          {...editDepartmentForm.register('hodId')}
                          disabled={!canManage}
                        >
                          <option value="">Unassigned</option>
                          {(facultyForHod.data ?? []).map((f) => (
                            <option key={f.id} value={f.id}>
                              {facultyDisplayLabel(f)}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    </FormGrid>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!canManage || updateDepartmentMut.isPending}
                      >
                        {updateDepartmentMut.isPending ? 'Saving…' : 'Save changes'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={updateDepartmentMut.isPending}
                        onClick={cancelDepartmentEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form
                    onSubmit={departmentForm.handleSubmit((v) => createDepartmentMut.mutate(v))}
                  >
                    <FormGrid>
                      <FormField label="Institution" span={2}>
                        <select
                          className={erpSelectClass}
                          {...departmentForm.register('institutionId')}
                          disabled={!canManage}
                        >
                          <option value="">Select institution</option>
                          {(institutions.data ?? []).map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Campus (optional)" span={2}>
                        <select
                          className={erpSelectClass}
                          {...departmentForm.register('campusId')}
                          disabled={!canManage}
                        >
                          <option value="">All campuses / none</option>
                          {departmentCampusOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Name" htmlFor="dept-name">
                        <Input
                          id="dept-name"
                          className={erpInputCompact}
                          {...departmentForm.register('name')}
                          disabled={!canManage}
                        />
                      </FormField>
                      <FormField label="Code" htmlFor="dept-code">
                        <Input
                          id="dept-code"
                          className={erpInputCompact}
                          placeholder="ECO"
                          {...departmentForm.register('code')}
                          disabled={!canManage}
                        />
                      </FormField>
                      <FormField label="Type">
                        <select
                          className={erpSelectClass}
                          {...departmentForm.register('departmentType')}
                          disabled={!canManage}
                        >
                          {DEPARTMENT_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Status">
                        <select
                          className={erpSelectClass}
                          {...departmentForm.register('status')}
                          disabled={!canManage}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      </FormField>
                      <FormField label="Head of department" span={2}>
                        <select
                          className={erpSelectClass}
                          {...departmentForm.register('hodId')}
                          disabled={!canManage}
                        >
                          <option value="">Unassigned</option>
                          {(facultyForHod.data ?? []).map((f) => (
                            <option key={f.id} value={f.id}>
                              {facultyDisplayLabel(f)}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    </FormGrid>
                    <Button
                      type="submit"
                      size="sm"
                      className="mt-3"
                      disabled={!canManage || createDepartmentMut.isPending}
                    >
                      {createDepartmentMut.isPending ? 'Saving…' : 'Create department'}
                    </Button>
                  </form>
                )}
              </CompactCardBody>
            </CompactCard>
            <CompactCard className={TABLE_COL}>
              <CompactCardHeader
                title="Departments"
                description={`${departments.data?.length ?? 0} active`}
              />
              <CompactCardBody className="p-0 sm:p-0">
                <DataTable
                  rows={departments.data ?? []}
                  getRowKey={(d) => d.id}
                  canManage={Boolean(canManage)}
                  deletePending={deleteDepartmentMut.isPending}
                  onEdit={openDepartmentEdit}
                  onDelete={(d) => deleteDepartmentMut.mutate(d.id)}
                  columns={[
                    {
                      key: 'code',
                      header: 'Code',
                      cell: (d: Department) => (
                        <span className="font-mono font-medium">{d.code}</span>
                      ),
                    },
                    { key: 'name', header: 'Name', cell: (d: Department) => d.name },
                    { key: 'type', header: 'Type', cell: (d: Department) => d.departmentType },
                    {
                      key: 'campus',
                      header: 'Campus',
                      cell: (d: Department) => d.campus?.name ?? '—',
                    },
                    {
                      key: 'hod',
                      header: 'HoD',
                      cell: (d: Department) => (d.hod ? facultyDisplayLabel(d.hod) : '—'),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      cell: (d: Department) => (
                        <span
                          className={
                            d.status === 'ACTIVE' ? 'text-success' : 'text-muted-foreground'
                          }
                        >
                          {d.status}
                        </span>
                      ),
                    },
                  ]}
                />
              </CompactCardBody>
            </CompactCard>
          </div>
        ) : null}

        {tab === 'shifts' ? (
          <div className={PAGE_GRID}>
            <div className="col-span-full rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              Shift master records are managed in{' '}
              <a
                href="/admin/administration/support-data"
                className="font-medium text-primary underline"
              >
                Support Data → Shifts
              </a>
              . Use this page for shift-admin assignments and operational scope.
            </div>
            <CompactCard className={FORM_COL}>
              <CompactCardHeader
                title={editingShift ? `Edit shift — ${editingShift.code}` : 'Add shift'}
                description={
                  editingShift
                    ? 'Update name, code, timings, or status'
                    : 'Campus-specific operational shift'
                }
              />
              <CompactCardBody className="space-y-3">
                {editingShift ? (
                  <p className="text-xs text-muted-foreground">
                    Campus: <strong>{editingShift.campus?.name ?? '—'}</strong>
                  </p>
                ) : (
                  <FormField label="Campus">
                    <select
                      className={erpSelectClass}
                      value={shiftCampusId}
                      onChange={(e) => setShiftCampusId(e.target.value)}
                      disabled={!canManage}
                    >
                      {(campuses.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                )}
                <FormGrid>
                  <FormField label="Name">
                    <Input
                      className={erpInputCompact}
                      value={shiftForm.name}
                      onChange={(e) => setShiftForm((f) => ({ ...f, name: e.target.value }))}
                      disabled={!canManage}
                    />
                  </FormField>
                  <FormField label="Code">
                    <Input
                      className={erpInputCompact}
                      value={shiftForm.code}
                      onChange={(e) => setShiftForm((f) => ({ ...f, code: e.target.value }))}
                      disabled={!canManage}
                    />
                  </FormField>
                  <FormField label="Start">
                    <Input
                      type="time"
                      className={erpInputCompact}
                      value={shiftForm.startTime}
                      onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))}
                      disabled={!canManage}
                    />
                  </FormField>
                  <FormField label="End">
                    <Input
                      type="time"
                      className={erpInputCompact}
                      value={shiftForm.endTime}
                      onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))}
                      disabled={!canManage}
                    />
                  </FormField>
                  {editingShift ? (
                    <FormField label="Status">
                      <select
                        className={erpSelectClass}
                        value={shiftForm.status}
                        onChange={(e) => setShiftForm((f) => ({ ...f, status: e.target.value }))}
                        disabled={!canManage}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </FormField>
                  ) : null}
                </FormGrid>
                {editingShift ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={
                        !canManage || updateShiftMut.isPending || !shiftForm.name || !shiftForm.code
                      }
                      onClick={() => updateShiftMut.mutate()}
                    >
                      {updateShiftMut.isPending ? 'Saving…' : 'Save changes'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updateShiftMut.isPending}
                      onClick={cancelShiftEdit}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    disabled={
                      !canManage || createShiftMut.isPending || !shiftForm.name || !shiftForm.code
                    }
                    onClick={() => createShiftMut.mutate()}
                  >
                    {createShiftMut.isPending ? 'Saving…' : 'Create shift'}
                  </Button>
                )}
              </CompactCardBody>
            </CompactCard>
            <CompactCard className={TABLE_COL}>
              <CompactCardHeader title="Shifts" />
              <CompactCardBody className="p-0 sm:p-0">
                <DataTable
                  rows={shiftList.data ?? []}
                  getRowKey={(s: ShiftRow) => s.id}
                  canManage={Boolean(canManage)}
                  deletePending={deleteShiftMut.isPending}
                  onEdit={openShiftEdit}
                  onDelete={(s) => deleteShiftMut.mutate(s.id)}
                  columns={[
                    {
                      key: 'code',
                      header: 'Code',
                      cell: (s: ShiftRow) => (
                        <span className="font-mono font-medium">{s.code}</span>
                      ),
                    },
                    { key: 'name', header: 'Name', cell: (s: ShiftRow) => s.name },
                    {
                      key: 'time',
                      header: 'Timing',
                      cell: (s: ShiftRow) => `${s.startTime} – ${s.endTime}`,
                    },
                    { key: 'status', header: 'Status', cell: (s: ShiftRow) => s.status },
                  ]}
                />
              </CompactCardBody>
            </CompactCard>
          </div>
        ) : null}

        {tab === 'calendar' ? (
          <div className="min-w-0 space-y-4">
            <div className={PAGE_GRID}>
              <CompactCard className="col-span-12 min-w-0 xl:col-span-6">
                <CompactCardHeader title="Add academic year" description="Dates as dd/mm/yyyy" />
                <CompactCardBody>
                  <form
                    onSubmit={academicYearForm.handleSubmit((v) => createAcademicYearMut.mutate(v))}
                  >
                    <FormGrid>
                      <FormField label="Name" htmlFor="ay-name" span={2}>
                        <Input
                          id="ay-name"
                          className={erpInputCompact}
                          placeholder="2026-27"
                          {...academicYearForm.register('name')}
                          disabled={!canManage}
                        />
                      </FormField>
                      <FormField label="Start date" htmlFor="ay-start">
                        <Controller
                          name="startDate"
                          control={academicYearForm.control}
                          render={({ field }) => (
                            <DateInput
                              id="ay-start"
                              className={erpInputCompact}
                              disabled={!canManage}
                              value={field.value}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </FormField>
                      <FormField label="End date" htmlFor="ay-end">
                        <Controller
                          name="endDate"
                          control={academicYearForm.control}
                          render={({ field }) => (
                            <DateInput
                              id="ay-end"
                              className={erpInputCompact}
                              disabled={!canManage}
                              value={field.value}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </FormField>
                    </FormGrid>
                    <Button
                      type="submit"
                      size="sm"
                      className="mt-3"
                      disabled={!canManage || createAcademicYearMut.isPending}
                    >
                      {createAcademicYearMut.isPending ? 'Saving…' : 'Create academic year'}
                    </Button>
                  </form>
                </CompactCardBody>
              </CompactCard>

              <CompactCard className="col-span-12 min-w-0 xl:col-span-6">
                <CompactCardHeader title="Add semester" description="Belongs to an academic year" />
                <CompactCardBody>
                  <form onSubmit={semesterForm.handleSubmit((v) => createSemesterMut.mutate(v))}>
                    <FormGrid>
                      <FormField label="Academic year" span={2}>
                        <select
                          className={erpSelectClass}
                          {...semesterForm.register('academicYearId')}
                          disabled={!canManage}
                        >
                          <option value="">Select</option>
                          {(academicYears.data ?? []).map((ay) => (
                            <option key={ay.id} value={ay.id}>
                              {ay.name}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Name" htmlFor="sem-name">
                        <Input
                          id="sem-name"
                          className={erpInputCompact}
                          placeholder="Semester 1"
                          {...semesterForm.register('name')}
                          disabled={!canManage}
                        />
                      </FormField>
                      <FormField label="Sequence" htmlFor="sem-seq">
                        <Input
                          id="sem-seq"
                          className={erpInputCompact}
                          type="number"
                          {...semesterForm.register('sequence')}
                          disabled={!canManage}
                        />
                      </FormField>
                      <FormField label="Start (optional)" htmlFor="sem-start">
                        <Controller
                          name="startDate"
                          control={semesterForm.control}
                          render={({ field }) => (
                            <DateInput
                              id="sem-start"
                              className={erpInputCompact}
                              disabled={!canManage}
                              value={field.value}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </FormField>
                      <FormField label="End (optional)" htmlFor="sem-end">
                        <Controller
                          name="endDate"
                          control={semesterForm.control}
                          render={({ field }) => (
                            <DateInput
                              id="sem-end"
                              className={erpInputCompact}
                              disabled={!canManage}
                              value={field.value}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </FormField>
                    </FormGrid>
                    <Button
                      type="submit"
                      size="sm"
                      className="mt-3"
                      disabled={!canManage || createSemesterMut.isPending}
                    >
                      {createSemesterMut.isPending ? 'Saving…' : 'Create semester'}
                    </Button>
                  </form>
                </CompactCardBody>
              </CompactCard>
            </div>

            <CompactCard className="col-span-12 min-w-0 max-w-full">
              <CompactCardHeader title="Academic years & semesters" />
              <CompactCardBody className="p-0 sm:p-0">
                <DataTable
                  rows={academicYears.data ?? []}
                  getRowKey={(ay) => ay.id}
                  emptyMessage="No academic years yet."
                  columns={[
                    {
                      key: 'name',
                      header: 'Year',
                      className: 'w-[18%]',
                      cell: (ay: AcademicYear) => <span className="font-medium">{ay.name}</span>,
                    },
                    {
                      key: 'dates',
                      header: 'Dates',
                      className: 'w-[28%]',
                      cell: (ay: AcademicYear) => (
                        <span className="text-xs text-muted-foreground">
                          {formatShortDate(ay.startDate)} → {formatShortDate(ay.endDate)}
                        </span>
                      ),
                    },
                    {
                      key: 'semesters',
                      header: 'Semesters',
                      className: 'w-[46%]',
                      cell: (ay: AcademicYear) => {
                        const sems = ay.semesters ?? [];
                        if (sems.length === 0) {
                          return <span className="text-xs text-muted-foreground">None</span>;
                        }
                        const summary = sems
                          .map(
                            (s) =>
                              `${s.sequence}. ${s.name} (${formatShortDate(s.startDate)}–${formatShortDate(s.endDate)})`,
                          )
                          .join(', ');
                        return (
                          <span className="block truncate text-xs" title={summary}>
                            {summary}
                          </span>
                        );
                      },
                    },
                    {
                      key: 'count',
                      header: '#',
                      className: 'w-[8%] text-center',
                      cell: (ay: AcademicYear) => ay.semesters?.length ?? 0,
                    },
                  ]}
                />
              </CompactCardBody>
            </CompactCard>
          </div>
        ) : null}

        {tab === 'settings' ? (
          <Card>
            <CardHeader>
              <CardTitle>Academic settings</CardTitle>
              <CardDescription>Tenant-level CBCS, NEP, and shared pool defaults</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-medium">CBCS</p>
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Enable CBCS</p>
                      <p className="text-xs text-muted-foreground">
                        Choice-based credit system across programs
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={Boolean(settings.data?.cbcsEnabled)}
                      disabled={!canManage || updateSettingsMut.isPending}
                      onChange={(e) => updateSettingsMut.mutate({ cbcsEnabled: e.target.checked })}
                    />
                  </div>

                  <p className="text-sm font-medium">Shared pool capacity</p>
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <p className="text-sm font-medium">Default shared pool section capacity</p>
                    <p className="text-xs text-muted-foreground">
                      Applies to new AEC, MDC, SEC, VAC, and VTC pool sections. Existing custom
                      capacities are not overwritten.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        className="w-28"
                        defaultValue={sharedPoolCapacity}
                        key={sharedPoolCapacity}
                        disabled={!canManage || updateSettingsMut.isPending}
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isFinite(next) || next < 1 || next === sharedPoolCapacity) {
                            return;
                          }
                          updateSettingsMut.mutate({
                            creditPolicy: { defaultSharedPoolCapacity: Math.floor(next) },
                          });
                        }}
                      />
                      <span className="text-sm text-muted-foreground">seats</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Credit policy</p>
                  <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(settings.data?.creditPolicy ?? {}, null, 2)}
                    </pre>
                  </div>

                  <p className="text-sm font-medium">NEP profile</p>
                  <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(settings.data?.nepProfile ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: unknown }) {
  const display =
    typeof value === 'string' || typeof value === 'number'
      ? value
      : typeof value === 'boolean'
        ? value
          ? 'Yes'
          : 'No'
        : value == null
          ? '—'
          : JSON.stringify(value);

  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{display}</p>
    </div>
  );
}
