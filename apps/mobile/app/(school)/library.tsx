import { SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { useSchoolSession } from '@/store/school-session';

export default function SchoolLibraryScreen() {
  const features = useSchoolSession((s) => s.features);
  return (
    <SchoolShell title="Library">
      {features.library === false ? (
        <SchoolEmpty
          title="Library is disabled"
          body="This school has not enabled the library module."
        />
      ) : (
        <SchoolEmpty
          title="No books issued"
          body="Issued copies, due dates and fines will show here."
        />
      )}
    </SchoolShell>
  );
}
