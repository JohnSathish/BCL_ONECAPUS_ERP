import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import { DateField } from '@/components/ui/date-field';
import {
  fetchMyFeedbackCampaigns,
  submitMyFeedback,
  type FeedbackCampaignItem,
  type FeedbackCampaignQuestion,
  type FeedbackOption,
  type FeedbackScaleItem,
} from '@/services/feedback';

type FeedbackAnswerValue = {
  rating?: number;
  valueText?: string;
  valueNumber?: number;
  valueBool?: boolean;
  valueDate?: string;
  valueJson?: unknown;
};

type ShowIf = {
  questionId: string;
  op?: 'eq' | 'neq' | 'in';
  value?: string | string[] | number | boolean;
};

const LIKERT_OPTIONS: FeedbackOption[] = [
  { value: '5', label: 'Excellent' },
  { value: '4', label: 'Very Good' },
  { value: '3', label: 'Good' },
  { value: '2', label: 'Average' },
  { value: '1', label: 'Poor' },
];

function asOptions(raw: unknown, type?: string, scale?: FeedbackScaleItem[]): FeedbackOption[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((o) => {
        if (!o || typeof o !== 'object') return null;
        const r = o as Record<string, unknown>;
        const value = String(r.value ?? r.rating ?? '');
        const label = String(r.label ?? value);
        if (!value) return null;
        return { value, label };
      })
      .filter(Boolean) as FeedbackOption[];
  }
  if (type === 'LIKERT_5') {
    if (scale?.length) {
      return scale.map((s) => ({ value: String(s.rating), label: s.label }));
    }
    return [...LIKERT_OPTIONS];
  }
  if (type === 'yes_no') {
    return [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ];
  }
  if (type === 'true_false') {
    return [
      { value: 'true', label: 'True' },
      { value: 'false', label: 'False' },
    ];
  }
  if (type === 'rating') {
    return Array.from({ length: 5 }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1),
    }));
  }
  return [];
}

function comparableAnswer(a: FeedbackAnswerValue | undefined): string | string[] | null {
  if (!a) return null;
  if (a.rating != null) return String(a.rating);
  if (a.valueBool != null) return a.valueBool ? 'true' : 'false';
  if (a.valueNumber != null) return String(a.valueNumber);
  if (a.valueText) return a.valueText;
  if (a.valueDate) return a.valueDate;
  if (Array.isArray(a.valueJson)) return a.valueJson.map(String);
  return null;
}

function isQuestionVisible(
  q: FeedbackCampaignQuestion,
  answers: Record<string, FeedbackAnswerValue>,
): boolean {
  const logic =
    q.conditionalLogic && typeof q.conditionalLogic === 'object'
      ? (q.conditionalLogic as { showIf?: ShowIf })
      : {};
  const showIf = logic.showIf;
  if (!showIf?.questionId) return true;
  const actual = comparableAnswer(answers[showIf.questionId]);
  if (actual == null) return false;
  const expected = showIf.value;
  const op = showIf.op ?? 'eq';
  if (op === 'in') {
    const list = Array.isArray(expected) ? expected.map(String) : [String(expected)];
    if (Array.isArray(actual)) return actual.some((x) => list.includes(String(x)));
    return list.includes(String(actual));
  }
  const a = Array.isArray(actual) ? actual.join(',') : String(actual);
  const e = Array.isArray(expected) ? expected.map(String).join(',') : String(expected);
  if (op === 'neq') return a !== e;
  return a === e;
}

function answerToPayload(questionId: string, value: FeedbackAnswerValue): Record<string, unknown> {
  return {
    questionId,
    ...(value.rating != null ? { rating: value.rating } : {}),
    ...(value.valueText != null ? { valueText: value.valueText } : {}),
    ...(value.valueNumber != null ? { valueNumber: value.valueNumber } : {}),
    ...(value.valueBool != null ? { valueBool: value.valueBool } : {}),
    ...(value.valueDate != null ? { valueDate: value.valueDate } : {}),
    ...(value.valueJson != null ? { valueJson: value.valueJson } : {}),
  };
}

const FORM_ICONS = [{ bg: '#EFF6FF' }, { bg: '#F5F3FF' }, { bg: '#FFF7ED' }, { bg: '#DBEAFE' }];

function yearLabel(value?: string | null) {
  const text = value?.trim();
  if (!text) return 'Academic year';
  return /^academic year/i.test(text) ? text : `Academic Year ${text}`;
}

function formStatus(item: FeedbackCampaignItem) {
  if (item.canSubmit) return { label: 'Open', bg: '#D1FAE5', fg: '#059669' };
  if (item.alreadySubmitted) return { label: 'Submitted', bg: '#DBEAFE', fg: '#1D4ED8' };
  return { label: 'Closed', bg: '#F3F4F6', fg: '#6B7280' };
}

function hasAnswer(value: FeedbackAnswerValue | undefined): boolean {
  if (!value) return false;
  if (value.rating != null) return true;
  if (value.valueBool != null) return true;
  if (value.valueNumber != null && !Number.isNaN(value.valueNumber)) return true;
  if (value.valueText != null && String(value.valueText).trim() !== '') return true;
  if (value.valueDate != null && String(value.valueDate).trim() !== '') return true;
  if (Array.isArray(value.valueJson) && value.valueJson.length > 0) return true;
  if (value.valueJson && typeof value.valueJson === 'object' && !Array.isArray(value.valueJson)) {
    const url = (value.valueJson as { url?: string }).url;
    return Boolean(url && String(url).trim());
  }
  return false;
}

function QuestionControl({
  question,
  value,
  onChange,
  scale,
}: {
  question: FeedbackCampaignQuestion;
  value?: FeedbackAnswerValue;
  onChange: (next: FeedbackAnswerValue) => void;
  scale: FeedbackScaleItem[];
}) {
  const type = question.questionType ?? 'LIKERT_5';
  const options = asOptions(question.options, type, scale);
  const placeholder = question.placeholder ?? undefined;

  if (
    type === 'LIKERT_5' ||
    type === 'rating' ||
    type === 'single_choice' ||
    type === 'yes_no' ||
    type === 'true_false'
  ) {
    return (
      <View style={styles.scaleRow}>
        {options.map((opt) => {
          const selected =
            value?.rating != null
              ? String(value.rating) === opt.value
              : value?.valueText === opt.value ||
                (value?.valueBool === true && (opt.value === 'yes' || opt.value === 'true')) ||
                (value?.valueBool === false && (opt.value === 'no' || opt.value === 'false'));
          const label =
            type === 'rating' ? '★'.repeat(Number(opt.value) || 0) || opt.label : opt.label;
          return (
            <Pressable
              key={opt.value}
              style={[styles.choice, selected && styles.choiceOn]}
              onPress={() => {
                if (type === 'LIKERT_5' || type === 'rating') {
                  onChange({ rating: Number(opt.value), valueText: opt.label });
                } else if (type === 'yes_no' || type === 'true_false') {
                  const boolVal = opt.value === 'yes' || opt.value === 'true';
                  onChange({ valueBool: boolVal, valueText: opt.value });
                } else {
                  onChange({ valueText: opt.value });
                }
              }}
            >
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (type === 'multi_choice') {
    const selected = Array.isArray(value?.valueJson) ? (value!.valueJson as string[]) : [];
    return (
      <View style={styles.multiCol}>
        {options.map((opt) => {
          const on = selected.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => {
                const next = on
                  ? selected.filter((v) => v !== opt.value)
                  : [...selected, opt.value];
                onChange({ valueJson: next });
              }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (type === 'dropdown') {
    return (
      <View style={styles.multiCol}>
        {options.map((opt) => {
          const on = value?.valueText === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => onChange({ valueText: opt.value })}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (type === 'short_text') {
    return (
      <TextInput
        style={styles.input}
        placeholder={placeholder || 'Your answer'}
        placeholderTextColor="#94a3b8"
        value={value?.valueText ?? ''}
        onChangeText={(t) => onChange({ valueText: t })}
      />
    );
  }

  if (type === 'long_text') {
    return (
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder={placeholder || 'Your answer'}
        placeholderTextColor="#94a3b8"
        value={value?.valueText ?? ''}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        onChangeText={(t) => onChange({ valueText: t })}
      />
    );
  }

  if (type === 'integer' || type === 'decimal') {
    return (
      <TextInput
        style={styles.input}
        placeholder={placeholder || (type === 'integer' ? '0' : '0.0')}
        placeholderTextColor="#94a3b8"
        keyboardType={type === 'integer' ? 'number-pad' : 'decimal-pad'}
        value={value?.valueNumber != null ? String(value.valueNumber) : ''}
        onChangeText={(t) => {
          if (t === '') {
            onChange({ valueNumber: undefined });
            return;
          }
          const n = Number(t);
          if (!Number.isNaN(n)) onChange({ valueNumber: n });
        }}
      />
    );
  }

  if (type === 'date') {
    return (
      <DateField
        label="Date"
        value={value?.valueDate ?? ''}
        onChange={(iso) => onChange({ valueDate: iso })}
        placeholder={placeholder || 'Select date'}
        accentColor={studentTheme.primary}
        mutedColor={studentTheme.textMuted}
        borderColor={studentTheme.border}
        surfaceColor="#fff"
      />
    );
  }

  if (type === 'time' || type === 'datetime') {
    return (
      <TextInput
        style={styles.input}
        placeholder={
          placeholder ||
          (type === 'time' ? 'HH:mm (e.g. 14:30)' : 'ISO datetime (e.g. 2026-07-12T14:30)')
        }
        placeholderTextColor="#94a3b8"
        value={value?.valueDate ?? ''}
        onChangeText={(t) => onChange({ valueDate: t })}
        autoCapitalize="none"
      />
    );
  }

  if (type === 'file_upload') {
    const url =
      value?.valueJson && typeof value.valueJson === 'object'
        ? String((value.valueJson as { url?: string }).url ?? '')
        : '';
    return (
      <TextInput
        style={styles.input}
        placeholder={placeholder || 'Paste file URL'}
        placeholderTextColor="#94a3b8"
        value={url}
        autoCapitalize="none"
        keyboardType="url"
        onChangeText={(t) =>
          onChange({
            valueJson: {
              url: t,
              name: t.split('/').pop() || 'file',
            },
          })
        }
      />
    );
  }

  // Fallback: treat unknown types like Likert
  return (
    <View style={styles.scaleRow}>
      {(scale.length
        ? scale.map((s) => ({ value: String(s.rating), label: s.label }))
        : LIKERT_OPTIONS
      ).map((opt) => {
        const on = value?.rating != null && String(value.rating) === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => onChange({ rating: Number(opt.value), valueText: opt.label })}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function StudentFeedbackScreen() {
  const [items, setItems] = useState<FeedbackCampaignItem[]>([]);
  const [scale, setScale] = useState<FeedbackScaleItem[]>([]);
  const [active, setActive] = useState<FeedbackCampaignItem | null>(null);
  const [answers, setAnswers] = useState<Record<string, FeedbackAnswerValue>>({});
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

  const visibleQuestions = useMemo(() => {
    const qs = [...(active?.questions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    return qs.filter((q) => isQuestionVisible(q, answers));
  }, [active?.questions, answers]);

  const onSubmit = async () => {
    if (!active) return;
    try {
      const payload: Array<Record<string, unknown>> = [];
      for (const q of visibleQuestions) {
        const value = answers[q.id];
        if (q.required && !hasAnswer(value)) {
          throw new Error(`Please answer: ${q.prompt}`);
        }
        if (hasAnswer(value)) {
          payload.push(answerToPayload(q.id, value!));
        }
      }
      if (!payload.length) throw new Error('Please answer at least one question.');
      setSubmitting(true);
      const res = await submitMyFeedback(active.id, payload);
      setMessage((res as any)?.message ?? 'Submitted');
      setActive(null);
      setAnswers({});
      await load();
    } catch (e) {
      Alert.alert('Feedback', e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StudentScreenShell title="Feedback" subtitle="Student satisfaction">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        keyboardShouldPersistTaps="handled"
      >
        {message ? <Text style={styles.ok}>{message}</Text> : null}
        {loading && !items.length ? (
          <ActivityIndicator />
        ) : (
          items.map((item, index) => {
            const open = active?.id === item.id;
            const status = formStatus(item);
            const icon = FORM_ICONS[index % FORM_ICONS.length];
            return (
              <View key={item.id} style={[styles.card, open && styles.cardOpen]}>
                <View style={styles.cardTop}>
                  <View
                    style={[styles.iconBubble, { backgroundColor: open ? '#123A7A' : icon.bg }]}
                  >
                    <Text style={styles.icon}>📋</Text>
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.meta}>{yearLabel(item.academicYear)}</Text>
                  </View>
                  {open ? (
                    <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: status.fg }]} />
                      <Text style={[styles.statusText, { color: status.fg }]}>{status.label}</Text>
                    </View>
                  ) : (
                    <Text style={styles.chevron}>›</Text>
                  )}
                </View>
                {item.closedReason && !item.canSubmit ? (
                  <Text style={styles.hint}>{item.closedReason}</Text>
                ) : null}
                {!open ? (
                  <View style={styles.cardFooter}>
                    <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: status.fg }]} />
                      <Text style={[styles.statusText, { color: status.fg }]}>{status.label}</Text>
                    </View>
                    {item.canSubmit ? (
                      <Pressable
                        style={styles.btn}
                        onPress={() => {
                          setActive(item);
                          setAnswers({});
                          setMessage('');
                        }}
                      >
                        <Text style={styles.btnText}>Give feedback</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : item.canSubmit ? (
                  <Pressable
                    style={[styles.btn, styles.btnQuiet]}
                    onPress={() => {
                      setActive(null);
                      setAnswers({});
                    }}
                  >
                    <Text style={styles.btnQuietText}>Filling…</Text>
                  </Pressable>
                ) : null}
                {open && visibleQuestions.length ? (
                  <View style={styles.form}>
                    <Text style={styles.instructions}>
                      {item.instructions ||
                        'Kindly select the appropriate option as per the following criteria.'}
                    </Text>
                    {visibleQuestions.map((q, idx) => (
                      <View key={q.id} style={styles.q}>
                        <View style={styles.qHead}>
                          <View style={styles.qNum}>
                            <Text style={styles.qNumText}>{idx + 1}</Text>
                          </View>
                          <Text style={styles.qPrompt}>
                            {q.prompt}
                            {q.required ? ' *' : ''}
                          </Text>
                        </View>
                        {q.description ? <Text style={styles.hint}>{q.description}</Text> : null}
                        {q.helpText ? <Text style={styles.hint}>{q.helpText}</Text> : null}
                        <QuestionControl
                          question={q}
                          value={answers[q.id]}
                          scale={scale}
                          onChange={(next) => setAnswers((prev) => ({ ...prev, [q.id]: next }))}
                        />
                      </View>
                    ))}
                    <Pressable
                      style={styles.submit}
                      disabled={submitting}
                      onPress={() => void onSubmit()}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.submitText}>Submit Feedback →</Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

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
    borderColor: '#E8EEF7',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#fff',
    gap: 10,
  },
  cardOpen: { borderColor: '#BFDBFE' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },
  cardCopy: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  meta: { fontSize: 12, color: studentTheme.textMuted, fontWeight: '600' },
  chevron: { fontSize: 22, color: '#9CA3AF', fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '800' },
  hint: { fontSize: 12, color: studentTheme.textMuted, lineHeight: 17 },
  btn: {
    backgroundColor: '#123A7A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnQuiet: {
    alignSelf: 'flex-end',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  btnQuietText: { color: '#1D4ED8', fontWeight: '800', fontSize: 13 },
  form: { gap: 12, marginTop: 4 },
  instructions: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  q: {
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  qHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  qNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qNumText: { color: '#1D4ED8', fontSize: 12, fontWeight: '800' },
  qPrompt: { flex: 1, fontSize: 14, fontWeight: '800', lineHeight: 20, color: studentTheme.text },
  scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minWidth: 72,
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#fff',
  },
  choiceOn: { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: '#1D4ED8' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1D4ED8' },
  choiceText: { fontSize: 11, fontWeight: '700', color: '#334155', textAlign: 'center' },
  choiceTextOn: { color: '#1D4ED8' },
  multiCol: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: studentTheme.text,
    backgroundColor: '#fff',
  },
  textarea: { minHeight: 96 },
  submit: {
    backgroundColor: '#123A7A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
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
