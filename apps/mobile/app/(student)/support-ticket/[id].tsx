import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  commentStudentTicket,
  fetchStudentTicket,
  formatSupportCategory,
  formatSupportStatus,
  rateStudentTicket,
  supportStatusColor,
  type SupportTicket,
} from '@/services/support-centre';

function formatWhen(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function StudentSupportTicketScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(false);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [draft, setDraft] = useState('');
  const [score, setScore] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchStudentTicket(id);
      setTicket(data);
      setScore(data.satisfactionScore ?? 0);
    } catch (e) {
      Alert.alert('Could not load ticket', e instanceof Error ? e.message : 'Try again');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onComment() {
    if (!id || !draft.trim()) return;
    setSending(true);
    try {
      await commentStudentTicket(id, draft.trim());
      setDraft('');
      await load();
    } catch (e) {
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSending(false);
    }
  }

  async function onRate(nextScore: number) {
    if (!id) return;
    setScore(nextScore);
    setRating(true);
    try {
      await rateStudentTicket(id, nextScore);
      await load();
      Alert.alert('Thanks', 'Your rating was saved.');
    } catch (e) {
      Alert.alert('Could not rate', e instanceof Error ? e.message : 'Try again');
    } finally {
      setRating(false);
    }
  }

  const statusColor = supportStatusColor(ticket?.status ?? '');
  const comments = (ticket?.comments ?? []).filter((c) => !c.isInternal);
  const canRate = ['RESOLVED', 'CLOSED', 'DONE'].includes(ticket?.status?.toUpperCase() ?? '');

  return (
    <StudentScreenShell
      title={ticket?.ticketNo || 'Ticket'}
      subtitle={ticket ? formatSupportCategory(ticket.category) : 'Support Centre'}
    >
      {loading && !ticket ? (
        <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 32 }} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.subject}>{ticket?.subject}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {formatSupportStatus(ticket?.status ?? '')}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>
                Priority: {formatSupportStatus(ticket?.priority ?? 'NORMAL')}
                {ticket?.department?.name ? ` · ${ticket.department.name}` : ''}
              </Text>
              <Text style={styles.meta}>Updated {formatWhen(ticket?.updatedAt)}</Text>
              {ticket?.description ? (
                <Text style={styles.description}>{ticket.description}</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Updates</Text>
              {comments.length === 0 ? (
                <Text style={styles.muted}>No updates yet. Support will reply here.</Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.commentRow}>
                    <Text style={styles.commentBody}>{c.body}</Text>
                    <Text style={styles.commentMeta}>{formatWhen(c.createdAt)}</Text>
                  </View>
                ))
              )}
            </View>

            {canRate ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Rate this ticket</Text>
                <Text style={styles.muted}>How was your support experience?</Text>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => void onRate(n)}
                      disabled={rating}
                      style={styles.starBtn}
                    >
                      <Text style={[styles.star, n <= score && styles.starActive]}>★</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              style={styles.composerInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment…"
              placeholderTextColor={studentTheme.textSubtle}
              multiline
            />
            <Pressable
              style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
              disabled={!draft.trim() || sending}
              onPress={() => void onComment()}
            >
              <Text style={styles.sendBtnText}>{sending ? '…' : 'Send'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, gap: 14, paddingBottom: 20 },
  card: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  titleRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  subject: { flex: 1, fontSize: 16, fontWeight: '800', color: studentTheme.text },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '800' },
  meta: { fontSize: 12, color: studentTheme.textMuted },
  description: {
    fontSize: 14,
    color: studentTheme.text,
    lineHeight: 20,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  muted: { fontSize: 13, color: studentTheme.textMuted },
  commentRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 4,
  },
  commentBody: { fontSize: 14, color: studentTheme.text, lineHeight: 20 },
  commentMeta: { fontSize: 11, color: studentTheme.textSubtle },
  stars: { flexDirection: 'row', gap: 6, marginTop: 4 },
  starBtn: { padding: 4 },
  star: { fontSize: 28, color: '#cbd5e1' },
  starActive: { color: '#f59e0b' },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: studentTheme.border,
    backgroundColor: studentTheme.surface,
    alignItems: 'flex-end',
  },
  composerInput: {
    flex: 1,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: studentTheme.text,
    backgroundColor: '#f8fafc',
  },
  sendBtn: {
    backgroundColor: studentTheme.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
