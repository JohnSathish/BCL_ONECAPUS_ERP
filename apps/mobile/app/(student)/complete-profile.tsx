import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  fetchMyProfileBootstrap,
  submitMyProfileChanges,
  type ProfileBootstrap,
} from '@/services/student-profile';

const AADHAAR_RE = /^\d{12}$/;
const MOBILE_RE = /^(\+?\d{1,3}[- ]?)?\d{10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CompleteProfileScreen() {
  const [bootstrap, setBootstrap] = useState<ProfileBootstrap | null>(null);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const data = await fetchMyProfileBootstrap();
    setBootstrap(data);
    const personal = data.sections?.personal ?? {};
    setMobile(String(personal.mobileNumber ?? ''));
    setEmail(String(personal.email ?? ''));
    setAadhaar(String(personal.nationalId ?? ''));
  }

  useEffect(() => {
    void refresh().catch(() => setMessage('Could not load profile'));
  }, []);

  async function onSave() {
    setSaving(true);
    setMessage('');
    try {
      if (mobile && !MOBILE_RE.test(mobile.replace(/\s/g, ''))) {
        throw new Error('Enter a valid 10-digit mobile number');
      }
      if (email && !EMAIL_RE.test(email)) {
        throw new Error('Enter a valid email address');
      }
      if (aadhaar && !AADHAAR_RE.test(aadhaar.replace(/\s/g, ''))) {
        throw new Error('Aadhaar must be exactly 12 digits');
      }
      await submitMyProfileChanges([
        { sectionKey: 'personal', fieldKey: 'mobileNumber', newValue: mobile || null },
        { sectionKey: 'personal', fieldKey: 'email', newValue: email || null },
        {
          sectionKey: 'personal',
          fieldKey: 'nationalId',
          newValue: aadhaar.replace(/\s/g, '') || null,
        },
      ]);
      setMessage(
        'Submitted. Auto-approve fields apply immediately; Aadhaar awaits office verification.',
      );
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const completion = bootstrap?.completion;
  const student = bootstrap?.student;

  return (
    <StudentScreenShell title="Complete Profile" subtitle="Update permitted personal details">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          {student?.fullName ? <Text style={styles.name}>{student.fullName}</Text> : null}
          <Text style={styles.meta}>
            {[student?.rollNumber, student?.programme].filter(Boolean).join(' · ') || ' '}
          </Text>
          <Text style={styles.heading}>
            {completion ? `${completion.percent}% complete` : 'Loading…'}
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${completion?.percent ?? 0}%` }]} />
          </View>
          {(completion?.missing ?? []).map((m) => (
            <Text key={m.key} style={styles.missing}>
              • {m.label}
            </Text>
          ))}
          {bootstrap?.verificationStatus ? (
            <Text style={styles.status}>Status: {bootstrap.verificationStatus}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Mobile Number *</Text>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={(t) => setMobile(t.replace(/[^\d+]/g, '').slice(0, 13))}
            keyboardType="phone-pad"
          />
          <Text style={styles.label}>Personal Email *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={styles.label}>Aadhaar Number *</Text>
          <TextInput
            style={styles.input}
            value={aadhaar}
            onChangeText={(t) => setAadhaar(t.replace(/\D/g, '').slice(0, 12))}
            keyboardType="number-pad"
            maxLength={12}
          />
          <Pressable style={styles.button} onPress={() => void onSave()} disabled={saving}>
            <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save & Submit'}</Text>
          </Pressable>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: studentTheme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 8,
  },
  name: { fontSize: 18, fontWeight: '700', color: studentTheme.text },
  meta: { fontSize: 13, color: studentTheme.muted, marginBottom: 4 },
  heading: { fontSize: 16, fontWeight: '600', color: studentTheme.text },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: studentTheme.border,
    overflow: 'hidden',
    marginVertical: 4,
  },
  barFill: { height: '100%', backgroundColor: studentTheme.primary },
  missing: { color: studentTheme.muted, fontSize: 13 },
  status: { marginTop: 6, fontSize: 12, color: studentTheme.muted },
  label: { marginTop: 8, fontSize: 13, fontWeight: '600', color: studentTheme.text },
  input: {
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: studentTheme.text,
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 16,
    backgroundColor: studentTheme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  message: { marginTop: 8, fontSize: 13, color: studentTheme.muted },
});
