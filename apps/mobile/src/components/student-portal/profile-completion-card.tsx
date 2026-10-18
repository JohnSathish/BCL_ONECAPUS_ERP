import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchMyProfileCompletion, type ProfileCompletion } from '@/services/student-profile';
import { studentTheme } from '@/components/student-portal/theme';

export function ProfileCompletionCard() {
  const router = useRouter();
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);

  useEffect(() => {
    void fetchMyProfileCompletion()
      .then(setCompletion)
      .catch(() => setCompletion(null));
  }, []);

  if (!completion || completion.percent >= 100) return null;

  const pending = completion.missing?.map((item) => item.label).join(', ');

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.iconBubble}>
          <Text style={styles.icon}>👤</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.body}>
            Your profile is {completion.percent}% complete. Please complete your profile to keep
            records accurate.
          </Text>
        </View>
        <Text style={styles.percent}>{completion.percent}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(completion.percent, 100)}%` }]} />
      </View>
      {pending ? (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingIcon}>📋</Text>
          <Text style={styles.pending}>Pending: {pending}</Text>
        </View>
      ) : null}
      <Pressable
        style={styles.button}
        onPress={() => router.push('/(student)/complete-profile' as never)}
      >
        <Text style={styles.buttonText}>Complete Now →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: studentTheme.surface,
    borderColor: '#E8EEF7',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 16 },
  copy: { flex: 1, gap: 4 },
  title: { color: studentTheme.text, fontSize: 16, fontWeight: '800' },
  body: { color: studentTheme.textMuted, fontSize: 13, lineHeight: 18 },
  percent: { color: '#1D4ED8', fontSize: 18, fontWeight: '800' },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#1D4ED8' },
  pendingBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    alignItems: 'flex-start',
  },
  pendingIcon: { fontSize: 14, marginTop: 1 },
  pending: { flex: 1, color: studentTheme.textMuted, fontSize: 12, lineHeight: 17 },
  button: {
    backgroundColor: '#123A7A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
