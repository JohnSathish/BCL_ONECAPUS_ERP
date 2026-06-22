'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Calendar,
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  createRecruitmentVacancy,
  updateRecruitmentVacancyStatus,
  type RecruitmentVacancy,
} from '@/services/hr';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/utils/api-error';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    DRAFT: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    CLOSED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return map[status] ?? 'bg-muted text-muted-foreground';
}

export function HrRecruitmentVacancyCards({
  vacancies,
  isLoading,
  onEdit,
  onCreate,
  message,
}: {
  vacancies: RecruitmentVacancy[];
  isLoading?: boolean;
  onEdit: (id: string) => void;
  onCreate: () => void;
  message?: string;
}) {
  const qc = useQueryClient();

  const publishMut = useMutation({
    mutationFn: (id: string) => updateRecruitmentVacancyStatus(id, 'PUBLISHED'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hr', 'recruitment'] }),
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => updateRecruitmentVacancyStatus(id, 'CLOSED'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hr', 'recruitment'] }),
  });

  const cloneMut = useMutation({
    mutationFn: (v: RecruitmentVacancy) =>
      createRecruitmentVacancy({
        title: `${v.title} (Copy)`,
        staffType: v.staffType,
        vacanciesCount: v.vacanciesCount,
        description: v.description,
        departmentId: v.departmentId ?? undefined,
        designationId: v.designationId ?? undefined,
        qualificationRequired: v.qualificationRequired,
        experienceRequired: v.experienceRequired,
        salaryMin: v.salaryMin != null ? Number(v.salaryMin) : undefined,
        salaryMax: v.salaryMax != null ? Number(v.salaryMax) : undefined,
        closingDate: v.closingDate?.slice(0, 10),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hr', 'recruitment'] }),
    onError: (e) => alert(apiErrorMessage(e, 'Clone failed')),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!vacancies.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-gradient-to-br from-blue-50/80 to-slate-50/50 px-8 py-16 text-center dark:from-blue-950/20 dark:to-slate-950/30">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Briefcase className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">No vacancies yet</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Create your first vacancy to start receiving applications on the careers portal.
        </p>
        <Button className="mt-6" onClick={onCreate}>
          + Create First Vacancy
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {vacancies.map((v) => {
          const apps = v._count?.applications ?? 0;
          const closing = v.closingDate
            ? new Date(v.closingDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : null;
          return (
            <article
              key={v.id}
              className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#1e3a5f] to-[#c8102e]" />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold leading-snug">{v.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {v.department?.name ?? 'General'}
                    {v.designation?.label ? ` · ${v.designation.label}` : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                    statusBadge(v.status),
                  )}
                >
                  {v.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  {v.vacanciesCount} position{v.vacanciesCount === 1 ? '' : 's'}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {apps} application{apps === 1 ? '' : 's'}
                </div>
                {closing ? (
                  <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Deadline: {closing}
                  </div>
                ) : null}
              </div>

              {v.qualificationRequired ? (
                <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                  {v.qualificationRequired}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                {v.status === 'DRAFT' ? (
                  <Button
                    size="sm"
                    onClick={() => publishMut.mutate(v.id)}
                    disabled={publishMut.isPending}
                  >
                    Publish
                  </Button>
                ) : null}
                {v.status === 'PUBLISHED' && v.slug ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/careers-portal/jobs/${v.slug}`} target="_blank">
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      View
                    </Link>
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => onEdit(v.id)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => cloneMut.mutate(v)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Clone
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/hr/recruitment?tab=applications&vacancy=${v.id}`}>
                        <Download className="mr-2 h-4 w-4" />
                        View Applicants
                      </Link>
                    </DropdownMenuItem>
                    {v.status !== 'CLOSED' ? (
                      <DropdownMenuItem
                        onClick={() => closeMut.mutate(v.id)}
                        className="text-destructive"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Close Vacancy
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
