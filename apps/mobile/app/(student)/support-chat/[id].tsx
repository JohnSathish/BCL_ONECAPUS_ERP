import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  closeStudentChat,
  fetchStudentChat,
  formatSupportCategory,
  formatSupportStatus,
  markStudentChatRead,
  sendStudentChatMessage,
  supportStatusColor,
  type SupportChatMessage,
  type SupportChatThread,
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

export default function StudentSupportChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listRef = useRef<FlatList<SupportChatMessage>>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [thread, setThread] = useState<SupportChatThread | null>(null);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchStudentChat(id);
      setThread(data);
      void markStudentChatRead(id).catch(() => undefined);
    } catch (e) {
      Alert.alert('Could not load chat', e instanceof Error ? e.message : 'Try again');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const timer = setInterval(() => {
      void fetchStudentChat(id)
        .then((data) => {
          setThread(data);
          void markStudentChatRead(id).catch(() => undefined);
        })
        .catch(() => undefined);
    }, 8000);
    return () => clearInterval(timer);
  }, [id]);

  async function onSend() {
    if (!id || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const msg = await sendStudentChatMessage(id, text);
      setThread((prev) =>
        prev
          ? {
              ...prev,
              messages: [...(prev.messages ?? []), msg],
              lastMessagePreview: text,
              lastMessageAt: msg.createdAt,
            }
          : prev,
      );
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setDraft(text);
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSending(false);
    }
  }

  function onClose() {
    if (!id) return;
    Alert.alert('Close chat?', 'You can still raise a ticket later if needed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setClosing(true);
            try {
              const updated = await closeStudentChat(id);
              setThread(updated);
            } catch (e) {
              Alert.alert('Could not close', e instanceof Error ? e.message : 'Try again');
            } finally {
              setClosing(false);
            }
          })();
        },
      },
    ]);
  }

  const messages = thread?.messages ?? [];
  const closed = ['CLOSED', 'RESOLVED'].includes(thread?.status?.toUpperCase() ?? '');
  const statusColor = supportStatusColor(thread?.status ?? '');

  return (
    <StudentScreenShell
      title={thread?.subject?.trim() || 'Live chat'}
      subtitle={
        thread
          ? `${formatSupportCategory(thread.category)} · ${formatSupportStatus(thread.status)}`
          : 'Support Centre'
      }
      rightSlot={
        thread && !closed ? (
          <Pressable onPress={onClose} disabled={closing} hitSlop={8}>
            <Text style={styles.headerAction}>{closing ? '…' : 'Close'}</Text>
          </Pressable>
        ) : null
      }
    >
      {loading && !thread ? (
        <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 32 }} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <View style={styles.metaBar}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {formatSupportStatus(thread?.status ?? '')}
              </Text>
            </View>
            {thread?.agent?.displayName ? (
              <Text style={styles.metaText}>Agent: {thread.agent.displayName}</Text>
            ) : (
              <Text style={styles.metaText}>Waiting for an agent…</Text>
            )}
            {thread?.ticket?.ticketNo ? (
              <Pressable
                onPress={() =>
                  router.push(`/(student)/support-ticket/${thread.ticket!.id}` as never)
                }
              >
                <Text style={styles.ticketLink}>Ticket {thread.ticket.ticketNo}</Text>
              </Pressable>
            ) : null}
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={styles.empty}>No messages yet. Say hello to start.</Text>
            }
            renderItem={({ item }) => {
              const mine = item.senderRole === 'STUDENT';
              return (
                <View style={[styles.bubbleWrap, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMineBg : styles.bubbleTheirsBg]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                      {item.bodyTranslated || item.bodyOriginal}
                    </Text>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                      {formatWhen(item.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {closed ? (
            <View style={styles.closedBar}>
              <Text style={styles.closedText}>This chat is closed.</Text>
            </View>
          ) : (
            <View style={styles.composer}>
              <TextInput
                style={styles.composerInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="Type a message…"
                placeholderTextColor={studentTheme.textSubtle}
                multiline
              />
              <Pressable
                style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
                disabled={!draft.trim() || sending}
                onPress={() => void onSend()}
              >
                <Text style={styles.sendBtnText}>{sending ? '…' : 'Send'}</Text>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerAction: { color: '#fff', fontSize: 13, fontWeight: '700' },
  metaBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: studentTheme.surface,
    borderBottomWidth: 1,
    borderBottomColor: studentTheme.border,
  },
  metaText: { fontSize: 12, color: studentTheme.textMuted },
  ticketLink: { fontSize: 12, fontWeight: '700', color: studentTheme.primaryLight },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '800' },
  messageList: { padding: 16, gap: 8, paddingBottom: 20 },
  empty: { textAlign: 'center', color: studentTheme.textMuted, marginTop: 40 },
  bubbleWrap: { marginBottom: 8, maxWidth: '82%' },
  bubbleMine: { alignSelf: 'flex-end' },
  bubbleTheirs: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, gap: 4 },
  bubbleMineBg: { backgroundColor: studentTheme.primary, borderBottomRightRadius: 4 },
  bubbleTheirsBg: {
    backgroundColor: studentTheme.surface,
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, color: studentTheme.text, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: studentTheme.textSubtle },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
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
  closedBar: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: studentTheme.border,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  closedText: { fontSize: 13, color: studentTheme.textMuted, fontWeight: '600' },
});
