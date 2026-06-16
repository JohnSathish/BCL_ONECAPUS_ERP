'use client';

import { useState } from 'react';
import { NaacWorkspace } from '@/components/naac-iqac-module/naac-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { cn } from '@/utils/cn';

type StaffNaacTab = 'department' | 'faculty';

const TABS: { id: StaffNaacTab; label: string }[] = [
  { id: 'department', label: 'Department' },
  { id: 'faculty', label: 'My Achievements' },
];

export default function StaffNaacPage() {
  const session = useRequireAuth();
  const [tab, setTab] = useState<StaffNaacTab>('department');

  if (!session) return null;

  return (
    <DashboardShell role="staff" title="NAAC & IQAC Portal">
      <div className="mb-4 flex flex-wrap gap-2 border-b pb-3">
        {TABS.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? 'default' : 'ghost'}
            size="sm"
            className={cn(tab !== t.id && 'text-muted-foreground')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <NaacWorkspace page={tab} portalMode />
    </DashboardShell>
  );
}
