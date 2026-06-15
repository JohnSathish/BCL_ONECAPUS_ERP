'use client';

import { OperationsCommandCenter } from '@/components/dashboard/operations-command-center';

/** Admin home — operations command center (action-first). */
export function AdminDashboard({ userName }: { userName?: string }) {
  return <OperationsCommandCenter userName={userName} />;
}
