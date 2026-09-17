import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { EmptyState, Loader, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

type Me = {
  email?: string;
  student?: {
    fullName?: string;
    admissionNumber?: string;
    classLabel?: string | null;
    photoUrl?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    bloodGroup?: string | null;
  } | null;
};

const ROWS: Array<{
  key: keyof NonNullable<Me['student']> | 'accountEmail';
  label: string;
  icon: string;
  tint: string;
}> = [
  { key: 'fullName', label: 'Full Name', icon: '👤', tint: '#dbeafe' },
  { key: 'admissionNumber', label: 'Admission Number', icon: '🪪', tint: '#f3e8ff' },
  { key: 'classLabel', label: 'Class', icon: '🎓', tint: '#dcfce7' },
  { key: 'gender', label: 'Gender', icon: '⚧', tint: '#fce7f3' },
  { key: 'dateOfBirth', label: 'Date of Birth', icon: '📅', tint: '#dbeafe' },
  { key: 'bloodGroup', label: 'Blood Group', icon: '🩸', tint: '#fee2e2' },
  { key: 'phone', label: 'Phone', icon: '📞', tint: '#ccfbf1' },
  { key: 'accountEmail', label: 'Email', icon: '✉️', tint: '#ede9fe' },
  { key: 'address', label: 'Address', icon: '📍', tint: '#fef9c3' },
];

function pretty(value?: string | null) {
  if (!value?.trim()) return 'Not provided';
  if (value === value.toUpperCase() && value.length < 16) {
    return value.charAt(0) + value.slice(1).toLowerCase();
  }
  return value;
}

export default function ProfilePersonalScreen() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    apiFetch<Me>('/v1/school-mobile/me')
      .then(setMe)
      .catch(() => setMe({}));
  }, []);

  if (!me) {
    return (
      <Screen title="Personal Information" onBack navy>
        <Loader />
      </Screen>
    );
  }

  const s = me.student;
  if (!s) {
    return (
      <Screen title="Personal Information" onBack navy>
        <EmptyState
          title="No student profile"
          body="Personal details appear here after the school office links this login to a student."
        />
      </Screen>
    );
  }

  const name = s.fullName || 'Student';
  const photo = s.photoUrl;
  const dob = s.dateOfBirth
    ? new Date(s.dateOfBirth).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Not provided';

  const values: Record<string, string> = {
    fullName: s.fullName || 'Not provided',
    admissionNumber: s.admissionNumber || 'Not provided',
    classLabel: s.classLabel || 'Not provided',
    gender: pretty(s.gender),
    dateOfBirth: dob,
    bloodGroup: s.bloodGroup || 'Not provided',
    phone: s.phone || 'Not provided',
    accountEmail: s.email || me.email || 'Not provided',
    address: s.address || 'Not provided',
  };

  return (
    <Screen title="Personal Information" onBack navy>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View>
            {photo ? (
              <Image source={{ uri: mediaUrl(photo) }} style={styles.photo} />
            ) : (
              <View style={styles.fallback}>
                <Text style={styles.letter}>{name.charAt(0)}</Text>
              </View>
            )}
            <View style={styles.cam}>
              <Text style={styles.camText}>📷</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name.toUpperCase()}</Text>
            {s.admissionNumber ? <Text style={styles.meta}>{s.admissionNumber}</Text> : null}
            {s.classLabel ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>Class: {s.classLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.list}>
          {ROWS.map((row) => (
            <View key={row.key} style={styles.row}>
              <View style={[styles.icon, { backgroundColor: row.tint }]}>
                <Text style={{ fontSize: 16 }}>{row.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{row.label}</Text>
                <Text style={styles.value}>{values[row.key]}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteIcon}>ℹ️</Text>
          <Text style={styles.noteText}>
            Photo and name changes are updated by the school office.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 36, gap: 14, backgroundColor: '#eef3fb' },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  photo: { width: 84, height: 84, borderRadius: 42 },
  fallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { color: '#fff', fontSize: 30, fontWeight: '800' },
  cam: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  camText: { fontSize: 11 },
  name: { fontSize: 16, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, marginTop: 4, fontWeight: '600' },
  chip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#e0e7ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: colors.navy, fontWeight: '800', fontSize: 12 },
  list: { backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 8, paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'flex-start',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  value: { color: colors.ink, fontSize: 15, fontWeight: '800', marginTop: 2 },
  note: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#e8f0fe',
    borderRadius: 16,
    padding: 12,
    alignItems: 'flex-start',
  },
  noteIcon: { fontSize: 16, marginTop: 1 },
  noteText: { flex: 1, color: colors.navy, fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
