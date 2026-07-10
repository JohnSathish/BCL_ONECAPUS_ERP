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

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push('/(student)/complete-profile' as never)}
    >
      <Text style={styles.title}>Complete Your Profile</Text>
      <Text style={styles.body}>
        Your profile is {completion.percent}% complete. Please complete your profile to keep records
        accurate.
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${completion.percent}%` }]} />
      </View>
      {completion.missing?.length ? (
        <Text style={styles.missing} numberOfLines={2}>
          Pending: {completion.missing.map((m) => m.label).join(', ')}
        </Text>
      ) : null}
      <Text style={styles.cta}>Complete Now →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: studentTheme.surface,
    borderColor: studentTheme.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  title: { color: studentTheme.text, fontSize: 16, fontWeight: '700' },
  body: { color: studentTheme.textMuted, fontSize: 13, marginTop: 6, lineHeight: 18 },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginTop: 12,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: studentTheme.primary ?? '#1D4ED8' },
  missing: { color: studentTheme.textMuted, fontSize: 12, marginTop: 8 },
  cta: { color: studentTheme.primary ?? '#1D4ED8', fontWeight: '700', marginTop: 10 },
});
