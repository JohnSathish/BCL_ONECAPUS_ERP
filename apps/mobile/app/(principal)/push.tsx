import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { principalTheme } from '@/components/principal-portal/theme';
import {
  fetchPrincipalPushDetail,
  fetchPrincipalPushHistory,
  fetchPrincipalPushOptions,
  previewPrincipalPush,
  searchPrincipalPushPeople,
  sendPrincipalPush,
  type PrincipalPushAudience,
} from '@/services/principal-desk';

type Person = { id: string; name: string };

export default function PrincipalPushScreen() {
  const [audience, setAudience] = useState<PrincipalPushAudience>('STUDENTS_AND_STAFF');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [noticeLink, setNoticeLink] = useState('');
  const [schedule, setSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [semesterSequences, setSemesterSequences] = useState<number[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [students, setStudents] = useState<Person[]>([]);
  const [staff, setStaff] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Awaited<
    ReturnType<typeof fetchPrincipalPushOptions>
  > | null>(null);
  const [people, setPeople] = useState<Awaited<
    ReturnType<typeof searchPrincipalPushPeople>
  > | null>(null);
  const [preview, setPreview] = useState('');
  const [history, setHistory] = useState<Awaited<ReturnType<typeof fetchPrincipalPushHistory>>>([]);
  const [failures, setFailures] = useState<Array<{ name: string; error: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const payload = useMemo(
    () => ({
      audience,
      title: title.trim() || 'Preview',
      message: message.trim() || 'Preview',
      noticeLink: noticeLink.trim() || undefined,
      departmentIds: departmentIds.length ? departmentIds : undefined,
      semesterSequences: semesterSequences.length ? semesterSequences : undefined,
      sectionIds: sectionIds.length ? sectionIds : undefined,
      studentIds: students.length ? students.map((row) => row.id) : undefined,
      staffProfileIds: staff.length ? staff.map((row) => row.id) : undefined,
    }),
    [
      audience,
      departmentIds,
      message,
      noticeLink,
      sectionIds,
      semesterSequences,
      staff,
      students,
      title,
    ],
  );

  async function reload() {
    const [nextOptions, nextHistory] = await Promise.all([
      fetchPrincipalPushOptions(),
      fetchPrincipalPushHistory(),
    ]);
    setOptions(nextOptions);
    setHistory(nextHistory ?? []);
  }

  useEffect(() => {
    void reload()
      .catch((error) =>
        Alert.alert('Push unavailable', error instanceof Error ? error.message : 'Try again'),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void previewPrincipalPush(payload)
        .then((count) =>
          setPreview(`${count.total} people match. ${count.withPush} have a registered device.`),
        )
        .catch(() => setPreview(''));
    }, 400);
    return () => clearTimeout(handle);
  }, [payload]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setPeople(null);
      return;
    }
    const handle = setTimeout(() => {
      void searchPrincipalPushPeople(term)
        .then(setPeople)
        .catch(() => setPeople(null));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  async function send() {
    if (title.trim().length < 2 || message.trim().length < 2) {
      Alert.alert('Add a title and message');
      return;
    }
    setBusy(true);
    try {
      const result = await sendPrincipalPush({
        ...payload,
        title: title.trim(),
        message: message.trim(),
        scheduledAt: schedule && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      Alert.alert(
        result.status === 'SCHEDULED' ? 'Scheduled' : 'Sending',
        result.status === 'SCHEDULED'
          ? 'The notification will be sent through FCM at the scheduled time.'
          : `Sending to ${result.recipients} people (${result.devices} with a registered device).`,
      );
      setTitle('');
      setMessage('');
      await reload();
    } catch (error) {
      Alert.alert('Could not send', error instanceof Error ? error.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  const sections = (options?.sections ?? []).filter((row) =>
    semesterSequences.length ? semesterSequences.includes(row.semesterNo ?? -1) : true,
  );

  return (
    <PrincipalScreenShell
      title="Send Push Notification"
      subtitle="Mobile app only. Email stays in Create Notice."
    >
      {loading ? (
        <ActivityIndicator color={principalTheme.primaryAccent} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {options && !options.fcmConfigured ? (
            <Text style={styles.warn}>
              Push notifications are not configured on the server (FCM).
            </Text>
          ) : null}
          <Text style={styles.label}>Recipients</Text>
          <View style={styles.wrap}>
            {(options?.audiences ?? []).map((item) => (
              <Pressable
                key={item.id}
                style={[styles.chip, audience === item.id && styles.chipOn]}
                onPress={() => setAudience(item.id)}
              >
                <Text style={[styles.chipText, audience === item.id && styles.chipTextOn]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Departments</Text>
          <View style={styles.wrap}>
            {(options?.departments ?? []).map((row) => {
              const on = departmentIds.includes(row.id);
              return (
                <Pressable
                  key={row.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() =>
                    setDepartmentIds((current) =>
                      on ? current.filter((id) => id !== row.id) : [...current, row.id],
                    )
                  }
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{row.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {audience !== 'STAFF' ? (
            <>
              <Text style={styles.label}>Semesters</Text>
              <View style={styles.wrap}>
                {(options?.semesters ?? []).map((semester) => {
                  const on = semesterSequences.includes(semester);
                  return (
                    <Pressable
                      key={semester}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() =>
                        setSemesterSequences((current) =>
                          on ? current.filter((item) => item !== semester) : [...current, semester],
                        )
                      }
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>Sem {semester}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.label}>Classes</Text>
              <View style={styles.wrap}>
                {sections.slice(0, 40).map((row) => {
                  const on = sectionIds.includes(row.id);
                  return (
                    <Pressable
                      key={row.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() =>
                        setSectionIds((current) =>
                          on ? current.filter((id) => id !== row.id) : [...current, row.id],
                        )
                      }
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {row.courseCode} {row.sectionCode}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          <Text style={styles.label}>Individual student or staff</Text>
          <TextInput
            style={styles.input}
            value={query}
            placeholder="Name, roll, or employee code"
            onChangeText={setQuery}
          />
          {audience !== 'STAFF'
            ? (people?.students ?? []).map((row) => (
                <Pressable
                  key={row.id}
                  onPress={() => {
                    setStudents((current) =>
                      current.some((item) => item.id === row.id)
                        ? current
                        : [...current, { id: row.id, name: row.name }],
                    );
                    setQuery('');
                  }}
                >
                  <Text style={styles.person}>
                    {row.name}
                    {row.rollNumber ? ` · ${row.rollNumber}` : ''}
                  </Text>
                </Pressable>
              ))
            : null}
          {audience !== 'STUDENTS'
            ? (people?.staff ?? []).map((row) => (
                <Pressable
                  key={row.id}
                  onPress={() => {
                    setStaff((current) =>
                      current.some((item) => item.id === row.id)
                        ? current
                        : [...current, { id: row.id, name: row.name }],
                    );
                    setQuery('');
                  }}
                >
                  <Text style={styles.person}>
                    {row.name} · {row.employeeCode}
                  </Text>
                </Pressable>
              ))
            : null}
          <View style={styles.wrap}>
            {students.map((row) => (
              <Pressable
                key={row.id}
                onPress={() =>
                  setStudents((current) => current.filter((item) => item.id !== row.id))
                }
              >
                <Text style={styles.selected}>{row.name} ×</Text>
              </Pressable>
            ))}
            {staff.map((row) => (
              <Pressable
                key={row.id}
                onPress={() => setStaff((current) => current.filter((item) => item.id !== row.id))}
              >
                <Text style={styles.selected}>{row.name} ×</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.preview}>{preview}</Text>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={120} />
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.message]}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
          />
          <Text style={styles.label}>Optional notice link</Text>
          <TextInput
            style={styles.input}
            value={noticeLink}
            onChangeText={setNoticeLink}
            autoCapitalize="none"
            placeholder="https://"
          />
          <Pressable style={styles.schedule} onPress={() => setSchedule((value) => !value)}>
            <Text style={styles.scheduleText}>{schedule ? 'Scheduled' : 'Send now'}</Text>
          </Pressable>
          {schedule ? (
            <TextInput
              style={styles.input}
              value={scheduledAt}
              onChangeText={setScheduledAt}
              placeholder="2026-10-20T09:00"
              autoCapitalize="none"
            />
          ) : null}
          <Pressable style={styles.send} disabled={busy} onPress={() => void send()}>
            <Text style={styles.sendText}>
              {busy ? 'Sending…' : schedule ? 'Schedule notification' : 'Send now'}
            </Text>
          </Pressable>
          <Text style={styles.historyTitle}>Sent notifications</Text>
          {history.map((row) => (
            <Pressable
              key={row.id}
              style={styles.card}
              onPress={() => {
                void fetchPrincipalPushDetail(row.id)
                  .then((detail) => setFailures(detail.failures ?? []))
                  .catch(() => setFailures([]));
              }}
            >
              <Text style={styles.cardTitle}>{row.title}</Text>
              <Text style={styles.cardMeta}>
                {row.audienceLabel} · {row.sender}
              </Text>
              <Text style={styles.cardMeta}>
                {row.status === 'SENT'
                  ? `FCM accepted ${row.acceptedByFcm}${row.failed ? `, ${row.failed} failed` : ''}`
                  : row.status}
              </Text>
            </Pressable>
          ))}
          {failures.map((row, index) => (
            <Text key={`${row.name}-${index}`} style={styles.fail}>
              {row.name}: {row.error}
            </Text>
          ))}
        </ScrollView>
      )}
    </PrincipalScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 40, gap: 8 },
  label: { marginTop: 8, fontSize: 12, fontWeight: '700', color: principalTheme.textMuted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: principalTheme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: principalTheme.surface,
  },
  chipOn: {
    backgroundColor: principalTheme.primaryAccent,
    borderColor: principalTheme.primaryAccent,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: principalTheme.text },
  chipTextOn: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: principalTheme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: principalTheme.surface,
    color: principalTheme.text,
  },
  message: { minHeight: 96, textAlignVertical: 'top' },
  person: { paddingVertical: 8, color: principalTheme.primaryAccent, fontWeight: '700' },
  selected: {
    backgroundColor: principalTheme.primarySoft,
    color: principalTheme.primaryAccent,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  preview: { color: principalTheme.textMuted, fontSize: 13 },
  schedule: { alignSelf: 'flex-start', paddingVertical: 8 },
  scheduleText: { color: principalTheme.primaryAccent, fontWeight: '800' },
  send: {
    marginTop: 8,
    backgroundColor: principalTheme.primaryAccent,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
  },
  sendText: { color: '#fff', fontWeight: '800' },
  historyTitle: { marginTop: 18, fontSize: 16, fontWeight: '800', color: principalTheme.text },
  card: {
    borderWidth: 1,
    borderColor: principalTheme.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: principalTheme.surface,
    marginTop: 8,
  },
  cardTitle: { fontWeight: '800', color: principalTheme.text },
  cardMeta: { marginTop: 2, fontSize: 12, color: principalTheme.textMuted },
  warn: { backgroundColor: '#FEF3C7', color: '#92400E', padding: 10, borderRadius: 12 },
  fail: { marginTop: 6, color: '#BE123C', fontSize: 12 },
});
