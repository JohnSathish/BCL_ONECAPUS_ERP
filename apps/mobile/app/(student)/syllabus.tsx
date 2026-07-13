import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import {
  askSyllabusDocument,
  downloadSyllabusPdfOffline,
  fetchMySyllabusDocuments,
  getCachedSyllabusUri,
  shareSyllabusPdf,
  toggleSyllabusBookmark,
  type SyllabusDocument,
} from '@/services/syllabus';

export default function StudentSyllabusScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SyllabusDocument[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [askId, setAskId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchMySyllabusDocuments();
      setItems(rows);
    } catch (e) {
      Alert.alert('Could not load syllabus', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map: Record<string, SyllabusDocument[]> = {};
    for (const row of items) {
      const key = (row.category || row.subjectType || 'OTHER').toUpperCase();
      if (!map[key]) map[key] = [];
      map[key].push(row);
    }
    return map;
  }, [items]);

  const onDownload = async (doc: SyllabusDocument) => {
    setBusyId(doc.id);
    try {
      const uri = await downloadSyllabusPdfOffline(doc.id, doc.fileName, doc.currentVersionNo);
      Alert.alert('Saved for offline', 'Syllabus downloaded to this device.', [
        {
          text: 'Open / Share',
          onPress: () => void shareSyllabusPdf(uri, doc.fileName ?? undefined),
        },
        { text: 'OK' },
      ]);
    } catch (e) {
      Alert.alert('Download failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusyId(null);
    }
  };

  const onOpenCached = async (doc: SyllabusDocument) => {
    setBusyId(doc.id);
    try {
      let uri = await getCachedSyllabusUri(doc.id, doc.fileName, doc.currentVersionNo);
      if (!uri) {
        uri = await downloadSyllabusPdfOffline(doc.id, doc.fileName, doc.currentVersionNo);
      }
      await shareSyllabusPdf(uri, doc.fileName ?? undefined);
    } catch (e) {
      Alert.alert('Unable to open', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusyId(null);
    }
  };

  const onBookmark = async (doc: SyllabusDocument) => {
    try {
      await toggleSyllabusBookmark(doc.id);
      await load();
    } catch (e) {
      Alert.alert('Bookmark failed', e instanceof Error ? e.message : 'Try again');
    }
  };

  const onAsk = async () => {
    if (!askId || !question.trim()) return;
    setBusyId(askId);
    setAnswer(null);
    try {
      const res = await askSyllabusDocument(askId, question.trim());
      setAnswer(res.answer);
    } catch (e) {
      Alert.alert('Ask AI failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <StudentScreenShell title="My Syllabus" subtitle="Programme & semester papers">
        <View style={styles.center}>
          <ActivityIndicator color={studentTheme.primary} />
        </View>
      </StudentScreenShell>
    );
  }

  return (
    <StudentScreenShell title="My Syllabus" subtitle="Auto-filtered for your registration">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No syllabus published yet</Text>
            <Text style={styles.emptyBody}>
              When your department publishes syllabus PDFs for your registered papers, they will
              appear here automatically.
            </Text>
          </View>
        ) : (
          Object.entries(grouped).map(([category, docs]) => (
            <View key={category} style={styles.group}>
              <Text style={styles.groupTitle}>{category}</Text>
              {docs.map((doc) => (
                <View key={doc.id} style={styles.card}>
                  <Text style={styles.code}>{doc.paperCode}</Text>
                  <Text style={styles.title}>{doc.paperTitle}</Text>
                  <Text style={styles.meta}>
                    {[
                      doc.semesterNo != null ? `Sem ${doc.semesterNo}` : null,
                      doc.credits != null ? `${doc.credits} credits` : null,
                      doc.currentVersionNo != null ? `v${doc.currentVersionNo}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <View style={styles.actions}>
                    <Action
                      label={busyId === doc.id ? '…' : 'View / Share'}
                      onPress={() => void onOpenCached(doc)}
                    />
                    <Action label="Offline" onPress={() => void onDownload(doc)} />
                    <Action
                      label={doc.bookmarked ? '★ Saved' : 'Bookmark'}
                      onPress={() => void onBookmark(doc)}
                    />
                    <Action
                      label="Ask AI"
                      onPress={() => {
                        setAskId(doc.id);
                        setAnswer(null);
                        setQuestion('');
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          ))
        )}

        {askId ? (
          <View style={styles.askBox}>
            <Text style={styles.groupTitle}>Ask AI about this syllabus</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. What are the course outcomes?"
              placeholderTextColor="#94a3b8"
              value={question}
              onChangeText={setQuestion}
              multiline
            />
            <View style={styles.actions}>
              <Action label={busyId === askId ? 'Thinking…' : 'Ask'} onPress={() => void onAsk()} />
              <Action label="Close" onPress={() => setAskId(null)} />
            </View>
            {answer ? <Text style={styles.answer}>{answer}</Text> : null}
          </View>
        ) : null}

        <Pressable
          onPress={() =>
            void Linking.openURL('https://erp.donboscocollege.ac.in/student/syllabus-repository')
          }
        >
          <Text style={styles.link}>Open full web viewer →</Text>
        </Pressable>
      </ScrollView>
    </StudentScreenShell>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.actionBtn} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  emptyBody: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  group: { gap: 10 },
  groupTitle: { fontSize: 13, fontWeight: '700', color: studentTheme.primary, letterSpacing: 0.4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  code: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  title: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  actionBtn: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  actionText: { fontSize: 12, fontWeight: '600', color: studentTheme.primary },
  askBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 8,
  },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    textAlignVertical: 'top',
    color: '#0f172a',
  },
  answer: { fontSize: 13, color: '#334155', lineHeight: 19 },
  link: { color: studentTheme.primary, fontWeight: '600', textAlign: 'center', marginTop: 8 },
});
