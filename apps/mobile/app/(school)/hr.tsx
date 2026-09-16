import { useQuery } from '@tanstack/react-query';
import { Text } from 'react-native';
import { fetchSchoolHrMe } from '@/api/school-mobile';
import { SchoolCard, SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { hideStaffAdminModules } from '@/features/school/permissions';
import { useSchoolSession } from '@/store/school-session';
import { schoolUi } from '@/theme/school-ui';

export default function SchoolHrScreen() {
  const persona = useSchoolSession((s) => s.persona);
  const q = useQuery({
    queryKey: ['school-hr-me'],
    queryFn: fetchSchoolHrMe,
    enabled: !hideStaffAdminModules(persona),
  });
  if (hideStaffAdminModules(persona)) {
    return (
      <SchoolShell title="HR">
        <SchoolEmpty title="Not available" body="HR is for staff accounts only." />
      </SchoolShell>
    );
  }
  const staff = (q.data?.staff ?? q.data) as Record<string, unknown> | null;
  return (
    <SchoolShell title="My HR" loading={q.isLoading} onRefresh={() => void q.refetch()}>
      {!staff || !Object.keys(staff).length ? (
        <SchoolEmpty title="No HR profile" body="Ask the office to link your staff record." />
      ) : (
        <SchoolCard>
          <Text style={{ fontSize: 20, fontWeight: '800', color: schoolUi.colors.text }}>
            {String(staff.fullName ?? staff.name ?? 'Staff')}
          </Text>
          <Text style={{ color: schoolUi.colors.muted, marginTop: 6 }}>
            {String(staff.designation ?? staff.department ?? '')}
          </Text>
        </SchoolCard>
      )}
    </SchoolShell>
  );
}
