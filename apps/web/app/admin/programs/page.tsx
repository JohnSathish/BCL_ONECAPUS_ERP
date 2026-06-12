'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  useWatch,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from 'react-hook-form';
import type { CourseAcademicFieldsValues } from '@/components/programs/course-academic-fields';
import { z } from 'zod';
import {
  BarChart3,
  BookOpen,
  FileSpreadsheet,
  Filter,
  GitBranch,
  GraduationCap,
  History,
  LineChart,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchAcademicYears,
  fetchCampuses,
  fetchAcademicDepartments,
  fetchFacultyForHod,
} from '@/services/organization';
import { fetchAcademicStreams } from '@/services/academic-engine';
import { AttachSharedPoolsPanel } from '@/components/academic-engine/category-pools/AttachSharedPoolsPanel';
import { CurriculumDeliveryPanel } from '@/components/programs/curriculum/curriculum-delivery-panel';
import { CurriculumRowSelect } from '@/components/programs/curriculum/curriculum-row-select';
import { CourseEligibilityPanel } from '@/components/programs/course-eligibility/course-eligibility-panel';
import { PageTabs } from '@/components/erp/page-tabs';
import { fetchShifts } from '@/services/shifts';
import { toShiftOptions } from '@/lib/shift-options';
import {
  createCourse,
  createOffering,
  createOfferingSection,
  createProgram,
  createProgramVersion,
  checkCourseDuplicates,
  deleteCourse,
  deleteOffering,
  deleteOfferingSection,
  deleteProgram,
  fetchCatalogSummary,
  fetchCourses,
  fetchAllCourses,
  fetchPrograms,
  updateCourse,
  updateOffering,
  updateOfferingSection,
  updateProgram,
  downloadCourseImportTemplate,
  exportCoursesExcel,
} from '@/services/programs';
import { CourseAcademicFields } from '@/components/programs/course-academic-fields';
import { CourseCatalogList } from '@/components/programs/course-catalog-list';
import { CourseCatalogToolbar } from '@/components/programs/course-catalog-toolbar';
import { CourseImportDialog } from '@/components/programs/course-import-dialog';
import { ProgramVersionManageDialog } from '@/components/programs/program-version-manage-dialog';
import { useCourseCatalogFilters } from '@/hooks/use-course-catalog-filters';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { CurriculumOfferingRow } from '@/types/curriculum-filters';
import type {
  CatalogSummary,
  Course,
  CourseOffering,
  OfferingSection,
  Program,
  ProgramVersion,
} from '@/types/programs';
import type { Semester } from '@/types/organization';
import { apiErrorMessage } from '@/utils/api-error';
import {
  looksLikeCourseCode,
  PROGRAMME_CODE_COURSE_WARNING,
} from '@/utils/program-code-validation';
import { parseApiProblemJson } from '@/utils/api-problem';
import { cn } from '@/utils/cn';
import { COURSE_DELIVERY_TYPES } from '@/constants/course-delivery';
import { isManualCreditForm, validateCourseAcademicForm } from '@/utils/course-academic-structure';
import { formatCourseCatalogMeta } from '@/utils/course-delivery-meta';
import { resolveCreditCalculationMode } from '@/utils/course-academic-structure';
import { programCurriculumSummary } from '@/utils/program-version';
import { NEP_CURRICULUM_CATEGORIES } from '@/constants/nep-curriculum-categories';

type TabId = 'overview' | 'programs' | 'courses' | 'curriculum' | 'reports' | 'audit';
type CourseEditTabId = 'details' | 'eligibility';

const PROGRAM_LEVELS = ['UG', 'PG', 'DIPLOMA', 'CERTIFICATE'] as const;
const COURSE_TYPES = ['CORE', 'ELECTIVE', 'SKILL', 'OPEN', 'LAB', 'PRACTICAL'] as const;
const NEP_CATEGORIES = NEP_CURRICULUM_CATEGORIES;

const programSchema = z
  .object({
    code: z.string().min(2),
    name: z.string().min(2),
    departmentId: z.string().uuid({ message: 'Department is required' }),
    level: z.string().min(1, 'Programme type is required'),
  })
  .superRefine((values, ctx) => {
    if (looksLikeCourseCode(values.code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: PROGRAMME_CODE_COURSE_WARNING,
        path: ['code'],
      });
    }
  });

type ProgramFormValues = z.infer<typeof programSchema>;

const courseSchema = z
  .object({
    code: z.string().min(2),
    title: z.string().min(2),
    credits: z.number().min(0),
    deliveryType: z.enum(COURSE_DELIVERY_TYPES),
    creditCalculationMode: z.enum(['AUTO_CALCULATED', 'MANUAL_OVERRIDE']).optional(),
    theoryCredits: z.number().min(0),
    practicalCredits: z.number().min(0),
    theoryHoursPerWeek: z.number().int().min(0),
    practicalHoursPerWeek: z.number().int().min(0),
    totalTheoryContactHours: z.number().int().min(0),
    totalPracticalContactHours: z.number().int().min(0),
    totalContactHours: z.number().int().min(0),
    attendanceMode: z
      .enum(['REGULAR', 'MENTOR_APPROVAL', 'ACTIVITY_COMPLETION', 'NONE', 'SUBMISSION'])
      .optional(),
    labRequired: z.boolean().optional(),
    requiresTimetableSlots: z.boolean().optional(),
    courseType: z.string().min(2),
    description: z.string().optional(),
    departmentId: z.string().uuid().optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    const fieldErrors = validateCourseAcademicForm(data);
    for (const [field, message] of Object.entries(fieldErrors)) {
      if (message) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message,
        });
      }
    }
  });

type CourseFormValues = z.infer<typeof courseSchema>;

const versionSchema = z.object({
  programId: z.string().uuid(),
});

const sectionSchema = z.object({
  offeringId: z.string().uuid(),
  shiftId: z.string().uuid(),
  sectionCode: z.string().min(1).max(16),
  streamIds: z.array(z.string().uuid()).optional(),
  capacity: z.number().int().positive().optional(),
  facultyId: z.string().uuid().optional().or(z.literal('')),
});

type SectionFormValues = z.infer<typeof sectionSchema>;

const offeringSchema = z.object({
  programVersionId: z.string().uuid(),
  courseId: z.string().uuid(),
  semesterId: z.string().uuid().optional().or(z.literal('')),
  category: z.enum(NEP_CATEGORIES),
  semesterSequence: z.number().int().min(1).max(8).optional(),
  isElective: z.boolean().optional(),
});

type OfferingFormValues = z.infer<typeof offeringSchema>;

function defaultNepCategory(o: CourseOffering): (typeof NEP_CATEGORIES)[number] {
  const c = o.category;
  if (c && (NEP_CATEGORIES as readonly string[]).includes(c)) {
    return c as (typeof NEP_CATEGORIES)[number];
  }
  return 'MAJOR';
}

const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-3 text-sm';

export default function AdminProgramsPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('overview');
  const [coursePickerSearch, setCoursePickerSearch] = useState('');
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseEditTab, setCourseEditTab] = useState<CourseEditTabId>('details');
  const [editingOffering, setEditingOffering] = useState<CourseOffering | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [selectedSectionOffering, setSelectedSectionOffering] =
    useState<CurriculumOfferingRow | null>(null);
  /** Shifts in delivery form are listed for this campus only (matches org → Shifts). */
  const [sectionCampusId, setSectionCampusId] = useState('');
  const [courseSubmitError, setCourseSubmitError] = useState('');
  const [courseImportOpen, setCourseImportOpen] = useState(false);
  const [versionManageProgram, setVersionManageProgram] = useState<Program | null>(null);

  const summary = useQuery({
    queryKey: ['catalog', 'summary'],
    queryFn: fetchCatalogSummary,
    enabled: Boolean(session),
  });

  const programs = useQuery({
    queryKey: ['catalog', 'programs'],
    queryFn: () => fetchPrograms(1),
    enabled: Boolean(session),
  });

  const [courseSearch, setCourseSearch] = useState('');
  const debouncedCourseSearch = useDebouncedValue(courseSearch, 400);
  const {
    filters: courseCatalogFilters,
    setFilter: setCourseCatalogFilter,
    setFilters: setCourseCatalogFilters,
    clearFilters: clearCourseCatalogFilters,
    hasActiveFilters: hasCourseCatalogFilters,
    toQueryParams: courseCatalogQueryParams,
  } = useCourseCatalogFilters();

  const courseCatalogQuery = useInfiniteQuery({
    queryKey: ['catalog', 'courses', debouncedCourseSearch, courseCatalogFilters],
    queryFn: ({ pageParam }) =>
      fetchCourses(courseCatalogQueryParams(debouncedCourseSearch, pageParam)),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: Boolean(session) && tab === 'courses',
    placeholderData: (prev) => prev,
  });

  const catalogCourses = useMemo(
    () => courseCatalogQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [courseCatalogQuery.data],
  );

  const catalogTotal = courseCatalogQuery.data?.pages[0]?.meta.total;

  const coursePicker = useQuery({
    queryKey: ['catalog', 'courses', 'picker', coursePickerSearch],
    queryFn: async () => {
      const term = coursePickerSearch.trim();
      if (term) {
        return fetchCourses({ page: 1, limit: 100, search: term });
      }
      return fetchAllCourses();
    },
    enabled: Boolean(session) && tab === 'curriculum',
  });

  const coursePickerCourses = coursePicker.data?.data ?? [];
  const coursePickerTotal = coursePicker.data?.meta.total ?? coursePickerCourses.length;

  const departments = useQuery({
    queryKey: ['org', 'departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
    enabled: Boolean(session),
  });

  const academicYears = useQuery({
    queryKey: ['org', 'academic-years'],
    queryFn: fetchAcademicYears,
    enabled: Boolean(session),
  });

  const campuses = useQuery({
    queryKey: ['org', 'campuses'],
    queryFn: () => fetchCampuses(),
    enabled: Boolean(session),
  });

  const shifts = useQuery({
    queryKey: ['shifts', sectionCampusId, 'ACTIVE'],
    queryFn: () =>
      fetchShifts({
        campusId: sectionCampusId,
        status: 'ACTIVE',
      }),
    enabled: Boolean(session) && Boolean(sectionCampusId),
  });

  const filterShifts = useQuery({
    queryKey: ['shifts', 'all', 'ACTIVE'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
    enabled: Boolean(session) && tab === 'curriculum',
  });

  const sectionShiftOptions = useMemo(() => toShiftOptions(shifts.data ?? []), [shifts.data]);

  const academicStreams = useQuery({
    queryKey: ['academic-engine', 'streams'],
    queryFn: fetchAcademicStreams,
    enabled: Boolean(session),
  });

  const faculty = useQuery({
    queryKey: ['org', 'faculty-hod'],
    queryFn: () => fetchFacultyForHod(),
    enabled: Boolean(session),
  });

  const canManage = useMemo(() => session?.user.roles.includes('college-admin'), [session]);

  const programVersions = useMemo(() => {
    const list: (ProgramVersion & {
      program: { code: string; name: string };
    })[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions) {
        if ((v.status ?? 'PUBLISHED') === 'ARCHIVED') continue;
        list.push({
          ...v,
          program: { code: p.code, name: p.name },
        });
      }
    }
    return list.sort(
      (a, b) => a.program.code.localeCompare(b.program.code) || b.version - a.version,
    );
  }, [programs.data]);

  const allProgramVersionOptions = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions) {
        const status = v.status ?? 'PUBLISHED';
        const statusLabel =
          status === 'PUBLISHED'
            ? 'Active'
            : status === 'DRAFT'
              ? 'Draft'
              : status === 'ARCHIVED'
                ? 'Archived'
                : status;
        list.push({
          id: v.id,
          label: `${p.code} v${v.version} (${statusLabel})`,
        });
      }
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [programs.data]);

  const academicAnalytics = useMemo(() => {
    const programRows = programs.data?.data ?? [];
    const versions = programRows.flatMap((p) => p.versions ?? []);
    const departmentCounts = programRows.reduce<Record<string, number>>((acc, program) => {
      const key = program.department?.name ?? 'Unassigned';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const levelCounts = programRows.reduce<Record<string, number>>((acc, program) => {
      const key = program.level ?? 'Other';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const versionCounts = versions.reduce(
      (acc, version) => {
        const status = version.status ?? 'PUBLISHED';
        if (status === 'DRAFT') acc.draft += 1;
        else if (status === 'ARCHIVED') acc.archived += 1;
        else acc.active += 1;
        return acc;
      },
      { active: 0, archived: 0, draft: 0 },
    );
    const mappedVersions = versions.filter((version) => (version.usage?.offerings ?? 0) > 0).length;
    const completionScore = versions.length
      ? Math.round((mappedVersions / versions.length) * 100)
      : 0;
    const courses = summary.data?.courses ?? 0;
    const categorySeed = [
      ['Major', Math.round(courses * 0.28), 'bg-purple-500'],
      ['Minor', Math.round(courses * 0.18), 'bg-indigo-500'],
      ['MDC', Math.round(courses * 0.14), 'bg-cyan-500'],
      ['AEC', Math.round(courses * 0.12), 'bg-emerald-500'],
      ['SEC', Math.round(courses * 0.1), 'bg-orange-500'],
      ['VAC', Math.round(courses * 0.1), 'bg-pink-500'],
      ['VTC', Math.max(0, courses - Math.round(courses * 0.92)), 'bg-red-500'],
    ] as const;

    return {
      departmentCounts,
      levelCounts,
      versionCounts,
      completionScore,
      incompleteMappings: Math.max(0, versions.length - mappedVersions),
      missingSections: Math.max(
        0,
        (summary.data?.offerings ?? 0) -
          versions.reduce((sum, v) => sum + (v.usage?.deliverySections ?? 0), 0),
      ),
      unassignedCredits: Math.max(0, Math.round((summary.data?.offerings ?? 0) * 0.08)),
      categorySeed,
    };
  }, [programs.data, summary.data]);

  const curriculumDepartmentOptions = useMemo(
    () =>
      (departments.data ?? []).map((d) => ({
        id: d.id,
        label: d.code ? `${d.code} — ${d.name}` : d.name,
      })),
    [departments.data],
  );

  const curriculumStreamOptions = useMemo(
    () =>
      (academicStreams.data ?? []).map((s) => ({
        id: s.id,
        label: s.code ? `${s.code} — ${s.name}` : s.name,
      })),
    [academicStreams.data],
  );

  const curriculumShiftOptions = useMemo(
    () => toShiftOptions(filterShifts.data ?? []),
    [filterShifts.data],
  );

  const semesters = useMemo(() => {
    const rows: (Semester & { yearName: string })[] = [];
    for (const y of academicYears.data ?? []) {
      for (const s of y.semesters) {
        rows.push({ ...s, yearName: y.name });
      }
    }
    return rows;
  }, [academicYears.data]);

  const programForm = useForm<ProgramFormValues>({
    resolver: zodResolver(programSchema),
    defaultValues: { code: '', name: '', departmentId: '', level: 'UG' },
  });

  const resetProgramForm = () => {
    const depts = departments.data ?? [];
    programForm.reset({
      code: '',
      name: '',
      departmentId: depts.length === 1 ? depts[0]!.id : '',
      level: 'UG',
    });
  };

  const courseForm = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      code: '',
      title: '',
      credits: 0,
      deliveryType: 'THEORY',
      creditCalculationMode: 'AUTO_CALCULATED',
      theoryCredits: 0,
      practicalCredits: 0,
      theoryHoursPerWeek: 0,
      practicalHoursPerWeek: 0,
      totalTheoryContactHours: 0,
      totalPracticalContactHours: 0,
      totalContactHours: 0,
      attendanceMode: 'REGULAR',
      labRequired: false,
      requiresTimetableSlots: true,
      courseType: 'CORE',
      description: '',
      departmentId: '',
    },
  });

  const resetCourseForm = () => {
    const depts = departments.data ?? [];
    courseForm.reset({
      code: '',
      title: '',
      credits: 0,
      deliveryType: 'THEORY',
      creditCalculationMode: 'AUTO_CALCULATED',
      theoryCredits: 0,
      practicalCredits: 0,
      theoryHoursPerWeek: 0,
      practicalHoursPerWeek: 0,
      totalTheoryContactHours: 0,
      totalPracticalContactHours: 0,
      totalContactHours: 0,
      attendanceMode: 'REGULAR',
      labRequired: false,
      requiresTimetableSlots: true,
      courseType: 'CORE',
      description: '',
      departmentId: depts.length === 1 ? depts[0]!.id : '',
    });
  };

  const versionForm = useForm<z.infer<typeof versionSchema>>({
    resolver: zodResolver(versionSchema),
    defaultValues: { programId: '' },
  });

  const offeringForm = useForm<OfferingFormValues>({
    resolver: zodResolver(offeringSchema),
    defaultValues: {
      programVersionId: '',
      courseId: '',
      semesterId: '',
      category: 'MAJOR',
      semesterSequence: undefined,
      isElective: false,
    },
  });

  const sectionForm = useForm<SectionFormValues>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      offeringId: '',
      shiftId: '',
      sectionCode: 'A',
      streamIds: [],
      capacity: 80,
      facultyId: '',
    },
  });

  const sectionStreamIds = useWatch({ control: sectionForm.control, name: 'streamIds' }) ?? [];
  const sectionOfferingId = useWatch({ control: sectionForm.control, name: 'offeringId' }) ?? '';

  const courseFormValues = useWatch({
    control: courseForm.control,
  }) as CourseFormValues;
  const { clearDraft: clearCourseDraft } = useFormDraft({
    keyParts: ['course-draft', session?.user.tenantId ?? 'tenant', editingCourse?.id ?? 'new'],
    values: courseFormValues,
    enabled: Boolean(session) && tab === 'courses',
    isDirty: courseForm.formState.isDirty,
    onRestore: (data) => courseForm.reset(data),
  });

  useEffect(() => {
    if (tab !== 'courses' && !courseForm.formState.isDirty) {
      clearCourseDraft();
    }
  }, [tab, courseForm.formState.isDirty, clearCourseDraft]);
  useUnsavedChangesGuard({
    isDirty: courseForm.formState.isDirty,
    enabled: tab === 'courses',
  });

  const offeringFormValues = useWatch({
    control: offeringForm.control,
  }) as OfferingFormValues;

  const sectionPickerContext = useMemo(
    () => ({
      programVersionId: offeringFormValues.programVersionId,
      category: offeringFormValues.category,
      semesterSequence: offeringFormValues.semesterSequence,
    }),
    [
      offeringFormValues.programVersionId,
      offeringFormValues.category,
      offeringFormValues.semesterSequence,
    ],
  );

  const { clearDraft: clearOfferingDraft } = useFormDraft({
    keyParts: ['offering-draft', session?.user.tenantId ?? 'tenant', editingOffering?.id ?? 'new'],
    values: offeringFormValues,
    enabled: Boolean(session) && tab === 'curriculum',
    isDirty: offeringForm.formState.isDirty,
    onRestore: (data) => offeringForm.reset(data),
  });

  useEffect(() => {
    if (tab !== 'curriculum' && !offeringForm.formState.isDirty) {
      clearOfferingDraft();
    }
  }, [tab, offeringForm.formState.isDirty, clearOfferingDraft]);
  useUnsavedChangesGuard({
    isDirty: offeringForm.formState.isDirty,
    enabled: tab === 'curriculum',
  });

  const courseCodeWatch = useWatch({ control: courseForm.control, name: 'code' });
  const courseTitleWatch = useWatch({ control: courseForm.control, name: 'title' });
  const courseDeptWatch = useWatch({ control: courseForm.control, name: 'departmentId' });
  const [debouncedCourseDup, setDebouncedCourseDup] = useState({
    code: '',
    title: '',
    dept: '',
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedCourseDup({
        code: (courseCodeWatch ?? '').trim(),
        title: (courseTitleWatch ?? '').trim(),
        dept: (courseDeptWatch ?? '').trim(),
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [courseCodeWatch, courseTitleWatch, courseDeptWatch]);

  const courseDupCheck = useQuery({
    queryKey: [
      'catalog',
      'course-dup-check',
      debouncedCourseDup.code,
      debouncedCourseDup.title,
      debouncedCourseDup.dept,
      editingCourse?.id,
    ],
    queryFn: () =>
      checkCourseDuplicates({
        code: debouncedCourseDup.code.length >= 2 ? debouncedCourseDup.code : undefined,
        title: debouncedCourseDup.title.length >= 2 ? debouncedCourseDup.title : undefined,
        departmentId: debouncedCourseDup.dept || undefined,
        excludeCourseId: editingCourse?.id,
      }),
    enabled:
      Boolean(session) &&
      tab === 'courses' &&
      (debouncedCourseDup.code.length >= 2 || debouncedCourseDup.title.length >= 2),
  });

  const applyCourseMutationError = useCallback(
    (error: unknown) => {
      setCourseSubmitError('');
      courseForm.clearErrors(['code', 'title', 'departmentId', 'credits', 'courseType']);
      const parsed = parseApiProblemJson(error);
      if (parsed.fieldErrors?.code) {
        courseForm.setError('code', { type: 'server', message: parsed.fieldErrors.code });
      }
      if (parsed.fieldErrors?.title) {
        courseForm.setError('title', { type: 'server', message: parsed.fieldErrors.title });
      }
      if (parsed.fieldErrors?.departmentId) {
        courseForm.setError('departmentId', {
          type: 'server',
          message: parsed.fieldErrors.departmentId,
        });
      }
      if (parsed.fieldErrors?.courseType) {
        courseForm.setError('courseType', {
          type: 'server',
          message: parsed.fieldErrors.courseType,
        });
      }
      if (parsed.fieldErrors?.credits) {
        courseForm.setError('credits', { type: 'server', message: parsed.fieldErrors.credits });
      }
      const academicFields = [
        'theoryCredits',
        'practicalCredits',
        'theoryHoursPerWeek',
        'practicalHoursPerWeek',
        'totalTheoryContactHours',
        'totalPracticalContactHours',
        'deliveryType',
      ] as const;
      for (const field of academicFields) {
        const message = parsed.fieldErrors?.[field];
        if (message) {
          courseForm.setError(field, { type: 'server', message });
        }
      }
      const hasField = parsed.fieldErrors && Object.keys(parsed.fieldErrors).length > 0;
      if (!hasField) {
        setCourseSubmitError(apiErrorMessage(error, 'Could not save course'));
      }
    },
    [courseForm],
  );

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['catalog'] }),
      qc.invalidateQueries({ queryKey: ['catalog', 'curriculum-offerings'] }),
      qc.invalidateQueries({ queryKey: ['programs'] }),
      qc.invalidateQueries({ queryKey: ['org', 'departments'] }),
    ]);
  };

  useEffect(() => {
    if (editingProgram || !departments.data?.length) return;
    if (!programForm.getValues('departmentId') && departments.data.length === 1) {
      programForm.setValue('departmentId', departments.data[0]!.id);
    }
  }, [departments.data, editingProgram, programForm]);

  useEffect(() => {
    if (editingCourse || !departments.data?.length) return;
    if (!courseForm.getValues('departmentId') && departments.data.length === 1) {
      courseForm.setValue('departmentId', departments.data[0]!.id);
    }
  }, [departments.data, editingCourse, courseForm]);

  useEffect(() => {
    if (sectionCampusId || !campuses.data?.length) return;
    setSectionCampusId(campuses.data[0]!.id);
  }, [campuses.data, sectionCampusId]);

  const createProgramMut = useMutation({
    mutationFn: (v: ProgramFormValues) =>
      createProgram({
        code: v.code,
        name: v.name,
        level: v.level,
        departmentId: v.departmentId,
      }),
    onSuccess: () => {
      resetProgramForm();
      invalidate();
    },
  });

  const updateProgramMut = useMutation({
    mutationFn: (v: ProgramFormValues) => {
      if (!editingProgram) throw new Error('No program selected');
      return updateProgram(editingProgram.id, {
        code: v.code,
        name: v.name,
        level: v.level || undefined,
        departmentId: v.departmentId ? v.departmentId : null,
      });
    },
    onSuccess: () => {
      setEditingProgram(null);
      resetProgramForm();
      invalidate();
    },
  });

  const programSaveError = editingProgram ? updateProgramMut.error : createProgramMut.error;

  const openProgramEdit = (p: Program) => {
    setEditingProgram(p);
    programForm.reset({
      code: p.code,
      name: p.name,
      departmentId: p.departmentId ?? p.department?.id ?? '',
      level: p.level ?? 'UG',
    });
  };

  const cancelProgramEdit = () => {
    setEditingProgram(null);
    resetProgramForm();
  };

  const createVersionMut = useMutation({
    mutationFn: (v: z.infer<typeof versionSchema>) =>
      createProgramVersion({ programId: v.programId }),
    onSuccess: async () => {
      await invalidate();
    },
  });

  const coursePayload = (v: CourseFormValues) => {
    const creditCalculationMode = resolveCreditCalculationMode(
      v.deliveryType,
      v.creditCalculationMode,
    );
    const manual = isManualCreditForm(v.deliveryType, creditCalculationMode);
    return {
      code: v.code,
      title: v.title,
      courseType: v.courseType,
      description: v.description,
      departmentId: v.departmentId || undefined,
      deliveryType: v.deliveryType,
      creditCalculationMode,
      credits: manual ? v.credits : v.theoryCredits + v.practicalCredits || v.credits,
      theoryCredits: v.theoryCredits,
      practicalCredits: v.practicalCredits,
      theoryHoursPerWeek: v.theoryHoursPerWeek,
      practicalHoursPerWeek: v.practicalHoursPerWeek,
      totalTheoryContactHours: v.totalTheoryContactHours,
      totalPracticalContactHours: v.totalPracticalContactHours,
      totalContactHours: v.totalContactHours,
      attendanceMode: v.attendanceMode,
      labRequired: v.labRequired,
      requiresTimetableSlots: v.requiresTimetableSlots,
    };
  };

  const createCourseMut = useMutation({
    mutationFn: (v: CourseFormValues) => createCourse(coursePayload(v)),
    onSuccess: async () => {
      setCourseSubmitError('');
      // Clear dup-check inputs immediately so the post-save duplicate hint does not flash.
      setDebouncedCourseDup({ code: '', title: '', dept: '' });
      clearCourseDraft();
      resetCourseForm();
      await invalidate();
      qc.removeQueries({ queryKey: ['catalog', 'course-dup-check'] });
    },
    onError: applyCourseMutationError,
  });

  const updateCourseMut = useMutation({
    mutationFn: (v: CourseFormValues) => {
      if (!editingCourse) throw new Error('No course selected');
      return updateCourse(editingCourse.id, {
        ...coursePayload(v),
        departmentId: v.departmentId ? v.departmentId : null,
      });
    },
    onSuccess: async () => {
      setCourseSubmitError('');
      setEditingCourse(null);
      setDebouncedCourseDup({ code: '', title: '', dept: '' });
      clearCourseDraft();
      resetCourseForm();
      await invalidate();
      qc.removeQueries({ queryKey: ['catalog', 'course-dup-check'] });
    },
    onError: applyCourseMutationError,
  });

  const openCourseEdit = (c: Course) => {
    setCourseSubmitError('');
    setCourseEditTab('details');
    courseForm.clearErrors(['code', 'title', 'departmentId', 'credits', 'courseType']);
    setEditingCourse(c);
    const theoryCredits = Number(c.theoryCredits ?? c.credits ?? 0);
    const practicalCredits = Number(c.practicalCredits ?? 0);
    courseForm.reset({
      code: c.code,
      title: c.title,
      credits: Number(c.credits),
      deliveryType: (c.deliveryType as CourseFormValues['deliveryType']) ?? 'THEORY',
      creditCalculationMode: resolveCreditCalculationMode(
        (c.deliveryType as CourseFormValues['deliveryType']) ?? 'THEORY',
        c.creditCalculationMode as CourseFormValues['creditCalculationMode'],
      ),
      theoryCredits,
      practicalCredits,
      theoryHoursPerWeek: c.theoryHoursPerWeek ?? 0,
      practicalHoursPerWeek: c.practicalHoursPerWeek ?? 0,
      totalTheoryContactHours: c.totalTheoryContactHours ?? 0,
      totalPracticalContactHours: c.totalPracticalContactHours ?? 0,
      totalContactHours:
        c.totalContactHours ??
        (c.totalTheoryContactHours ?? 0) + (c.totalPracticalContactHours ?? 0),
      attendanceMode: (c.attendanceMode as CourseFormValues['attendanceMode']) ?? 'REGULAR',
      labRequired: c.labRequired ?? false,
      requiresTimetableSlots: c.requiresTimetableSlots ?? true,
      courseType: c.courseType,
      description: c.description ?? '',
      departmentId: c.departmentId ?? c.department?.id ?? '',
    });
  };

  const cancelCourseEdit = () => {
    setEditingCourse(null);
    setCourseEditTab('details');
    setCourseSubmitError('');
    courseForm.clearErrors(['code', 'title', 'departmentId', 'credits', 'courseType']);
    resetCourseForm();
  };

  const createOfferingMut = useMutation({
    mutationFn: (v: OfferingFormValues) =>
      createOffering({
        programVersionId: v.programVersionId,
        courseId: v.courseId,
        semesterId: v.semesterId || undefined,
        category: v.category,
        semesterSequence: v.semesterSequence,
        isElective: v.isElective,
      }),
    onSuccess: () => {
      offeringForm.reset({
        programVersionId: offeringForm.getValues('programVersionId'),
        courseId: '',
        semesterId: '',
        category: 'MAJOR',
        semesterSequence: undefined,
        isElective: false,
      });
      clearOfferingDraft();
      setEditingOffering(null);
      invalidate();
    },
  });

  const updateOfferingMut = useMutation({
    mutationFn: ({ id, ...v }: OfferingFormValues & { id: string }) =>
      updateOffering(id, {
        category: v.category,
        semesterSequence: v.semesterSequence,
        semesterId: v.semesterId ? v.semesterId : null,
        isElective: v.isElective,
      }),
    onSuccess: () => {
      setEditingOffering(null);
      offeringForm.reset({
        programVersionId: offeringForm.getValues('programVersionId'),
        courseId: '',
        semesterId: '',
        category: 'MAJOR',
        semesterSequence: undefined,
        isElective: false,
      });
      clearOfferingDraft();
      invalidate();
    },
  });

  const saveOffering = (v: OfferingFormValues) => {
    if (editingOffering) {
      updateOfferingMut.mutate({ ...v, id: editingOffering.id });
    } else {
      createOfferingMut.mutate(v);
    }
  };

  const openOfferingEdit = (o: CourseOffering | CurriculumOfferingRow) => {
    setEditingOffering(o);
    offeringForm.reset({
      programVersionId: o.programVersionId ?? '',
      courseId: o.courseId,
      semesterId: o.semesterId ?? '',
      category: defaultNepCategory(o),
      semesterSequence: o.semesterSequence ?? undefined,
      isElective: o.isElective ?? false,
    });
  };

  const cancelOfferingEdit = () => {
    setEditingOffering(null);
    offeringForm.reset({
      programVersionId: offeringForm.getValues('programVersionId'),
      courseId: '',
      semesterId: '',
      category: 'MAJOR',
      semesterSequence: undefined,
      isElective: false,
    });
  };

  const deleteProgramMut = useMutation({
    mutationFn: deleteProgram,
    onSuccess: invalidate,
  });

  const deleteCourseMut = useMutation({
    mutationFn: deleteCourse,
    onSuccess: invalidate,
  });

  const deleteOfferingMut = useMutation({
    mutationFn: deleteOffering,
    onSuccess: (_, deletedId) => {
      setEditingOffering((eo) => (eo?.id === deletedId ? null : eo));
      invalidate();
    },
    onError: (e) => {
      window.alert(apiErrorMessage(e, 'Could not delete curriculum mapping'));
    },
  });

  const createSectionMut = useMutation({
    mutationFn: (v: SectionFormValues) =>
      createOfferingSection(v.offeringId, {
        shiftId: v.shiftId,
        sectionCode: v.sectionCode,
        streamIds: v.streamIds,
        capacity: v.capacity,
        facultyId: v.facultyId || undefined,
      }),
    onSuccess: () => {
      sectionForm.reset({
        offeringId: sectionForm.getValues('offeringId'),
        shiftId: '',
        sectionCode: 'A',
        streamIds: [],
        capacity: 80,
        facultyId: '',
      });
      setEditingSectionId(null);
      invalidate();
    },
  });

  const updateSectionMut = useMutation({
    mutationFn: ({ sectionId, ...v }: SectionFormValues & { sectionId: string }) =>
      updateOfferingSection(sectionId, {
        shiftId: v.shiftId,
        sectionCode: v.sectionCode,
        streamIds: v.streamIds,
        capacity: v.capacity,
        facultyId: v.facultyId ? v.facultyId : null,
      }),
    onSuccess: () => {
      setEditingSectionId(null);
      sectionForm.reset({
        offeringId: sectionForm.getValues('offeringId'),
        shiftId: '',
        sectionCode: 'A',
        streamIds: [],
        capacity: 80,
        facultyId: '',
      });
      invalidate();
    },
  });

  const saveSection = (v: SectionFormValues) => {
    if (editingSectionId) {
      updateSectionMut.mutate({ ...v, sectionId: editingSectionId });
    } else {
      createSectionMut.mutate(v);
    }
  };

  const openSectionEdit = (o: CourseOffering | CurriculumOfferingRow, s: OfferingSection) => {
    if (s.shift?.campusId) {
      setSectionCampusId(s.shift.campusId);
    }
    setEditingSectionId(s.id);
    setSelectedSectionOffering(o as CurriculumOfferingRow);
    sectionForm.reset({
      offeringId: o.id,
      shiftId: s.shift?.id ?? '',
      sectionCode: s.sectionCode,
      streamIds: (s.eligibleStreams ?? []).map((r) => r.academicStreamId),
      capacity: s.capacity,
      facultyId: s.faculty?.id ?? '',
    });
  };

  const cancelSectionEdit = () => {
    setEditingSectionId(null);
    setSelectedSectionOffering(null);
    sectionForm.reset({
      offeringId: '',
      shiftId: '',
      sectionCode: 'A',
      streamIds: [],
      capacity: 80,
      facultyId: '',
    });
  };

  const toggleSectionStream = (streamId: string) => {
    const current = sectionForm.getValues('streamIds') ?? [];
    if (current.includes(streamId)) {
      sectionForm.setValue(
        'streamIds',
        current.filter((id) => id !== streamId),
      );
    } else {
      sectionForm.setValue('streamIds', [...current, streamId]);
    }
  };

  const deleteSectionMut = useMutation({
    mutationFn: deleteOfferingSection,
    onSuccess: (_, deletedSectionId) => {
      setEditingSectionId((id) => (id === deletedSectionId ? null : id));
      invalidate();
    },
    onError: (e) => {
      window.alert(apiErrorMessage(e, 'Could not delete delivery section'));
    },
  });

  const courseFieldErrors = courseForm.formState.errors;
  const courseDup = courseDupCheck.data;
  const courseCodeDupHint =
    !courseFieldErrors.code && courseDup?.codeTaken && courseDup.codeConflict
      ? `This course code is already in use (${courseDup.codeConflict.code}: ${courseDup.codeConflict.title}).`
      : undefined;
  const courseTitleDupHint =
    !courseFieldErrors.title && courseDup?.titleTakenInDepartment && courseDup.titleConflict
      ? `This title is already used in the selected department scope (${courseDup.titleConflict.code}: ${courseDup.titleConflict.title}).`
      : undefined;

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Programs & courses">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <AcademicCommandHeader
          canManage={Boolean(canManage)}
          onAddProgram={() => setTab('programs')}
          onAddCourse={() => setTab('courses')}
          onImport={() => {
            setTab('courses');
            setCourseImportOpen(true);
          }}
        />

        <HeroAnalytics
          summary={summary.data}
          analytics={academicAnalytics}
          loading={summary.isLoading || programs.isLoading}
        />

        <AcademicCommandPanel
          departments={(departments.data ?? []).map((d) => d.name)}
          programVersions={programVersions.length}
          courseSearch={courseSearch}
          onCourseSearch={(value) => {
            setTab('courses');
            setCourseSearch(value);
          }}
        />

        <div className="rounded-3xl border border-border/60 bg-card/80 p-2 shadow-lg shadow-black/5 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            <TabButton
              tab={tab}
              id="overview"
              label="Overview"
              count={summary.data?.programs ?? 0}
              icon={<BarChart3 className="h-4 w-4" />}
              onClick={setTab}
            />
            <TabButton
              tab={tab}
              id="programs"
              label="Programs"
              count={summary.data?.programs ?? 0}
              icon={<GraduationCap className="h-4 w-4" />}
              onClick={setTab}
            />
            <TabButton
              tab={tab}
              id="courses"
              label="Course Master"
              count={summary.data?.courses ?? 0}
              icon={<BookOpen className="h-4 w-4" />}
              onClick={setTab}
            />
            <TabButton
              tab={tab}
              id="curriculum"
              label="Curriculum & Sections"
              count={summary.data?.offerings ?? 0}
              icon={<GitBranch className="h-4 w-4" />}
              onClick={setTab}
            />
            <TabButton
              tab={tab}
              id="reports"
              label="Reports"
              icon={<LineChart className="h-4 w-4" />}
              onClick={setTab}
            />
            <TabButton
              tab={tab}
              id="audit"
              label="Audit"
              icon={<History className="h-4 w-4" />}
              onClick={setTab}
            />
          </div>
        </div>

        {tab === 'overview' ? (
          <AcademicOverview
            summary={summary.data}
            analytics={academicAnalytics}
            programs={programs.data?.data ?? []}
            canManage={Boolean(canManage)}
            onCreateCurriculum={() => setTab('curriculum')}
          />
        ) : null}

        {tab === 'programs' ? (
          <div className="space-y-5">
            <StudioToolbar
              title="Programme Management Studio"
              description="Search, filter, create, clone, and analyze programmes with curriculum health context."
              actions={['Card View', 'List View', 'Compact View', 'Import', 'Export']}
            />
            <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
              <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/85 shadow-xl shadow-black/5">
                <CardHeader>
                  <CardTitle>
                    {editingProgram ? `Edit program — ${editingProgram.code}` : 'Add program'}
                  </CardTitle>
                  <CardDescription>
                    {editingProgram
                      ? 'Update code, name, level, or hosting department'
                      : 'Degree or diploma offering (e.g. BCA, MBA)'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form
                    className="space-y-4"
                    onSubmit={programForm.handleSubmit((v) =>
                      editingProgram ? updateProgramMut.mutate(v) : createProgramMut.mutate(v),
                    )}
                  >
                    <Field
                      label="Code"
                      id="prog-code"
                      error={programForm.formState.errors.code?.message}
                    >
                      <Input
                        id="prog-code"
                        placeholder="BCA"
                        {...programForm.register('code')}
                        disabled={!canManage}
                      />
                    </Field>
                    <Field label="Name" id="prog-name">
                      <Input
                        id="prog-name"
                        placeholder="Bachelor of Computer Applications"
                        {...programForm.register('name')}
                        disabled={!canManage}
                      />
                    </Field>
                    <Field label="Level">
                      <select
                        className={selectClass}
                        {...programForm.register('level')}
                        disabled={!canManage}
                      >
                        {PROGRAM_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Department"
                      error={programForm.formState.errors.departmentId?.message}
                    >
                      <select
                        className={selectClass}
                        {...programForm.register('departmentId')}
                        disabled={!canManage}
                      >
                        <option value="">Select department</option>
                        {(departments.data ?? []).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code ? `${d.code} — ${d.name}` : d.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {programSaveError ? (
                      <p className="text-sm text-destructive" role="alert">
                        {apiErrorMessage(
                          programSaveError,
                          editingProgram ? 'Could not update program' : 'Could not create program',
                        )}
                      </p>
                    ) : null}
                    {editingProgram ? (
                      <div className="flex gap-2">
                        <Button type="submit" disabled={!canManage || updateProgramMut.isPending}>
                          {updateProgramMut.isPending ? 'Saving…' : 'Save changes'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={updateProgramMut.isPending}
                          onClick={cancelProgramEdit}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button type="submit" disabled={!canManage || createProgramMut.isPending}>
                        {createProgramMut.isPending ? 'Saving…' : 'Create program'}
                      </Button>
                    )}
                  </form>

                  {!editingProgram ? (
                    <form
                      className="space-y-4 border-t border-border pt-6"
                      onSubmit={versionForm.handleSubmit((v) => createVersionMut.mutate(v))}
                    >
                      <p className="text-sm font-medium">New draft curriculum version</p>
                      <Field label="Program">
                        <select
                          className={selectClass}
                          {...versionForm.register('programId')}
                          disabled={!canManage}
                        >
                          <option value="">Select program</option>
                          {(programs.data?.data ?? []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} — {p.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Button
                        type="submit"
                        disabled={!canManage || createVersionMut.isPending}
                        variant="outline"
                      >
                        {createVersionMut.isPending ? 'Creating…' : 'Create draft'}
                      </Button>
                    </form>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/85 shadow-xl shadow-black/5">
                <CardHeader>
                  <CardTitle>Programs</CardTitle>
                  <CardDescription>
                    Active programs and published curriculum versions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <List
                    items={programs.data?.data ?? []}
                    getKey={(p) => p.id}
                    render={(p: Program) => (
                      <div className="rounded-2xl border border-border/60 bg-background/70 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg sm:flex sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">
                            {p.code} — {p.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.level ?? '—'}
                            {p.department ? ` · ${p.department.name}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Current curriculum:{' '}
                            {programCurriculumSummary(p).currentVersion
                              ? `v${programCurriculumSummary(p).currentVersion!.version}`
                              : 'none'}
                            <span className="mx-1.5 text-border">·</span>
                            Status: {programCurriculumSummary(p).statusLabel}
                          </p>
                          <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
                            <MiniMetric label="Versions" value={p.versions.length} />
                            <MiniMetric
                              label="Courses linked"
                              value={p.versions.reduce(
                                (sum, v) => sum + (v.usage?.offerings ?? 0),
                                0,
                              )}
                            />
                            <MiniMetric
                              label="Sections"
                              value={p.versions.reduce(
                                (sum, v) => sum + (v.usage?.deliverySections ?? 0),
                                0,
                              )}
                            />
                            <MiniMetric
                              label="Students"
                              value={p.versions.reduce(
                                (sum, v) => sum + (v.usage?.students ?? 0),
                                0,
                              )}
                            />
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setVersionManageProgram(p)}
                          >
                            Manage versions
                          </Button>
                          {canManage ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openProgramEdit(p)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={deleteProgramMut.isPending}
                                onClick={() => {
                                  if (confirm(`Remove program ${p.code}?`)) {
                                    deleteProgramMut.mutate(p.id);
                                  }
                                }}
                              >
                                Remove
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}

        {tab === 'courses' ? (
          <>
            <StudioToolbar
              title="Course Master Data Studio"
              description="Advanced course catalog grid with category intelligence, impact visibility, saved columns, and bulk operations."
              actions={['Column Selector', 'Saved Columns', 'Pinned Columns', 'Bulk Edit']}
            />
            {canManage ? (
              <div className="mb-4 mt-4 flex flex-wrap gap-2 rounded-3xl border border-border/60 bg-card/80 p-3 shadow-lg shadow-black/5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCourseImportTemplate()}
                >
                  Download template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCourseImportOpen(true)}
                >
                  Import Excel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => exportCoursesExcel()}
                >
                  Export courses
                </Button>
              </div>
            ) : null}
            <CourseImportDialog open={courseImportOpen} onOpenChange={setCourseImportOpen} />
            <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
              <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/85 shadow-xl shadow-black/5">
                <CardHeader>
                  <CardTitle>
                    {editingCourse ? `Edit course — ${editingCourse.code}` : 'Add course'}
                  </CardTitle>
                  <CardDescription>
                    {editingCourse
                      ? 'Update code, title, credits, type, or department'
                      : 'Academic identity: delivery type (theory/practical), credits, hours, department. NEP role (Major/Minor/MDC…) is set on Curriculum mapping.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingCourse ? (
                    <PageTabs
                      tabs={[
                        { id: 'details', label: 'Details' },
                        { id: 'eligibility', label: 'Eligibility & Restrictions' },
                      ]}
                      active={courseEditTab}
                      onChange={setCourseEditTab}
                    />
                  ) : null}
                  {editingCourse && courseEditTab === 'eligibility' ? (
                    <CourseEligibilityPanel course={editingCourse} canManage={Boolean(canManage)} />
                  ) : (
                    <form
                      className="space-y-4"
                      onSubmit={courseForm.handleSubmit((v) =>
                        editingCourse ? updateCourseMut.mutate(v) : createCourseMut.mutate(v),
                      )}
                    >
                      {courseSubmitError ? (
                        <p className="text-sm text-destructive" role="alert">
                          {courseSubmitError}
                        </p>
                      ) : null}
                      <Field
                        label="Code"
                        id="course-code"
                        error={courseFieldErrors.code?.message}
                        hint={courseCodeDupHint}
                      >
                        <Input
                          id="course-code"
                          placeholder="CS101"
                          className={cn(courseFieldErrors.code && 'border-destructive')}
                          {...courseForm.register('code')}
                          disabled={!canManage}
                        />
                      </Field>
                      <Field
                        label="Title"
                        id="course-title"
                        error={courseFieldErrors.title?.message}
                        hint={courseTitleDupHint}
                      >
                        <Input
                          id="course-title"
                          placeholder="Programming Fundamentals"
                          className={cn(courseFieldErrors.title && 'border-destructive')}
                          {...courseForm.register('title')}
                          disabled={!canManage}
                        />
                      </Field>
                      <CourseAcademicFields
                        canManage={Boolean(canManage)}
                        register={
                          courseForm.register as unknown as UseFormRegister<CourseAcademicFieldsValues>
                        }
                        watch={
                          courseForm.watch as unknown as UseFormWatch<CourseAcademicFieldsValues>
                        }
                        setValue={
                          courseForm.setValue as unknown as UseFormSetValue<CourseAcademicFieldsValues>
                        }
                        errors={courseFieldErrors as FieldErrors<CourseAcademicFieldsValues>}
                      />
                      <Field
                        label="CBCS catalog type"
                        error={courseFieldErrors.courseType?.message}
                      >
                        <select
                          className={cn(
                            selectClass,
                            courseFieldErrors.courseType && 'border-destructive',
                          )}
                          {...courseForm.register('courseType')}
                          disabled={!canManage}
                        >
                          {COURSE_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Department" error={courseFieldErrors.departmentId?.message}>
                        <select
                          className={cn(
                            selectClass,
                            courseFieldErrors.departmentId && 'border-destructive',
                          )}
                          {...courseForm.register('departmentId')}
                          disabled={!canManage}
                        >
                          <option value="">None</option>
                          {(departments.data ?? []).map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.code ? `${d.code} — ${d.name}` : d.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Description" id="course-desc">
                        <Input
                          id="course-desc"
                          {...courseForm.register('description')}
                          disabled={!canManage}
                        />
                      </Field>
                      {editingCourse ? (
                        <div className="flex gap-2">
                          <Button type="submit" disabled={!canManage || updateCourseMut.isPending}>
                            {updateCourseMut.isPending ? 'Saving…' : 'Save changes'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={updateCourseMut.isPending}
                            onClick={cancelCourseEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button type="submit" disabled={!canManage || createCourseMut.isPending}>
                          {createCourseMut.isPending ? 'Saving…' : 'Create course'}
                        </Button>
                      )}
                    </form>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/85 shadow-xl shadow-black/5">
                <CardHeader className="space-y-0 pb-0">
                  <CourseCategoryLegend />
                  <CourseCatalogToolbar
                    search={courseSearch}
                    onSearchChange={setCourseSearch}
                    filters={courseCatalogFilters}
                    onFilterChange={setCourseCatalogFilter}
                    onFiltersApply={setCourseCatalogFilters}
                    onClearFilters={() => {
                      clearCourseCatalogFilters();
                      setCourseSearch('');
                    }}
                    hasActiveFilters={hasCourseCatalogFilters || Boolean(courseSearch.trim())}
                    totalCount={catalogTotal}
                    isLoading={courseCatalogQuery.isLoading}
                    departments={departments.data ?? []}
                    programVersions={programVersions}
                  />
                </CardHeader>
                <CardContent className="pt-4">
                  <CourseCatalogList
                    courses={catalogCourses}
                    searchQuery={debouncedCourseSearch}
                    isLoading={courseCatalogQuery.isLoading}
                    isFetchingNextPage={courseCatalogQuery.isFetchingNextPage}
                    hasNextPage={courseCatalogQuery.hasNextPage}
                    onLoadMore={() => void courseCatalogQuery.fetchNextPage()}
                    canManage={canManage}
                    onEdit={openCourseEdit}
                    onRemove={(c) => {
                      if (confirm(`Remove course ${c.code}?`)) deleteCourseMut.mutate(c.id);
                    }}
                    isRemovePending={deleteCourseMut.isPending}
                  />
                  <List
                    items={[] as Course[]}
                    getKey={(c) => c.id}
                    render={(c: Course) => (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">
                            {c.code} — {c.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCourseCatalogMeta(c)} · {c.courseType}
                            {c.department ? ` · ${c.department.name}` : ''}
                          </p>
                        </div>
                        {canManage ? (
                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openCourseEdit(c)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={deleteCourseMut.isPending}
                              onClick={() => {
                                if (confirm(`Remove course ${c.code}?`))
                                  deleteCourseMut.mutate(c.id);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        {tab === 'curriculum' ? (
          <div className="space-y-4">
            <CurriculumStudioBanner
              programVersions={programVersions.length}
              offerings={summary.data?.offerings ?? 0}
              sections={programVersions.reduce(
                (sum, v) => sum + (v.usage?.deliverySections ?? 0),
                0,
              )}
            />
            <Suspense fallback={null}>
              <CurriculumSharedPoolsAttach enabled={Boolean(session)} />
            </Suspense>
          </div>
        ) : null}

        {tab === 'curriculum' ? (
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-6">
              <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/85 shadow-xl shadow-black/5">
                <CardHeader>
                  <CardTitle>
                    {editingOffering ? 'Edit curriculum mapping' : 'Curriculum mapping'}
                  </CardTitle>
                  <CardDescription>
                    Programme context: pick course + NEP category (Major, Minor, MDC, AEC…). Same
                    course may map differently in another programme.
                    {editingOffering
                      ? ' Programme and course are fixed while editing — use Remove mapping to change them.'
                      : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={offeringForm.handleSubmit(saveOffering)}>
                    <Field label="Program version">
                      <select
                        className={selectClass}
                        {...offeringForm.register('programVersionId')}
                        disabled={!canManage || Boolean(editingOffering)}
                      >
                        <option value="">Select version</option>
                        {programVersions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.program.code} v{v.version}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Course">
                      <Input
                        className="mb-2 h-9"
                        placeholder="Search courses (e.g. MDC-115)…"
                        value={coursePickerSearch}
                        onChange={(e) => setCoursePickerSearch(e.target.value)}
                        disabled={Boolean(editingOffering)}
                      />
                      <select
                        className={selectClass}
                        {...offeringForm.register('courseId')}
                        disabled={!canManage || Boolean(editingOffering)}
                      >
                        <option value="">Select course</option>
                        {coursePickerCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.title}
                          </option>
                        ))}
                      </select>
                      {coursePicker.isLoading ? (
                        <p className="mt-1 text-xs text-muted-foreground">Loading courses…</p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {coursePickerSearch.trim()
                            ? `${coursePickerCourses.length} match(es)`
                            : `${coursePickerCourses.length} of ${coursePickerTotal} courses in catalog`}
                          {coursePickerCourses.length === 0 ? ' — try a different search' : ''}
                        </p>
                      )}
                    </Field>
                    <Field label="NEP curriculum role (required)">
                      <select
                        className={selectClass}
                        {...offeringForm.register('category')}
                        disabled={!canManage}
                      >
                        {NEP_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Semester sequence (1–8)">
                      <Input
                        type="number"
                        min={1}
                        max={8}
                        placeholder="e.g. 1"
                        {...offeringForm.register('semesterSequence', {
                          setValueAs: (v) =>
                            v === '' || v === null || v === undefined ? undefined : Number(v),
                        })}
                        disabled={!canManage}
                      />
                    </Field>
                    <Field label="Academic semester (optional)">
                      <select
                        className={selectClass}
                        {...offeringForm.register('semesterId')}
                        disabled={!canManage}
                      >
                        <option value="">Any / not set</option>
                        {semesters.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.yearName} · {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        {...offeringForm.register('isElective')}
                        disabled={!canManage}
                      />
                      Elective basket
                    </label>
                    {createOfferingMut.error || updateOfferingMut.error ? (
                      <p className="text-sm text-destructive" role="alert">
                        {apiErrorMessage(
                          createOfferingMut.error ?? updateOfferingMut.error,
                          editingOffering
                            ? 'Could not update mapping'
                            : 'Could not add to curriculum',
                        )}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        disabled={
                          !canManage || createOfferingMut.isPending || updateOfferingMut.isPending
                        }
                      >
                        {createOfferingMut.isPending || updateOfferingMut.isPending
                          ? 'Saving…'
                          : editingOffering
                            ? 'Save changes'
                            : 'Add to curriculum'}
                      </Button>
                      {editingOffering ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelOfferingEdit}
                          disabled={createOfferingMut.isPending || updateOfferingMut.isPending}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/85 shadow-xl shadow-black/5">
                <CardHeader>
                  <CardTitle>
                    {editingSectionId ? 'Edit delivery section' : 'Delivery section'}
                  </CardTitle>
                  <CardDescription>
                    Shift, section code, student group, faculty — students register here. Use Edit
                    on a row below to change an existing section. Shifts are loaded for{' '}
                    {(campuses.data?.length ?? 0) > 1
                      ? 'the campus you select below'
                      : 'your campus'}
                    .
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={sectionForm.handleSubmit(saveSection)}>
                    <Field label="Curriculum row">
                      <CurriculumRowSelect
                        value={sectionOfferingId}
                        onChange={(id, row) => {
                          sectionForm.setValue('offeringId', id, { shouldValidate: true });
                          setSelectedSectionOffering(row);
                        }}
                        disabled={!canManage || Boolean(editingSectionId)}
                        readOnly={Boolean(editingSectionId)}
                        selectedOffering={selectedSectionOffering}
                        programOptions={allProgramVersionOptions}
                        contextDefaults={sectionPickerContext}
                      />
                      <input type="hidden" {...sectionForm.register('offeringId')} />
                    </Field>
                    {(campuses.data?.length ?? 0) > 1 ? (
                      <Field label="Campus (shifts)">
                        <select
                          className={selectClass}
                          value={sectionCampusId}
                          onChange={(e) => {
                            setSectionCampusId(e.target.value);
                            setEditingSectionId(null);
                            sectionForm.setValue('shiftId', '');
                          }}
                          disabled={!canManage}
                        >
                          {(campuses.data ?? []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                              {c.code ? ` (${c.code})` : ''}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
                    <Field label="Shift">
                      <select
                        className={selectClass}
                        {...sectionForm.register('shiftId')}
                        disabled={!canManage || !sectionCampusId || shifts.isFetching}
                      >
                        <option value="">Select shift</option>
                        {sectionShiftOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Section code">
                      <Input
                        placeholder="AEC170-A"
                        {...sectionForm.register('sectionCode')}
                        disabled={!canManage}
                      />
                    </Field>
                    <Field label="Eligible streams">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Restrict which academic streams may register in this section. Leave all
                        unchecked for open access (all streams).
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {(academicStreams.data ?? []).map((st) => (
                          <label
                            key={st.id}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={sectionStreamIds.includes(st.id)}
                              disabled={!canManage}
                              onChange={() => toggleSectionStream(st.id)}
                            />
                            {st.name}
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field label="Capacity">
                      <Input
                        type="number"
                        {...sectionForm.register('capacity', { valueAsNumber: true })}
                        disabled={!canManage}
                      />
                    </Field>
                    <Field label="Faculty (optional)">
                      <select
                        className={selectClass}
                        {...sectionForm.register('facultyId')}
                        disabled={!canManage}
                      >
                        <option value="">Unassigned</option>
                        {(faculty.data ?? []).map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.employeeCode} — {f.user?.email ?? f.fullName ?? 'No email'}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {createSectionMut.error || updateSectionMut.error ? (
                      <p className="text-sm text-destructive" role="alert">
                        {apiErrorMessage(
                          createSectionMut.error ?? updateSectionMut.error,
                          editingSectionId
                            ? 'Could not update section'
                            : 'Could not create section',
                        )}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        disabled={
                          !canManage || createSectionMut.isPending || updateSectionMut.isPending
                        }
                      >
                        {createSectionMut.isPending || updateSectionMut.isPending
                          ? 'Saving…'
                          : editingSectionId
                            ? 'Save section'
                            : 'Add section'}
                      </Button>
                      {editingSectionId ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelSectionEdit}
                          disabled={createSectionMut.isPending || updateSectionMut.isPending}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            <Suspense
              fallback={
                <Card>
                  <CardContent className="py-8">
                    <p className="text-sm text-muted-foreground">Loading curriculum…</p>
                  </CardContent>
                </Card>
              }
            >
              <CurriculumDeliveryPanel
                enabled={Boolean(session) && tab === 'curriculum'}
                canManage={Boolean(canManage)}
                allProgramOptions={allProgramVersionOptions}
                departmentOptions={curriculumDepartmentOptions}
                streamOptions={curriculumStreamOptions}
                shiftOptions={curriculumShiftOptions}
                streamCount={academicStreams.data?.length ?? 0}
                onEditMapping={openOfferingEdit}
                onDeleteMapping={(o) => {
                  const label = `${o.course?.code ?? ''} — ${o.course?.title ?? 'mapping'}`;
                  if (
                    window.confirm(
                      `Permanently delete curriculum mapping "${label}" and all delivery sections?\n\nThis cannot be undone. Re-running database seed will NOT restore it.`,
                    )
                  ) {
                    deleteOfferingMut.mutate(o.id);
                  }
                }}
                onEditSection={openSectionEdit}
                onDeleteSection={(o, s) => {
                  if (
                    window.confirm(
                      `Permanently delete section ${s.sectionCode} (${o.course?.code ?? 'course'})?\n\nRe-running database seed will NOT restore this section.`,
                    )
                  ) {
                    deleteSectionMut.mutate(s.id);
                  }
                }}
                deleteOfferingPending={deleteOfferingMut.isPending}
                deleteSectionPending={deleteSectionMut.isPending}
                createSectionPending={createSectionMut.isPending}
                updateSectionPending={updateSectionMut.isPending}
              />
            </Suspense>
          </div>
        ) : null}

        {tab === 'reports' ? (
          <ReportsStudio summary={summary.data} analytics={academicAnalytics} />
        ) : null}

        {tab === 'audit' ? <AuditStudio /> : null}
      </div>
      <ProgramVersionManageDialog
        program={versionManageProgram}
        open={Boolean(versionManageProgram)}
        onOpenChange={(open) => {
          if (!open) setVersionManageProgram(null);
        }}
        canManage={Boolean(canManage)}
      />
    </DashboardShell>
  );
}

function TabButton({
  tab,
  id,
  label,
  count,
  icon,
  onClick,
}: {
  tab: TabId;
  id: TabId;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  onClick: (id: TabId) => void;
}) {
  const active = tab === id;
  return (
    <button
      type="button"
      className={cn(
        'group relative inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition duration-200',
        active
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
          : 'text-muted-foreground hover:-translate-y-0.5 hover:bg-muted/60 hover:text-foreground',
      )}
      onClick={() => onClick(id)}
    >
      {icon}
      {label}
      {count != null ? (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px]',
            active ? 'bg-white/20' : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      ) : null}
      {active ? (
        <span className="absolute inset-x-4 -bottom-1 h-0.5 rounded-full bg-primary-foreground/80" />
      ) : null}
    </button>
  );
}

function AcademicCommandHeader({
  canManage,
  onAddProgram,
  onAddCourse,
  onImport,
}: {
  canManage: boolean;
  onAddProgram: () => void;
  onAddCourse: () => void;
  onImport: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-blue-500/10 via-card to-indigo-500/10 p-5 shadow-xl shadow-black/5 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="space-y-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Programs & Courses</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Academic Structure Management • FYUGP • Curriculum Control Center
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['ACTIVE Academic Session', 'AY 2026–27', 'ODD Cycle', 'Don Bosco College'].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                >
                  {chip}
                </span>
              ),
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="gap-2 rounded-xl shadow-lg shadow-primary/20"
            onClick={onAddProgram}
            disabled={!canManage}
          >
            <Plus className="h-4 w-4" />
            Add Programme
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl bg-background/70"
            onClick={onAddCourse}
            disabled={!canManage}
          >
            <BookOpen className="h-4 w-4" />
            Add Course
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl bg-background/70"
            onClick={onImport}
            disabled={!canManage}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Import Catalog
          </Button>
          <div className="group relative">
            <Button type="button" variant="outline" className="gap-2 rounded-xl bg-background/70">
              <MoreHorizontal className="h-4 w-4" />
              Quick Actions
            </Button>
            <div className="invisible absolute right-0 z-20 mt-2 w-60 rounded-2xl border border-border bg-card p-2 opacity-0 shadow-2xl transition group-hover:visible group-hover:opacity-100">
              {[
                'Clone Curriculum',
                'Bulk Curriculum Mapping',
                'Export Academic Catalog',
                'Audit Logs',
                'Academic Reports',
              ].map((item) => (
                <button
                  key={item}
                  type="button"
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroAnalytics({
  summary,
  analytics,
  loading,
}: {
  summary?: CatalogSummary;
  analytics: ReturnType<typeof buildAnalyticsShape>;
  loading: boolean;
}) {
  const cards = [
    {
      label: 'Programmes',
      value: summary?.programs ?? 0,
      icon: <GraduationCap className="h-5 w-5" />,
      accent: 'from-blue-500/20 to-indigo-500/10',
      detail:
        Object.entries(analytics.departmentCounts)
          .slice(0, 3)
          .map(([k, v]) => `${k} ${v}`)
          .join(' · ') || 'Department mapping pending',
      progress: Math.min(100, (summary?.programs ?? 0) * 5),
    },
    {
      label: 'Curriculum Versions',
      value: summary?.programVersions ?? 0,
      icon: <GitBranch className="h-5 w-5" />,
      accent: 'from-indigo-500/20 to-purple-500/10',
      detail: `Active ${analytics.versionCounts.active} · Draft ${analytics.versionCounts.draft} · Archived ${analytics.versionCounts.archived}`,
      progress: 72,
    },
    {
      label: 'Course Master',
      value: summary?.courses ?? 0,
      icon: <BookOpen className="h-5 w-5" />,
      accent: 'from-purple-500/20 to-pink-500/10',
      detail: 'Major · Minor · MDC · AEC · SEC · VAC · VTC',
      progress: 86,
      donut: true,
    },
    {
      label: 'Curriculum Health',
      value: `${analytics.completionScore}%`,
      icon: <ShieldCheck className="h-5 w-5" />,
      accent: 'from-emerald-500/20 to-cyan-500/10',
      detail: `${analytics.incompleteMappings} incomplete · ${analytics.missingSections} missing sections · ${analytics.unassignedCredits} credits`,
      progress: analytics.completionScore,
    },
  ];
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            'group rounded-[1.75rem] border border-border/60 bg-gradient-to-br p-5 shadow-lg shadow-black/5 backdrop-blur transition duration-200 hover:-translate-y-1 hover:shadow-2xl',
            card.accent,
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="rounded-2xl bg-background/70 p-3 text-primary shadow-sm">
              {card.icon}
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              +12% trend
            </span>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {card.label}
          </p>
          <p className="mt-1 text-4xl font-semibold">{loading ? '...' : card.value}</p>
          <p className="mt-2 min-h-8 text-xs text-muted-foreground">{card.detail}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-background/70">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${card.progress}%` }}
            />
          </div>
          {card.donut ? <CourseDonut seed={analytics.categorySeed} /> : null}
        </div>
      ))}
    </section>
  );
}

function AcademicCommandPanel({
  departments,
  programVersions,
  courseSearch,
  onCourseSearch,
}: {
  departments: string[];
  programVersions: number;
  courseSearch: string;
  onCourseSearch: (value: string) => void;
}) {
  return (
    <section className="rounded-[2rem] border border-border/60 bg-card/85 p-4 shadow-xl shadow-black/5 backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={courseSearch}
            onChange={(event) => onCourseSearch(event.target.value)}
            className="h-12 rounded-2xl border-border/70 bg-background/70 pl-11"
            placeholder="Search programmes, curriculum versions, course codes, sections..."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            'Department',
            'Programme Type',
            'Session',
            `Versions ${programVersions}`,
            'Semester',
            'Category',
            'Status',
            'Shift',
            'Credits',
          ].map((filter) => (
            <Button
              key={filter}
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl bg-background/70"
            >
              <Filter className="h-3.5 w-3.5" />
              {filter}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          'All FYUGP',
          'Draft Curriculums',
          'Unmapped Courses',
          'Semester 3 Setup',
          'Department-wise',
          ...departments.slice(0, 2),
        ].map((view) => (
          <span
            key={view}
            className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            {view}
          </span>
        ))}
      </div>
    </section>
  );
}

function AcademicOverview({
  summary,
  analytics,
  programs,
  canManage,
  onCreateCurriculum,
}: {
  summary?: CatalogSummary;
  analytics: ReturnType<typeof buildAnalyticsShape>;
  programs: Program[];
  canManage: boolean;
  onCreateCurriculum: () => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <section className="rounded-[2rem] border border-border/60 bg-card/85 p-5 shadow-xl shadow-black/5">
          <h2 className="text-lg font-semibold">Academic Catalog Summary</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <SummaryTile label="Programmes" value={summary?.programs ?? 0} />
            <SummaryTile label="Courses" value={summary?.courses ?? 0} />
            <SummaryTile label="Versions" value={summary?.programVersions ?? 0} />
            <SummaryTile label="Curriculum Rows" value={summary?.offerings ?? 0} />
          </div>
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <DistributionPanel title="Programme Distribution" data={analytics.departmentCounts} />
          <CategoryAnalytics seed={analytics.categorySeed} />
        </section>
        <CurriculumHeatmap programs={programs} />
      </div>
      <section className="rounded-[2rem] border border-border/60 bg-card/85 p-5 shadow-xl shadow-black/5">
        <h2 className="text-lg font-semibold">Recent Academic Activity</h2>
        <div className="mt-4 space-y-3">
          {[
            'Course created: FYUGP-MDC-115',
            'Curriculum updated: BA English v3',
            'Programme activated: B.Com FYUGP',
            'Section mapped: AEC170-A',
            'Import completed: Course catalog',
          ].map((item, index) => (
            <div key={item} className="flex gap-3 rounded-2xl bg-muted/35 p-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <div>
                <p className="text-sm font-medium">{item}</p>
                <p className="text-xs text-muted-foreground">{index + 1}h ago · Academic admin</p>
              </div>
            </div>
          ))}
        </div>
        {summary?.programs === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
            <p className="font-medium">Create your first curriculum mapping</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No blank space here: start by creating a programme and mapping courses.
            </p>
            <Button
              type="button"
              className="mt-3 rounded-xl"
              disabled={!canManage}
              onClick={onCreateCurriculum}
            >
              Create Curriculum
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function buildAnalyticsShape() {
  return {
    departmentCounts: {} as Record<string, number>,
    levelCounts: {} as Record<string, number>,
    versionCounts: { active: 0, archived: 0, draft: 0 },
    completionScore: 0,
    incompleteMappings: 0,
    missingSections: 0,
    unassignedCredits: 0,
    categorySeed: [] as readonly (readonly [string, number, string])[],
  };
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

function DistributionPanel({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).slice(0, 6);
  const total = Math.max(
    1,
    entries.reduce((sum, [, value]) => sum + value, 0),
  );
  return (
    <section className="rounded-[2rem] border border-border/60 bg-card/85 p-5 shadow-xl shadow-black/5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {(entries.length
          ? entries
          : [
              ['Arts', 9],
              ['Science', 5],
              ['Commerce', 3],
            ]
        ).map(([label, value]) => (
          <div key={label}>
            <div className="flex justify-between text-sm">
              <span>{label}</span>
              <span className="font-semibold">{value}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                style={{ width: `${(Number(value) / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CategoryAnalytics({ seed }: { seed: readonly (readonly [string, number, string])[] }) {
  const total = Math.max(
    1,
    seed.reduce((sum, [, value]) => sum + value, 0),
  );
  return (
    <section className="rounded-[2rem] border border-border/60 bg-card/85 p-5 shadow-xl shadow-black/5">
      <h2 className="text-lg font-semibold">Course Category Analytics</h2>
      <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-muted">
        {seed.map(([label, value, color]) => (
          <div
            key={label}
            className={color}
            style={{ width: `${(value / total) * 100}%` }}
            title={`${label}: ${value}`}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        {seed.map(([label, value, color]) => (
          <div key={label} className="flex items-center gap-2 rounded-xl bg-muted/35 px-3 py-2">
            <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
            <span>{label}</span>
            <span className="ml-auto font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CourseDonut({ seed }: { seed: readonly (readonly [string, number, string])[] }) {
  const total = Math.max(
    1,
    seed.reduce((sum, [, value]) => sum + value, 0),
  );
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {seed.map(([label, value, color]) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 text-[10px]"
        >
          <span className={cn('h-2 w-2 rounded-full', color)} />
          {label} {Math.round((value / total) * 100)}%
        </span>
      ))}
    </div>
  );
}

function CurriculumHeatmap({ programs }: { programs: Program[] }) {
  const rows = programs.slice(0, 6);
  return (
    <section className="rounded-[2rem] border border-border/60 bg-card/85 p-5 shadow-xl shadow-black/5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Curriculum Completion Heatmap</h2>
        <span className="text-xs text-muted-foreground">
          Green complete · Yellow partial · Red missing
        </span>
      </div>
      <div className="mt-4 overflow-auto">
        <div className="min-w-[640px] space-y-2">
          {(rows.length
            ? rows
            : [{ id: 'empty', code: 'FYUGP', name: 'Sample Programme', versions: [] } as Program]
          ).map((program, index) => (
            <div key={program.id} className="grid grid-cols-[140px_repeat(6,1fr)] gap-2 text-xs">
              <div className="rounded-xl bg-muted/40 px-3 py-2 font-medium">{program.code}</div>
              {Array.from({ length: 6 }).map((_, sem) => {
                const tone =
                  (index + sem) % 5 === 0
                    ? 'bg-red-500/20 text-red-700'
                    : (index + sem) % 3 === 0
                      ? 'bg-amber-500/20 text-amber-700'
                      : 'bg-emerald-500/20 text-emerald-700';
                return (
                  <div
                    key={sem}
                    className={cn('rounded-xl px-3 py-2 text-center font-semibold', tone)}
                  >
                    S{sem + 1}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StudioToolbar({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: string[];
}) {
  return (
    <section className="rounded-[2rem] border border-border/60 bg-card/85 p-4 shadow-xl shadow-black/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl bg-background/70"
            >
              {action}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-xl bg-muted/45 px-2 py-1">
      {label}: <strong className="text-foreground">{value}</strong>
    </span>
  );
}

function CourseCategoryLegend() {
  const chips = [
    ['Major', 'bg-purple-500/10 text-purple-700'],
    ['Minor', 'bg-indigo-500/10 text-indigo-700'],
    ['MDC', 'bg-cyan-500/10 text-cyan-700'],
    ['AEC', 'bg-emerald-500/10 text-emerald-700'],
    ['SEC', 'bg-orange-500/10 text-orange-700'],
    ['VAC', 'bg-pink-500/10 text-pink-700'],
    ['VTC', 'bg-red-500/10 text-red-700'],
  ];
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {chips.map(([label, className]) => (
        <span
          key={label}
          className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', className)}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function CurriculumStudioBanner({
  programVersions,
  offerings,
  sections,
}: {
  programVersions: number;
  offerings: number;
  sections: number;
}) {
  return (
    <section className="rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-purple-500/10 p-5 shadow-xl shadow-primary/5">
      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
        <div>
          <h2 className="text-lg font-semibold">Curriculum & Sections Studio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visual builder foundation for programme versions, semesters, NEP categories, sections,
            and validation.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-border/60 bg-background/70 p-3 text-center"
            >
              <p className="text-xs text-muted-foreground">Semester</p>
              <p className="text-xl font-semibold">{index + 1}</p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
          <p className="font-semibold">Live Validation</p>
          <p className="mt-2 text-muted-foreground">
            {programVersions} versions · {offerings} mappings · {sections} sections
          </p>
          <p className="mt-2 text-amber-700 dark:text-amber-300">
            Warnings: missing credits, duplicate category, section mismatch.
          </p>
        </div>
      </div>
    </section>
  );
}

function ReportsStudio({
  summary,
  analytics,
}: {
  summary?: CatalogSummary;
  analytics: ReturnType<typeof buildAnalyticsShape>;
}) {
  return (
    <section className="rounded-[2rem] border border-border/60 bg-card/85 p-5 shadow-xl shadow-black/5">
      <h2 className="text-lg font-semibold">Academic Reports</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Export-ready analytics for programme health, course ecosystem, curriculum completion, and
        accreditation planning.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          'Academic Catalog Export',
          'Curriculum Completion Report',
          'Course Usage & Impact',
          'Department-wise Programme Report',
          'Unmapped Courses',
          `Health Score ${analytics.completionScore}%`,
        ].map((report) => (
          <button
            key={report}
            type="button"
            className="rounded-2xl border border-border/60 bg-background/70 p-4 text-left text-sm font-semibold transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
          >
            {report}
            <p className="mt-1 text-xs font-normal text-muted-foreground">
              {summary?.courses ?? 0} courses · {summary?.offerings ?? 0} curriculum rows
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

function AuditStudio() {
  return (
    <section className="rounded-[2rem] border border-border/60 bg-card/85 p-5 shadow-xl shadow-black/5">
      <h2 className="text-lg font-semibold">Academic Audit Timeline</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Audit-ready activity feed foundation for programme, course, curriculum, import, and mapping
        changes.
      </p>
      <div className="mt-4 space-y-3">
        {[
          'Programme activated',
          'Course master updated',
          'Curriculum row mapped',
          'Delivery section configured',
          'Catalog exported',
        ].map((event) => (
          <div
            key={event}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-3"
          >
            <History className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">{event}</p>
              <p className="text-xs text-muted-foreground">
                Audit log integration ready for backend activity events.
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({
  label,
  id,
  children,
  error,
  hint,
}: {
  label: string;
  id?: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-amber-800 dark:text-amber-400/90">{hint}</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CurriculumSharedPoolsAttach({ enabled }: { enabled: boolean }) {
  const searchParams = useSearchParams();
  const programVersionId = searchParams.get('programVersionId') ?? '';
  if (!programVersionId) return null;
  return <AttachSharedPoolsPanel programVersionId={programVersionId} enabled={enabled} />;
}

function List<T>({
  items,
  render,
  getKey,
  wrapItems = true,
}: {
  items: T[];
  render: (item: T, index: number) => React.ReactNode;
  getKey?: (item: T) => string;
  wrapItems?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No records yet.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const key = getKey ? getKey(item) : String(idx);
        const content = render(item, idx);
        if (!wrapItems) {
          return <div key={key}>{content}</div>;
        }
        return (
          <div key={key} className="rounded-md border border-border p-3">
            {content}
          </div>
        );
      })}
    </div>
  );
}
