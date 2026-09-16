import { SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';

export default function SchoolDocumentsScreen() {
  return (
    <SchoolShell title="Documents">
      <SchoolEmpty
        title="No documents yet"
        body="ID cards, receipts and certificates appear when the office publishes them."
      />
    </SchoolShell>
  );
}
