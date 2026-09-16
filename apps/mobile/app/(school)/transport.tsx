import { SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { useSchoolSession } from '@/store/school-session';

export default function SchoolTransportScreen() {
  const features = useSchoolSession((s) => s.features);
  return (
    <SchoolShell title="Transport">
      {features.transport === false ? (
        <SchoolEmpty title="Transport is disabled" />
      ) : (
        <SchoolEmpty
          title="No route assigned"
          body="Vehicle, driver, stop and pickup time appear when transport is linked to this student."
        />
      )}
    </SchoolShell>
  );
}
