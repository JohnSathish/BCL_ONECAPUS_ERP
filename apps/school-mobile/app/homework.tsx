import { EmptyState, Screen } from '@/ui/kit';

export default function HomeworkScreen() {
  return (
    <Screen title="Homework" onBack>
      <EmptyState
        title="No homework in the app yet"
        body="Teachers will assign homework from the school ERP. Until then, check classroom notices."
      />
    </Screen>
  );
}
