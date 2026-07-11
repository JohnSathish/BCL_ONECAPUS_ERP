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

export default function StudentCertificatesScreen() {
  const [categories, setCategories] = useState<CertificateCategory[]>([]);
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [issues, setIssues] = useState<CertificateIssue[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const onRequest = async () => {
    if (!studentId || !selectedCategoryId) {
      Alert.alert('Certificates', 'Select a certificate type first.');
      return;
    }
    const cat = categories.find((c) => c.id === selectedCategoryId);
    if (!cat) return;
    setSubmitting(true);
    try {
      await createMyCertificateRequest({
        categoryId: cat.id,
        studentId,
        requestType: cat.code || 'CUSTOM',
        purpose: 'Student certificate request',
      });
      Alert.alert(
        'Requested',
        'Your certificate request was submitted. After approval and fee payment, collect it from the college office. Download is not available in the app.',
      );
      setSelectedCategoryId(null);
      await load();
    } catch (e) {
      Alert.alert('Request failed', e instanceof Error ? e.message : 'Could not submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StudentScreenShell title="Certificates" subtitle="Request to office">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            You can request a certificate here. Online download is disabled — pay the certificate
            fee and collect from the college office after approval.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>New request</Text>
          {categories.map((c) => {
            const on = selectedCategoryId === c.id;
            return (
              <Pressable
                key={c.id}
                style={[styles.option, on && styles.optionOn]}
                onPress={() => setSelectedCategoryId(c.id)}
              >
                <Text style={[styles.optionText, on && styles.optionTextOn]}>{c.name}</Text>
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.btn, (!selectedCategoryId || submitting) && styles.btnDisabled]}
            disabled={!selectedCategoryId || submitting}
            onPress={() => void onRequest()}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Submit request</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>My requests</Text>
          {requests.length === 0 ? (
            <Text style={styles.muted}>No requests yet.</Text>
          ) : (
            requests.map((r) => (
              <View key={r.id} style={styles.row}>
                <Text style={styles.rowTitle}>{r.category?.name ?? r.requestType}</Text>
                <Text style={styles.muted}>{r.status}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Issued (office collection)</Text>
          {issues.length === 0 ? (
            <Text style={styles.muted}>None issued yet.</Text>
          ) : (
            issues.map((i) => (
              <View key={i.id} style={styles.row}>
                <Text style={styles.rowTitle}>{i.certificateNo}</Text>
                <Text style={styles.muted}>
                  {i.category?.name ?? 'Certificate'} · {i.status}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  notice: {
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 12,
  },
  noticeText: { fontSize: 12, lineHeight: 17, color: '#92400e' },
  card: {
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
    gap: 8,
  },
  section: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  option: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
  },
  optionOn: { borderColor: studentTheme.primary, backgroundColor: '#eff6ff' },
  optionText: { fontSize: 13, fontWeight: '600', color: studentTheme.text },
  optionTextOn: { color: studentTheme.primary },
  btn: {
    marginTop: 6,
    backgroundColor: studentTheme.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700' },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 2 },
  rowTitle: { fontWeight: '600', fontSize: 13 },
  muted: { fontSize: 12, color: studentTheme.textMuted },
});
