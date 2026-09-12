import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { Card, Loader, Row, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

type Me = {
  displayName?: string;
  email?: string;
  student?: {
    fullName?: string;
    admissionNumber?: string;
    classLabel?: string | null;
    photoUrl?: string | null;
    phone?: string | null;
    gender?: string | null;
    guardians?: Array<{ fullName: string; relation: string; phone?: string | null }>;
  } | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    apiFetch<Me>('/v1/school-mobile/me')
      .then(setMe)
      .catch(() => setMe({}));
  }, []);

  if (!me) {
    return (
      <Screen title="My Profile" onBack>
        <Loader />
      </Screen>
    );
  }

  const name = me.student?.fullName || me.displayName || 'Student';
  const photo = me.student?.photoUrl;

  return (
    <Screen title="My Profile" onBack>
      <View style={{ padding: 16, gap: 16, alignItems: 'center' }}>
        {photo ? (
          <Image source={{ uri: mediaUrl(photo) }} style={styles.photo} />
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.letter}>{name.charAt(0)}</Text>
          </View>
        )}
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>
          {[
            me.student?.classLabel,
            me.student?.admissionNumber ? `Admission No. ${me.student.admissionNumber}` : null,
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </Text>
        <Card>
          <Row icon="👤" label="Personal Information" onPress={() => undefined} />
          <Row icon="👨‍👩‍👧" label="Parent/Guardian Details" onPress={() => undefined} />
          <Row icon="📘" label="Academic Information" onPress={() => router.push('/academics')} />
          <Row icon="✅" label="Attendance" onPress={() => router.push('/attendance')} />
          <Row icon="📄" label="Documents" onPress={() => router.push('/school')} />
          <Row icon="⚙️" label="Settings" onPress={() => router.push('/password')} />
          <Row icon="🚪" label="Logout" danger onPress={() => router.push('/(tabs)/more')} />
        </Card>
        {me.student?.guardians?.length ? (
          <Card>
            {me.student.guardians.map((g) => (
              <Text key={g.fullName} style={styles.guard}>
                {g.fullName} · {g.relation}
                {g.phone ? ` · ${g.phone}` : ''}
              </Text>
            ))}
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: 96, height: 96, borderRadius: 48 },
  fallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { color: '#fff', fontSize: 36, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, textAlign: 'center' },
  guard: { color: colors.ink, fontWeight: '600' },
});
