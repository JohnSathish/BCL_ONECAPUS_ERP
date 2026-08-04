import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { principalTheme } from '@/components/principal-portal/theme';

export default function PrincipalLeaveDetailScreen() {
  const router = useRouter();
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();

  return (
    <PrincipalScreenShell
      title="Leave request"
      subtitle={kind === 'student' ? 'Student' : 'Staff'}
      rightSlot={
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
      }
    >
      <View style={styles.box}>
        <Text style={styles.meta}>Request ID</Text>
        <Text style={styles.id}>{id}</Text>
        <Text style={styles.hint}>
          Use Approve / Reject on the Approvals tab to action this request.
        </Text>
        <Pressable
          style={styles.btn}
          onPress={() => router.replace('/(principal)/(tabs)/approvals' as Href)}
        >
          <Text style={styles.btnText}>Open Approvals</Text>
        </Pressable>
      </View>
    </PrincipalScreenShell>
  );
}

const styles = StyleSheet.create({
  box: { padding: 16, gap: 8 },
  meta: { fontSize: 12, color: principalTheme.textMuted, fontWeight: '700' },
  id: { fontSize: 14, color: principalTheme.text, fontFamily: 'monospace' },
  hint: { fontSize: 13, color: principalTheme.textMuted, lineHeight: 20, marginTop: 8 },
  btn: {
    marginTop: 12,
    backgroundColor: principalTheme.primaryAccent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
  back: { color: principalTheme.primaryAccent, fontWeight: '700' },
});
