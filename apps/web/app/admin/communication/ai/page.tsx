import { SaaSCard } from '@/components/dashboard/command-center-ui';

export default function AiAssistantPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">OneCampus AI Communication Assistant</h1>
      <SaaSCard>
        <p className="text-sm text-muted-foreground">Phase 2 — Coming soon</p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>&quot;Create fee reminder for all Semester 3 students.&quot;</li>
          <li>&quot;Create meeting reminder for IQAC committee.&quot;</li>
          <li>&quot;Send attendance warning to students below 75%.&quot;</li>
        </ul>
      </SaaSCard>
    </div>
  );
}
