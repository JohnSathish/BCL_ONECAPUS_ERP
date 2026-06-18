import { ApprovalsInbox } from '@/components/communication/approvals/approvals-inbox';

export default function ApprovalsPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Message Approval Workflow</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Circulars, student notices, and mass messages require Staff → HOD → Principal approval.
      </p>
      <ApprovalsInbox />
    </div>
  );
}
