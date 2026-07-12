import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { completeFeeCheckout, isExpoGoClient } from '@/payments/checkout';
import {
  addExamBackPaper,
  completeExamOnlinePayment,
  downloadExamReceiptPdf,
  fetchExamFeeSessions,
  fetchMyExamApplications,
  initiateExamOnlinePayment,
  removeExamBackPaper,
  startExamApplication,
  submitExamApplication,
  type ExamApplication,
} from '@/services/examination-fees';
import { formatInr } from '@/utils/currency';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';

const STEPS = ['Subjects', 'Back papers', 'Declare', 'Pay'];

export default function ExaminationFeesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [app, setApp] = useState<ExamApplication | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [step, setStep] = useState(0);
  const [declaration, setDeclaration] = useState(false);
  const [semesterNo, setSemesterNo] = useState('1');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [paperType, setPaperType] = useState<'THEORY_ONLY' | 'THEORY_PRACTICAL'>('THEORY_ONLY');

  const load = useCallback(async () => {
    try {
      const [sessions, mine] = await Promise.all([
        fetchExamFeeSessions(),
        fetchMyExamApplications(),
      ]);
      const active = sessions.find((s) => s.status === 'ACTIVE');
      setActiveSessionId(active?.id ?? null);
      setSessionName(active?.name ?? '');
      const current = mine[0] ?? null;
      setApp(current);
      if (current?.status === 'AWAITING_PAYMENT') setStep(3);
      else if (current?.declarationAccepted) setStep(2);
      else if ((current?.backPapers?.length ?? 0) > 0) setStep(1);
      else setStep(0);
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onStart() {
    if (!activeSessionId) {
      Alert.alert('Unavailable', 'No active examination fee session.');
      return;
    }
    setBusy(true);
    try {
      const created = await startExamApplication(activeSessionId);
      setApp(created);
      setStep(0);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not start');
    } finally {
      setBusy(false);
    }
  }

  async function onPay() {
    if (!app) return;
    if (isExpoGoClient()) {
      Alert.alert(
        'Native build required',
        'Online exam fee payment needs a development/production APK (not Expo Go).',
      );
    }
    setBusy(true);
    try {
      const initiated = await initiateExamOnlinePayment(app.id);
      const checkout = initiated.checkout;
      if (checkout.mode === 'SAFE_MOCK' && checkout.paymentId) {
        const done = await completeExamOnlinePayment(app.id, {
          paymentTransactionId: checkout.paymentTransactionId ?? checkout.paymentId,
        });
        setApp(done.application);
        Alert.alert('Paid', 'Examination fee payment recorded.');
        return;
      }
      const result = await completeFeeCheckout({
        provider: checkout.provider ?? 'RAZORPAY',
        mode: checkout.mode === 'SAFE_MOCK' ? 'SAFE_MOCK' : 'LIVE',
        keyId: checkout.keyId,
        orderId: checkout.orderId ?? '',
        amount: Number(checkout.amount),
        currency: checkout.currency ?? 'INR',
        paymentId: checkout.paymentId,
        checkoutUrl: checkout.checkoutUrl,
        paymentSessionId: checkout.paymentSessionId,
      });
      if (result.success) {
        const done = await completeExamOnlinePayment(app.id, {
          paymentTransactionId: checkout.paymentTransactionId ?? checkout.paymentId,
        });
        setApp(done.application);
        Alert.alert('Paid', result.message);
      } else if (checkout.checkoutUrl) {
        Alert.alert('Complete payment in browser', result.message, [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Verify payment',
            onPress: async () => {
              try {
                const done = await completeExamOnlinePayment(app.id, {
                  paymentTransactionId: checkout.paymentTransactionId ?? checkout.paymentId,
                });
                setApp(done.application);
                Alert.alert('Paid', 'Examination fee payment confirmed.');
                await load();
              } catch (err) {
                Alert.alert(
                  'Not confirmed yet',
                  err instanceof Error
                    ? err.message
                    : 'Finish payment at the gateway, then try Verify again.',
                );
              }
            },
          },
        ]);
      } else {
        Alert.alert('Payment', result.message);
      }
    } catch (e) {
      Alert.alert('Payment failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
      await load();
    }
  }

  if (loading) {
    return (
      <StudentScreenShell title="Exam Fees">
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </StudentScreenShell>
    );
  }

  return (
    <StudentScreenShell title="Exam Fees">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        {message ? <Text style={styles.error}>{message}</Text> : null}
        <Text style={styles.session}>{sessionName || 'Semester examination fees'}</Text>

        {!activeSessionId && !app ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No active exam fee session</Text>
            <Text style={styles.rowMeta}>
              When the college opens semester / NEHU exam fee payment, you can start your
              application and pay from this screen. Pull to refresh, or check Notices for the
              opening date.
            </Text>
          </View>
        ) : null}

        <View style={styles.steps}>
          {STEPS.map((label, idx) => (
            <View key={label} style={[styles.stepChip, step === idx && styles.stepActive]}>
              <Text style={[styles.stepText, step === idx && styles.stepTextActive]}>
                {idx + 1}. {label}
              </Text>
            </View>
          ))}
        </View>

        {!app && activeSessionId ? (
          <Pressable style={styles.primaryBtn} onPress={() => void onStart()} disabled={busy}>
            <Text style={styles.primaryBtnText}>{busy ? 'Starting…' : 'Start application'}</Text>
          </Pressable>
        ) : app ? (
          <>
            <Text style={styles.meta}>
              {app.applicationNo} · Sem {app.currentSemesterNo} · {app.status}
            </Text>

            {step === 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Current subjects</Text>
                {(app.currentSubjects ?? []).map((s) => (
                  <View key={s.id} style={styles.row}>
                    <Text style={styles.rowTitle}>
                      {s.subjectCode} · {s.subjectName}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {s.examPaperType} · {formatInr(Number(s.amount))}
                    </Text>
                  </View>
                ))}
                <Pressable style={styles.primaryBtn} onPress={() => setStep(1)}>
                  <Text style={styles.primaryBtnText}>Continue</Text>
                </Pressable>
              </View>
            ) : null}

            {step === 1 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Back papers</Text>
                {(app.backPapers ?? []).map((p) => (
                  <View key={p.id} style={styles.rowBetween}>
                    <Text style={styles.rowTitle}>
                      Sem {p.semesterNo} · {p.subjectCode}
                    </Text>
                    <Pressable
                      onPress={async () => {
                        const updated = await removeExamBackPaper(app.id, p.id);
                        setApp(updated);
                      }}
                    >
                      <Text style={styles.linkDanger}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={semesterNo}
                  onChangeText={setSemesterNo}
                  placeholder="Semester no"
                />
                <TextInput
                  style={styles.input}
                  value={subjectCode}
                  onChangeText={setSubjectCode}
                  placeholder="Subject code"
                  autoCapitalize="characters"
                />
                <TextInput
                  style={styles.input}
                  value={subjectName}
                  onChangeText={setSubjectName}
                  placeholder="Subject name"
                />
                <View style={styles.rowBetween}>
                  <Text>Theory + Practical</Text>
                  <Switch
                    value={paperType === 'THEORY_PRACTICAL'}
                    onValueChange={(v) => setPaperType(v ? 'THEORY_PRACTICAL' : 'THEORY_ONLY')}
                  />
                </View>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={async () => {
                    const updated = await addExamBackPaper(app.id, {
                      semesterNo: Number(semesterNo) || 1,
                      subjectCode,
                      subjectName,
                      examPaperType: paperType,
                    });
                    setApp(updated);
                    setSubjectCode('');
                    setSubjectName('');
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Add back paper</Text>
                </Pressable>
                <View style={styles.rowBetween}>
                  <Pressable onPress={() => setStep(0)}>
                    <Text style={styles.link}>Back</Text>
                  </Pressable>
                  <Pressable style={styles.primaryBtn} onPress={() => setStep(2)}>
                    <Text style={styles.primaryBtnText}>Continue</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {step === 2 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Declaration</Text>
                <View style={styles.rowBetween}>
                  <Text style={{ flex: 1, paddingRight: 12 }}>
                    I declare backlog papers are correct and may be rejected if wrong.
                  </Text>
                  <Switch value={declaration} onValueChange={setDeclaration} />
                </View>
                <View style={styles.rowBetween}>
                  <Pressable onPress={() => setStep(1)}>
                    <Text style={styles.link}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={styles.primaryBtn}
                    disabled={busy}
                    onPress={async () => {
                      if (['DRAFT', 'CORRECTION_REQUESTED'].includes(app.status)) {
                        setBusy(true);
                        try {
                          const updated = await submitExamApplication(app.id, declaration);
                          setApp(updated);
                          setStep(3);
                        } catch (e) {
                          Alert.alert('Submit failed', e instanceof Error ? e.message : 'Error');
                        } finally {
                          setBusy(false);
                        }
                      } else {
                        setStep(3);
                      }
                    }}
                  >
                    <Text style={styles.primaryBtnText}>
                      {['DRAFT', 'CORRECTION_REQUESTED'].includes(app.status)
                        ? 'Submit'
                        : 'Continue'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {step === 3 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Payment</Text>
                {app.status === 'AWAITING_PAYMENT' ? (
                  <Pressable style={styles.payBtn} disabled={busy} onPress={() => void onPay()}>
                    <Text style={styles.primaryBtnText}>
                      {busy ? 'Processing…' : `Pay ${formatInr(Number(app.totalFee))}`}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.ok}>Status: {app.status}</Text>
                )}
                {(app.receipts ?? [])[0] ? (
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() =>
                      void downloadExamReceiptPdf(app.receipts![0].id, app.receipts![0].receiptNo)
                    }
                  >
                    <Text style={styles.secondaryBtnText}>Download receipt</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={styles.summary}>
              <Text style={styles.cardTitle}>Fee summary</Text>
              <Text>Current: {formatInr(Number(app.currentSemesterFee))}</Text>
              <Text>Back papers: {formatInr(Number(app.backPaperFee))}</Text>
              <Text>Processing: {formatInr(Number(app.processingFee))}</Text>
              <Text>Late: {formatInr(Number(app.lateFee))}</Text>
              <Text style={styles.total}>Total: {formatInr(Number(app.totalFee))}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  session: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  meta: { color: '#64748b', marginBottom: 4 },
  error: { color: '#b91c1c', marginBottom: 8 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stepChip: {
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepActive: { backgroundColor: '#1d4ed8' },
  stepText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  stepTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  row: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: { fontWeight: '600', color: '#0f172a' },
  rowMeta: { color: '#64748b', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  primaryBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#0f172a', fontWeight: '600' },
  payBtn: {
    backgroundColor: '#047857',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  link: { color: '#1d4ed8', fontWeight: '600' },
  linkDanger: { color: '#b91c1c', fontWeight: '600' },
  summary: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  total: { marginTop: 6, fontWeight: '800', fontSize: 16 },
  ok: { color: '#047857', fontWeight: '600' },
});
