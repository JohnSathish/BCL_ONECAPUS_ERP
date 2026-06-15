'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  FileCheck,
  GraduationCap,
  Layers,
  Settings2,
  Trophy,
  Users,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchAdmissionsSummary } from '@/services/admissions';

const QUICK_LINKS = [
  {
    href: '/admin/admissions/applications',
    label: 'Application form',
    description: 'Review all portal applications with approve/reject actions.',
    icon: ClipboardList,
  },
  {
    href: '/admin/admissions/documents',
    label: 'Document verification',
    description: 'Queue of applications with pending document checks.',
    icon: FileCheck,
  },
  {
    href: '/admin/admissions/payments',
    label: 'Payment verification',
    description: 'Submitted applications awaiting fee confirmation.',
    icon: CreditCard,
  },
  {
    href: '/admin/admissions/admission-fees',
    label: 'Admission fee verification',
    description: 'Allotted applicants with admission fee pending.',
    icon: CreditCard,
  },
  {
    href: '/admin/admissions/merit',
    label: 'Merit & selection',
    description: 'Generate merit lists, publish ranks, run seat allocation.',
    icon: Trophy,
  },
  {
    href: '/admin/admissions/admitted',
    label: 'Admitted students',
    description: 'Allotted applicants ready to enroll into student records.',
    icon: GraduationCap,
  },
  {
    href: '/admin/admissions/intakes',
    label: 'Intakes',
    description: 'Program intakes and seat capacity for this cycle.',
    icon: Layers,
  },
  {
    href: '/admin/admissions/cycles',
    label: 'Cycles & settings',
    description: 'Fees, deadlines, help desk, and seat matrix.',
    icon: Settings2,
  },
  {
    href: '/admin/admissions/analytics',
    label: 'Analytics',
    description: 'Funnel metrics and exportable admission reports.',
    icon: BarChart3,
  },
] as const;

export default function AdminAdmissionsControlCenterPage() {
  const session = useRequireAuth();

  const summary = useQuery({
    queryKey: ['admissions', 'summary'],
    queryFn: fetchAdmissionsSummary,
    enabled: Boolean(session),
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Admissions">
      <div className="space-y-6 pb-8">
        <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-primary/5 via-card to-accent/5 p-4 md:p-5">
          <p className="text-sm text-muted-foreground">Don Bosco ERP · Online admission</p>
          <h2 className="text-xl font-semibold tracking-tight">Admission control center</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Manage the full admission workflow — applications, verification, merit, and enrollment —
            from one workspace.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link href="/admin/admissions/applications">Open application list</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Intakes" value={summary.data?.intakes} />
          <Stat label="Applications" value={summary.data?.applications} />
          <Stat label="Pending review" value={summary.data?.pendingReview} />
          <Stat label="Published merit lists" value={summary.data?.publishedMeritLists} />
          <Stat label="Active allocations" value={summary.data?.activeAllocations} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {QUICK_LINKS.map(({ href, label, description, icon: Icon }) => (
            <Card key={href} className="glass-card border-0 transition hover:border-primary/20">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{label}</CardTitle>
                </div>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" asChild>
                  <Link href={href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Applicant portal
            </CardTitle>
            <CardDescription>
              Applicants register and complete forms on the admissions portal. Use Application form
              above to review submissions.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value ?? '—'}</p>
    </div>
  );
}
