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
  fetchMyFeedbackCampaigns,
  submitMyFeedback,
  type FeedbackCampaignItem,
  type FeedbackScaleItem,
} from '@/services/feedback';

export default function StudentFeedbackScreen() {
  const [items, setItems] = useState<FeedbackCampaignItem[]>([]);
  const [scale, setScale] = useState<FeedbackScaleItem[]>([]);
  const [active, setActive] = useState<FeedbackCampaignItem | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMyFeedbackCampaigns();
      setItems(data.items ?? []);
      setScale(data.scale ?? []);
    } catch (e) {
      Alert.alert('Feedback', e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async () => {
    if (!active?.questions?.length) return;
    const payload = active.questions.map((q) => {
      const rating = answers[q.id];
      if (!rating) throw new Error(`Please answer: ${q.prompt}`);
      return { questionId: q.id, rating };
    });
    setSubmitting(true);
    try {
      const res = await submitMyFeedback(active.id, payload);
      setMessage((res as any)?.message ?? 'Submitted');
      setActive(null);
      setAnswers({});
      await load();
    } catch (e) {
      Alert.alert('Submit', e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StudentScreenShell title="Feedback" subtitle="Student satisfaction">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {message ? <Text style={styles.ok}>{message}</Text> : null}
        {loading && !items.length ? (
          <ActivityIndicator />
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {item.academicYear}
                {item.canSubmit ? ' · Open' : item.alreadySubmitted ? ' · Submitted' : ' · Closed'}
              </Text>
              {item.closedReason && !item.canSubmit ? (
                <Text style={styles.hint}>{item.closedReason}</Text>
              ) : null}
              {item.canSubmit ? (
                <Pressable
                  style={styles.btn}
                  onPress={() => {
                    setActive(item);
                    setAnswers({});
                    setMessage('');
                  }}
                >
                  <Text style={styles.btnText}>
                    {active?.id === item.id ? 'Filling…' : 'Give feedback'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}

        {active?.canSubmit && active.questions?.length ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>{active.title}</Text>
            <Text style={styles.hint}>
              {active.instructions ||
                'Kindly select the appropriate option as per the following criteria.'}
            </Text>
            {active.questions.map((q, idx) => (
              <View key={q.id} style={styles.q}>
                <Text style={styles.qPrompt}>
                  {idx + 1}. {q.prompt}
                  {q.required ? ' *' : ''}
                </Text>
                <View style={styles.scaleRow}>
                  {scale.map((s) => {
                    const on = answers[q.id] === s.rating;
                    return (
                      <Pressable
                        key={s.rating}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: s.rating }))}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            <Pressable
              style={[styles.btn, styles.submit]}
              disabled={submitting}
              onPress={() => {
                try {
                  void onSubmit();
                } catch (e) {
                  Alert.alert('Feedback', e instanceof Error ? e.message : 'Incomplete');
                }
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Submit feedback</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {!loading && !items.length ? (
          <Text style={styles.hint}>No feedback forms are available right now.</Text>
        ) : null}
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
    gap: 6,
  },
  title: { fontSize: 16, fontWeight: '700', color: studentTheme.text },
  meta: { fontSize: 12, color: studentTheme.textMuted },
  hint: { fontSize: 12, color: studentTheme.textMuted, lineHeight: 17 },
  btn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: studentTheme.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  form: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  formTitle: { fontSize: 16, fontWeight: '700' },
  q: { gap: 8, backgroundColor: '#fff', borderRadius: 10, padding: 10 },
  qPrompt: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: studentTheme.primary, borderColor: studentTheme.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  chipTextOn: { color: '#fff' },
  submit: { alignSelf: 'stretch', alignItems: 'center' },
  ok: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: '#065f46',
    fontSize: 13,
  },
});
