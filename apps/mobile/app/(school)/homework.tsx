import { SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { useSchoolSession } from '@/store/school-session';

export default function SchoolHomeworkScreen() {
  const features = useSchoolSession((s) => s.features);
  return (
    <SchoolShell title="Homework">
      {features.homework === false ? (
        <SchoolEmpty title="Homework is disabled for this school" />
      ) : (
        <SchoolEmpty title="No assignments" body="Pending and submitted work will list here." />
      )}
    </SchoolShell>
  );
}
