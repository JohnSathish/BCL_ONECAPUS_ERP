import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  createMyCertificateRequest,
  fetchCertificateCategories,
  fetchMyCertificateIssues,
  fetchMyCertificateProfile,
  fetchMyCertificateRequests,
  type CertificateCategory,
  type CertificateIssue,
  type CertificateRequest,
} from '@/services/certificates';

const CATEGORY_META: Record<string, { icon: string; tint: string; description: string }> = {
  COURSE_COMPLETION: {
    icon: '📘',
    tint: '#DBEAFE',
    description: 'Certificate of successful course completion',
  },
  DEGREE: { icon: '🎓', tint: '#D1FAE5', description: 'Final degree certificate' },
  PROVISIONAL: { icon: '📄', tint: '#EDE9FE', description: 'Provisional degree certificate' },
  MERIT: { icon: '🏅', tint: '#FEF3C7', description: 'Certificate for academic merit' },
  NCC: { icon: '👥', tint: '#FCE7F3', description: 'National Cadet Corps certificate' },
  NSS: { icon: '👥', tint: '#DBEAFE', description: 'National Service Scheme certificate' },
  SPORTS: { icon: '🏆', tint: '#D1FAE5', description: 'Certificate for sports achievements' },
  MARKSHEET: { icon: '📋', tint: '#EDE9FE', description: 'Sem-wise / consolidated marksheet' },
  TRANSCRIPT: { icon: '📊', tint: '#FCE7F3', description: 'Academic transcript' },
  RECOMMENDATION: { icon: '✉️', tint: '#E0F2FE', description: 'Letter of recommendation' },
  RESEARCH_PROJECT: {
    icon: '📙',
    tint: '#FFEDD5',
    description: 'Certificate for research projects',
  },
  INTERNSHIP: { icon: '💼', tint: '#FEF3C7', description: 'Internship completion certificate' },
  BONAFIDE: { icon: '✅', tint: '#D1FAE5', description: 'Bonafide certificate for official use' },
  STUDY: { icon: '📚', tint: '#DBEAFE', description: 'Study certificate' },
  CONDUCT: { icon: '⭐', tint: '#FEF3C7', description: 'Conduct certificate' },
  CHARACTER: { icon: '⭐', tint: '#EDE9FE', description: 'Character certificate' },
  MIGRATION: { icon: '➡️', tint: '#E0F2FE', description: 'Migration certificate' },
  TRANSFER: { icon: '🏫', tint: '#FFEDD5', description: 'Transfer certificate' },
  WORKSHOP: { icon: '🛠️', tint: '#F3F4F6', description: 'Workshop certificate' },
  SKILL: { icon: '💡', tint: '#FEF3C7', description: 'Skill development certificate' },
  SHORT_TERM_COMPLETION: {
    icon: '📘',
    tint: '#DBEAFE',
    description: 'Short-term course completion certificate',
  },
};

function categoryLook(code?: string) {
  const key = String(code ?? '').toUpperCase();
  return (
    CATEGORY_META[key] ?? {
      icon: '📄',
      tint: '#F3F4F6',
      description: 'Request this certificate from the college office',
    }
  );
}

export default function StudentCertificatesScreen() {
  const [categories, setCategories] = useState<CertificateCategory[]>([]);
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [issues, setIssues] = useState<CertificateIssue[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, cats, reqs, iss] = await Promise.all([
        fetchMyCertificateProfile(),
        fetchCertificateCategories(),
        fetchMyCertificateRequests(),
        fetchMyCertificateIssues(),
      ]);
      setStudentId(profile.studentId);
      setCategories((cats ?? []).filter((c) => c.isActive !== false));
      setRequests(reqs ?? []);
      setIssues(iss ?? []);
    } catch (e) {
      Alert.alert('Certificates', e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function latestRequest(categoryId: string) {
    return requests.find((request) => request.category?.id === categoryId);
  }

  function onRequest(category: CertificateCategory) {
    if (!studentId) {
      Alert.alert('Certificates', 'Your student profile is not ready yet.');
      return;
    }
    Alert.alert(
      category.name,
      'Submit this request? After approval, pay the certificate fee and collect it from the college office.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: () => void submit(category),
        },
      ],
    );
  }

  async function submit(category: CertificateCategory) {
    if (!studentId) return;
    setSubmittingId(category.id);
    try {
      await createMyCertificateRequest({
        categoryId: category.id,
        studentId,
        requestType: category.code || 'CUSTOM',
        purpose: 'Student certificate request',
      });
      Alert.alert(
        'Requested',
        'Your certificate request was submitted. After approval and fee payment, collect it from the college office. Download is not available in the app.',
      );
      await load();
    } catch (e) {
      Alert.alert('Request failed', e instanceof Error ? e.message : 'Could not submit');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <StudentScreenShell title="Certificates" subtitle="Request to office">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Important Information</Text>
          <Text style={styles.noticeText}>
            You can request a certificate here. Online download is disabled — pay the certificate
            fee and collect from the college office after approval.
          </Text>
        </View>

        <Text style={styles.heading}>Request a Certificate</Text>
        <Text style={styles.subheading}>Select the certificate you need to request</Text>

        {loading && categories.length === 0 ? (
          <ActivityIndicator color={studentTheme.primary} />
        ) : null}

        {categories.map((category) => {
          const look = categoryLook(category.code);
          const existing = latestRequest(category.id);
          const busy = submittingId === category.id;
          return (
            <Pressable
              key={category.id}
              style={styles.row}
              disabled={busy}
              onPress={() => onRequest(category)}
            >
              <View style={[styles.iconBubble, { backgroundColor: look.tint }]}>
                <Text style={styles.icon}>{look.icon}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.title}>{category.name}</Text>
                <Text style={styles.description}>{look.description}</Text>
                {existing ? (
                  <Text style={styles.status}>Latest request: {existing.status}</Text>
                ) : null}
              </View>
              {busy ? (
                <ActivityIndicator color={studentTheme.primary} />
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </Pressable>
          );
        })}

        {!loading && categories.length === 0 ? (
          <Text style={styles.muted}>No certificate types are open for requests right now.</Text>
        ) : null}

        <Text style={styles.heading}>My requests</Text>
        {requests.length === 0 ? (
          <Text style={styles.muted}>No requests yet.</Text>
        ) : (
          requests.map((request) => (
            <View key={request.id} style={styles.plainRow}>
              <Text style={styles.title}>{request.category?.name ?? request.requestType}</Text>
              <Text style={styles.status}>{request.status}</Text>
            </View>
          ))
        )}

        <Text style={styles.heading}>Issued for office collection</Text>
        {issues.length === 0 ? (
          <Text style={styles.muted}>None issued yet.</Text>
        ) : (
          issues.map((issue) => (
            <View key={issue.id} style={styles.plainRow}>
              <Text style={styles.title}>{issue.category?.name ?? 'Certificate'}</Text>
              <Text style={styles.status}>
                {issue.certificateNo} · {issue.status}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 40 },
  notice: {
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  noticeTitle: { fontSize: 13, fontWeight: '800', color: '#92400E' },
  noticeText: { fontSize: 12, lineHeight: 17, color: '#92400E' },
  heading: { fontSize: 16, fontWeight: '800', color: studentTheme.text, marginTop: 6 },
  subheading: { fontSize: 12, color: studentTheme.textMuted, marginTop: -4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '800', color: studentTheme.text },
  description: { fontSize: 12, color: studentTheme.textMuted, lineHeight: 16 },
  status: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  chevron: { fontSize: 22, color: '#9CA3AF', fontWeight: '600' },
  muted: { fontSize: 13, color: studentTheme.textMuted },
  plainRow: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    gap: 2,
  },
});
