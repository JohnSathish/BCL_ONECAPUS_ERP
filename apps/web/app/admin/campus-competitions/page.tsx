import { CampusCompetitionsWorkspace } from '@/components/campus-competitions/campus-competitions-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function AdminCampusCompetitionsPage() {
  return (
    <DashboardShell role="admin" title="Campus Competitions">
      <CampusCompetitionsWorkspace />
    </DashboardShell>
  );
}
