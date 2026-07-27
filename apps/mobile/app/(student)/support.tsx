import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  SUPPORT_CATEGORIES,
  createStudentTicket,
  fetchStudentChats,
  fetchStudentSupportMeta,
  fetchStudentTickets,
  formatSupportCategory,
  formatSupportStatus,
  openStudentChat,
  supportStatusColor,
  type SupportChatThread,
  type SupportMeta,
  type SupportTicket,
} from '@/services/support-centre';

type Tab = 'chat' | 'tickets';

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

export default function StudentSupportScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('chat');
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<SupportMeta | null>(null);
  const [chats, setChats] = useState<SupportChatThread[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<'chat' | 'ticket'>('chat');
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<string>('GENERAL');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c, t] = await Promise.all([
        fetchStudentSupportMeta(),
        fetchStudentChats(),
        fetchStudentTickets(),
      ]);
      setMeta(m);
      setChats(c);
      setTickets(t);
      setCategory((prev) =>
        m.categories?.length && !m.categories.includes(prev) ? m.categories[0] : prev,
      );
    } catch {
      setMeta(null);
      setChats([]);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCompose(mode: 'chat' | 'ticket') {
    setComposeMode(mode);
    setSubject('');
    setBody('');
    setCategory(meta?.categories?.[0] ?? SUPPORT_CATEGORIES[0]);
    setComposeOpen(true);
  }

  async function onSubmitCompose() {
    if (composeMode === 'ticket' && !subject.trim()) {
      Alert.alert('Subject required', 'Add a short subject for your ticket.');
      return;
    }
    if (!body.trim()) {
      Alert.alert(
        composeMode === 'chat' ? 'Message required' : 'Description required',
        composeMode === 'chat'
          ? 'Write a message to start the chat.'
          : 'Describe your issue briefly.',
      );
      return;
    }

    setSubmitting(true);
    try {
      if (composeMode === 'chat') {
        const thread = await openStudentChat({
          category,
          subject: subject.trim() || undefined,
          initialMessage: body.trim(),
        });
        setComposeOpen(false);
        await load();
        router.push(`/(student)/support-chat/${thread.id}` as never);
      } else {
        const ticket = await createStudentTicket({
          category,
          subject: subject.trim(),
          description: body.trim(),
        });
        setComposeOpen(false);
        await load();
        router.push(`/(student)/support-ticket/${ticket.id}` as never);
      }
    } catch (e) {
      Alert.alert('Could not submit', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSubmitting(false);
    }
  }

  const categories = meta?.categories?.length ? meta.categories : [...SUPPORT_CATEGORIES];
  const openChats = chats.filter((c) => !['CLOSED', 'RESOLVED'].includes(c.status?.toUpperCase()));
  const openTickets = tickets.filter(
    (t) => !['CLOSED', 'RESOLVED', 'DONE'].includes(t.status?.toUpperCase()),
  );

  return (
    <StudentScreenShell title="Support Centre" subtitle="Live chat & tickets">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        keyboardShouldPersistTaps="handled"
      >
        {loading && !meta ? (
          <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeTitle}>How can we help?</Text>
              <Text style={styles.welcomeText}>
                {meta?.settings?.welcomeMessage?.trim() ||
                  'Chat with campus support or raise a ticket for follow-up.'}
              </Text>
              {meta?.settings?.supportHours ? (
                <Text style={styles.welcomeMeta}>Hours: {meta.settings.supportHours}</Text>
              ) : null}
              {(meta?.settings?.contactEmail || meta?.settings?.contactPhone) && (
                <Text style={styles.welcomeMeta}>
                  {[meta.settings.contactEmail, meta.settings.contactPhone]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.actionBtn} onPress={() => openCompose('chat')}>
                <Text style={styles.actionBtnText}>Start chat</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={() => openCompose('ticket')}
              >
                <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
                  Raise ticket
                </Text>
              </Pressable>
            </View>

            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tab, tab === 'chat' && styles.tabActive]}
                onPress={() => setTab('chat')}
              >
                <Text style={[styles.tabText, tab === 'chat' && styles.tabTextActive]}>
                  Chats ({openChats.length})
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, tab === 'tickets' && styles.tabActive]}
                onPress={() => setTab('tickets')}
              >
                <Text style={[styles.tabText, tab === 'tickets' && styles.tabTextActive]}>
                  Tickets ({openTickets.length})
                </Text>
              </Pressable>
            </View>

            {tab === 'chat' ? (
              <View style={styles.listCard}>
                {chats.length === 0 ? (
                  <Text style={styles.muted}>No chats yet. Start a conversation with support.</Text>
                ) : (
                  chats.map((chat) => {
                    const color = supportStatusColor(chat.status);
                    return (
                      <Pressable
                        key={chat.id}
                        style={styles.listRow}
                        onPress={() => router.push(`/(student)/support-chat/${chat.id}` as never)}
                      >
                        <View style={styles.listInfo}>
                          <View style={styles.listTitleRow}>
                            <Text style={styles.listTitle} numberOfLines={1}>
                              {chat.subject?.trim() ||
                                formatSupportCategory(chat.category) ||
                                'Support chat'}
                            </Text>
                            {(chat.unreadStudent ?? 0) > 0 ? (
                              <View style={styles.unreadDot}>
                                <Text style={styles.unreadText}>{chat.unreadStudent}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.listPreview} numberOfLines={1}>
                            {chat.lastMessagePreview || formatSupportCategory(chat.category)}
                          </Text>
                          <Text style={styles.listMeta}>
                            {formatWhen(chat.lastMessageAt) || '—'}
                            {chat.agent?.displayName ? ` · ${chat.agent.displayName}` : ''}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: `${color}18` }]}>
                          <Text style={[styles.statusText, { color }]}>
                            {formatSupportStatus(chat.status)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : (
              <View style={styles.listCard}>
                {tickets.length === 0 ? (
                  <Text style={styles.muted}>No tickets yet. Raise one for tracked support.</Text>
                ) : (
                  tickets.map((ticket) => {
                    const color = supportStatusColor(ticket.status);
                    return (
                      <Pressable
                        key={ticket.id}
                        style={styles.listRow}
                        onPress={() =>
                          router.push(`/(student)/support-ticket/${ticket.id}` as never)
                        }
                      >
                        <View style={styles.listInfo}>
                          <Text style={styles.listTitle} numberOfLines={1}>
                            {ticket.ticketNo} · {ticket.subject}
                          </Text>
                          <Text style={styles.listPreview} numberOfLines={1}>
                            {formatSupportCategory(ticket.category)}
                            {ticket.department?.name ? ` · ${ticket.department.name}` : ''}
                          </Text>
                          <Text style={styles.listMeta}>{formatWhen(ticket.updatedAt)}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: `${color}18` }]}>
                          <Text style={[styles.statusText, { color }]}>
                            {formatSupportStatus(ticket.status)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={composeOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setComposeOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {composeMode === 'chat' ? 'Start live chat' : 'Raise a ticket'}
            </Text>

            <Text style={styles.label}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.chip, category === cat && styles.chipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                    {formatSupportCategory(cat)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Subject{composeMode === 'chat' ? ' (optional)' : ''}</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder={composeMode === 'chat' ? 'Brief topic' : 'What do you need help with?'}
              placeholderTextColor={studentTheme.textSubtle}
            />

            <Text style={styles.label}>{composeMode === 'chat' ? 'Message' : 'Description'}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={body}
              onChangeText={setBody}
              placeholder={
                composeMode === 'chat'
                  ? 'Describe your question…'
                  : 'Add details so support can help faster…'
              }
              placeholderTextColor={studentTheme.textSubtle}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setComposeOpen(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                disabled={submitting}
                onPress={() => void onSubmitCompose()}
              >
                <Text style={styles.submitBtnText}>
                  {submitting
                    ? 'Sending…'
                    : composeMode === 'chat'
                      ? 'Start chat'
                      : 'Submit ticket'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 28 },
  welcomeCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4,
  },
  welcomeTitle: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  welcomeText: { fontSize: 13, color: studentTheme.textMuted, lineHeight: 18 },
  welcomeMeta: { fontSize: 12, color: studentTheme.primaryLight, fontWeight: '600', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: studentTheme.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: studentTheme.surface,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  actionBtnTextSecondary: { color: studentTheme.primary },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: studentTheme.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#eff6ff' },
  tabText: { fontSize: 13, fontWeight: '700', color: studentTheme.textMuted },
  tabTextActive: { color: studentTheme.primaryLight },
  listCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  listRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'flex-start',
  },
  listInfo: { flex: 1, gap: 2 },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: studentTheme.text },
  listPreview: { fontSize: 12, color: studentTheme.textMuted },
  listMeta: { fontSize: 11, color: studentTheme.textSubtle, marginTop: 2 },
  unreadDot: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: studentTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '800' },
  muted: { fontSize: 13, color: studentTheme.textMuted, paddingVertical: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: studentTheme.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    gap: 8,
    maxHeight: '88%',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: studentTheme.text, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: studentTheme.textMuted, marginTop: 4 },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  chipActive: { backgroundColor: '#eff6ff', borderColor: studentTheme.primaryLight },
  chipText: { fontSize: 12, fontWeight: '700', color: studentTheme.text },
  chipTextActive: { color: studentTheme.primaryLight },
  input: {
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: studentTheme.text,
    backgroundColor: '#f8fafc',
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: studentTheme.textMuted },
  submitBtn: {
    flex: 1.4,
    backgroundColor: studentTheme.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
