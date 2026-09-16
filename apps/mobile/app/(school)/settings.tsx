import { Alert, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SchoolCard, SchoolShell } from '@/components/school-sis/school-shell';
import { schoolQueryClient } from '@/api/query-client';
import { schoolUi } from '@/theme/school-ui';

export default function SchoolSettingsScreen() {
  const router = useRouter();
  return (
    <SchoolShell title="Settings">
      <SchoolCard>
        <Text style={{ fontWeight: '700' }}>Theme</Text>
        <Text style={{ color: schoolUi.colors.muted, marginTop: 4 }}>
          Follows system light / dark.
        </Text>
      </SchoolCard>
      <SchoolCard>
        <Text style={{ fontWeight: '700' }}>Notifications</Text>
        <Text style={{ color: schoolUi.colors.muted, marginTop: 4 }}>
          Push delivery is registered with the school ERP after login.
        </Text>
      </SchoolCard>
      <Pressable
        onPress={() => {
          schoolQueryClient.clear();
          Alert.alert('Cache cleared');
        }}
      >
        <Text style={{ color: schoolUi.colors.primary, fontWeight: '700', textAlign: 'center' }}>
          Clear cache
        </Text>
      </Pressable>
      <Pressable onPress={() => router.push('/(auth)/change-password')}>
        <Text
          style={{
            color: schoolUi.colors.primary,
            fontWeight: '700',
            textAlign: 'center',
            marginTop: 12,
          }}
        >
          Change password
        </Text>
      </Pressable>
    </SchoolShell>
  );
}
