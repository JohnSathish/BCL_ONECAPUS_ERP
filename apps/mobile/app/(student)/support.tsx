import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/constants/release';
import {
  SUPPORT_CATEGORIES,
  createStudentTicket,
  fetchStudentChats,
  fetchStudentSupportFaq,
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

const QUICK_ICONS: Record<string, string> = {
  ADMISSIONS: '🎓',
  FEES: '₹',
  SCHOLARSHIPS: '🏅',
  EXAMINATION: '📝',
  RESULTS: '📊',
  CERTIFICATES: '📄',
  HOSTEL: '🏠',
  LIBRARY: '📚',
  TRANSPORT: '🚌',
  ERP_LOGIN: '🔐',
  TECHNICAL: '🛠️',
  GENERAL: '💬',
};

function ContactRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.contactRow}>
      <Text style={styles.contactIcon}>{icon}</Text>
      <View style={styles.listInfo}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}

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
  const [query, setQuery] = useState('');
  const [faqOpen, setFaqOpen] = useState(false);
  const [faq, setFaq] = useState<
    Array<{
      id: string;
      name: string;
      articles: Array<{ id: string; question: string; answer: string }>;
    }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c, t] = await Promise.all([
        fetchStudentSupportMeta(),
        fetchStudentChats(),
        fetchStudentTickets(),
      ]);
      const topics = await fetchStudentSupportFaq().catch(() => []);
      setMeta(m);
      setChats(c);
      setTickets(t);
      setFaq(topics ?? []);
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

  function openCompose(mode: 'chat' | 'ticket', presetCategory?: string) {
    setComposeMode(mode);
    setSubject('');
    setBody('');
    setCategory(presetCategory ?? meta?.categories?.[0] ?? SUPPORT_CATEGORIES[0]);
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
  const needle = query.trim().toLowerCase();
  const faqHits = needle
    ? faq.flatMap((group) =>
        group.articles
          .filter(
            (article) =>
              article.question.toLowerCase().includes(needle) ||
              article.answer.toLowerCase().includes(needle),
          )
          .map((article) => ({ ...article, group: group.name })),
      )
    : [];
  const requests = [
    ...chats.map((chat) => ({
      id: `chat-${chat.id}`,
      title: chat.subject?.trim() || formatSupportCategory(chat.category) || 'Support chat',
      detail: chat.lastMessagePreview || 'Live chat',
      status: chat.status,
      when: chat.lastMessageAt ?? '',
      href: `/(student)/support-chat/${chat.id}`,
    })),
    ...tickets.map((ticket) => ({
      id: `ticket-${ticket.id}`,
      title: `${ticket.ticketNo} · ${ticket.subject}`,
      detail: formatSupportCategory(ticket.category),
      status: ticket.status,
      when: ticket.updatedAt,
      href: `/(student)/support-ticket/${ticket.id}`,
    })),
  ].sort((a, b) => String(b.when).localeCompare(String(a.when)));
  const officeName = meta?.offices?.[0]?.name || 'College Office';
  const contactEmail = meta?.settings?.contactEmail;
  const contactPhone = meta?.settings?.contactPhone;
  const supportHours = meta?.settings?.supportHours;

  return (
    <StudentScreenShell title="Support Centre" subtitle="Help & requests">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search help topics..."
            placeholderTextColor="#94A3B8"
          />
        </View>

        {faqHits.length ? (
          <View style={styles.card}>
            {faqHits.slice(0, 6).map((hit) => (
              <View key={hit.id} style={styles.faqHit}>
                <Text style={styles.listTitle}>{hit.question}</Text>
                <Text style={styles.listPreview}>{hit.answer}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Quick Help</Text>
        <View style={styles.chipWrap}>
          {categories.map((cat) => (
            <Pressable
              key={cat}
              style={styles.quickChip}
              onPress={() => openCompose('ticket', cat)}
            >
              <Text style={styles.quickIcon}>{QUICK_ICONS[cat] ?? '•'}</Text>
              <Text style={styles.quickText}>{formatSupportCategory(cat)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Welcome to Support Centre</Text>
          <Text style={styles.welcomeText}>
            {meta?.settings?.welcomeMessage?.trim() ||
              'How can we help you today? Start a live chat or raise a support ticket.'}
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => openCompose('chat')}>
            <Text style={styles.primaryBtnText}>Start Live Chat</Text>
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => openCompose('ticket')}>
            <Text style={styles.outlineBtnText}>Raise Support Ticket</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>My Requests</Text>
          <Text style={styles.countLabel}>{requests.length} Total</Text>
        </View>
        {loading && requests.length === 0 ? (
          <ActivityIndicator color={studentTheme.primary} />
        ) : requests.length === 0 ? (
          <Text style={styles.muted}>No chats or tickets yet.</Text>
        ) : (
          requests.map((item) => {
            const color = supportStatusColor(item.status);
            return (
              <Pressable
                key={item.id}
                style={styles.requestCard}
                onPress={() => router.push(item.href as never)}
              >
                <View style={styles.listInfo}>
                  <Text style={styles.listTitle}>{item.title}</Text>
                  <Text style={styles.listPreview}>{item.detail}</Text>
                  {item.when ? <Text style={styles.listMeta}>{formatWhen(item.when)}</Text> : null}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${color}18` }]}>
                  <Text style={[styles.statusText, { color }]}>
                    {formatSupportStatus(item.status)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}

        <Text style={styles.sectionLabel}>Contact Information</Text>
        <View style={styles.card}>
          <ContactRow icon="🏫" label="College Office" value={officeName} />
          {contactPhone ? (
            <ContactRow
              icon="📞"
              label="Phone"
              value={contactPhone}
              onPress={() => void Linking.openURL(`tel:${contactPhone.replace(/[^\d+]/g, '')}`)}
            />
          ) : null}
          {contactEmail ? (
            <ContactRow
              icon="✉️"
              label="Email"
              value={contactEmail}
              onPress={() => void Linking.openURL(`mailto:${contactEmail}`)}
            />
          ) : null}
          {supportHours ? <ContactRow icon="🕐" label="Office Hours" value={supportHours} /> : null}
        </View>

        <Text style={styles.sectionLabel}>Helpful Links</Text>
        <Pressable style={styles.linkCard} onPress={() => setFaqOpen(true)}>
          <Text style={styles.linkIcon}>❓</Text>
          <Text style={styles.linkText}>FAQ</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable style={styles.linkCard} onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}>
          <Text style={styles.linkIcon}>🔒</Text>
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable style={styles.linkCard} onPress={() => void Linking.openURL(TERMS_URL)}>
          <Text style={styles.linkIcon}>📋</Text>
          <Text style={styles.linkText}>Terms & Conditions</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
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

      <Modal visible={faqOpen} animationType="slide" onRequestClose={() => setFaqOpen(false)}>
        <View style={styles.faqModal}>
          <Text style={styles.modalTitle}>FAQ</Text>
          <ScrollView contentContainerStyle={styles.faqList}>
            {faq.length === 0 ? (
              <Text style={styles.muted}>No help topics have been published yet.</Text>
            ) : (
              faq.map((group) => (
                <View key={group.id} style={styles.faqGroup}>
                  <Text style={styles.sectionLabel}>{group.name}</Text>
                  {group.articles.map((article) => (
                    <View key={article.id} style={styles.faqHit}>
                      <Text style={styles.listTitle}>{article.question}</Text>
                      <Text style={styles.listPreview}>{article.answer}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
          <Pressable style={styles.primaryBtn} onPress={() => setFaqOpen(false)}>
            <Text style={styles.primaryBtnText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: studentTheme.text },
  sectionLabel: { fontSize: 15, fontWeight: '800', color: studentTheme.text, marginTop: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickIcon: { fontSize: 13 },
  quickText: { fontSize: 12, fontWeight: '700', color: studentTheme.text },
  welcomeCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  welcomeTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  welcomeText: { fontSize: 13, color: studentTheme.textMuted, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: studentTheme.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  outlineBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  outlineBtnText: { color: studentTheme.primary, fontSize: 14, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countLabel: { fontSize: 12, fontWeight: '700', color: studentTheme.textMuted },
  requestCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    padding: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    padding: 12,
    gap: 8,
  },
  contactRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 4 },
  contactIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  contactLabel: { fontSize: 11, color: studentTheme.textMuted, fontWeight: '700' },
  contactValue: { fontSize: 14, fontWeight: '700', color: studentTheme.text },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    padding: 12,
  },
  linkIcon: { fontSize: 16 },
  linkText: { flex: 1, fontSize: 14, fontWeight: '800', color: studentTheme.text },
  chevron: { fontSize: 22, color: '#9CA3AF' },
  faqHit: { gap: 2, paddingVertical: 6 },
  faqModal: { flex: 1, backgroundColor: '#F8FAFC', padding: 16, paddingTop: 48, gap: 12 },
  faqList: { gap: 12, paddingBottom: 20 },
  faqGroup: { gap: 8 },
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
