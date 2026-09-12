import { EmptyState, Screen } from '@/ui/kit';

export default function AcademicsScreen() {
  return (
    <Screen title="Academics" onBack>
      <EmptyState
        title="Class work will appear here"
        body="Subjects, syllabus and results will show in the app after the school publishes them in the ERP."
      />
    </Screen>
  );
}
