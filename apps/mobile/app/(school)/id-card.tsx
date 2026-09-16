import { StyleSheet, Text, View } from 'react-native';
import { SchoolShell } from '@/components/school-sis/school-shell';
import { useSchoolSession } from '@/store/school-session';
import { schoolUi } from '@/theme/school-ui';

export default function SchoolIdCardScreen() {
  const name = useSchoolSession((s) => s.displayName);
  const schoolName = useSchoolSession((s) => s.schoolName);
  const childId = useSchoolSession((s) => s.childId);
  return (
    <SchoolShell title="Digital ID">
      <View style={styles.card}>
        <Text style={styles.school}>{schoolName || 'School'}</Text>
        <View style={styles.photo} />
        <Text style={styles.name}>{name || 'Student'}</Text>
        <Text style={styles.meta}>Secure ID</Text>
        <View style={styles.qr}>
          <Text style={styles.qrText}>{(childId || 'SLS').slice(0, 8)}</Text>
        </View>
        <Text style={styles.note}>QR contains a school identifier only — not personal data.</Text>
      </View>
    </SchoolShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: schoolUi.colors.primary,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  school: { color: schoolUi.colors.accent, fontWeight: '800', letterSpacing: 1 },
  photo: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#fff', marginVertical: 16 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800' },
  meta: { color: '#c7d2fe', marginTop: 4 },
  qr: {
    marginTop: 18,
    width: 120,
    height: 120,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrText: { fontWeight: '800', color: schoolUi.colors.primary },
  note: { color: '#c7d2fe', fontSize: 12, marginTop: 12, textAlign: 'center' },
});
