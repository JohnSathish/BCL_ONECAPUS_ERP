import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { principalTheme } from '@/components/principal-portal/theme';
import {
  fetchPrincipalMailboxAccounts,
  fetchPrincipalMessages,
  getStoredMailboxAccountId,
  setStoredMailboxAccountId,
  startPrincipalMailboxOAuth,
  syncPrincipalMailbox,
  type PrincipalMailboxAccount,
} from '@/services/principal-comms';
import type { PrincipalMailListItem } from '@/types/principal-desk';

const FOLDERS = [
  { key: 'INBOX', label: 'Inbox' },
  { key: 'SENT', label: 'Sent' },
  { key: 'DRAFTS', label: 'Drafts' },
  { key: 'ARCHIVE', label: 'Archive' },
] as const;

function resolveAccountId(accounts: PrincipalMailboxAccount[], preferred: string | null) {
  const active = accounts.filter((a) => a.status === 'ACTIVE');
  if (!active.length) return null;
  if (preferred && active.some((a) => a.id === preferred)) return preferred;
  return active[0]!.id;
}

export default function PrincipalInboxScreen() {
  const router = useRouter();
  const [folder, setFolder] = useState<(typeof FOLDERS)[number]['key']>('INBOX');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PrincipalMailListItem[]>([]);
  const [accounts, setAccounts] = useState<PrincipalMailboxAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId],
  );

  const loadAccounts = useCallback(async () => {
    const [list, stored] = await Promise.all([
      fetchPrincipalMailboxAccounts(),
      getStoredMailboxAccountId(),
    ]);
    const active = (list ?? []).filter((a) => a.status === 'ACTIVE');
    setAccounts(active);
    const next = resolveAccountId(active, stored);
    setAccountId(next);
    await setStoredMailboxAccountId(next);
    return next;
  }, []);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        let id = accountId;
        if (!id || soft) {
          id = await loadAccounts();
        }
        if (!id) {
          setItems([]);
          return;
        }
        const [res] = await Promise.all([
          fetchPrincipalMessages({
            folder,
            q: q.trim() || undefined,
            take: 40,
            accountId: id,
          }),
          soft
            ? syncPrincipalMailbox({ accountId: id, full: false }).catch(() => null)
            : Promise.resolve(null),
        ]);
        setItems(res.items ?? []);
        if (res.account) {
          setAccounts((prev) =>
            prev.some((a) => a.id === res.account!.id)
              ? prev
              : [...prev, { ...res.account!, accountLabel: 'PERSONAL', status: 'ACTIVE' }],
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load mail');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accountId, folder, loadAccounts, q],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function connectMailbox(label: 'PERSONAL' | 'PRINCIPAL_OFFICE' = 'PERSONAL') {
    try {
      const { authUrl } = await startPrincipalMailboxOAuth(label);
      await Linking.openURL(authUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start Google connect');
    }
  }

  async function switchAccount(id: string) {
    setPickerOpen(false);
    setAccountId(id);
    await setStoredMailboxAccountId(id);
  }

  return (
    <PrincipalScreenShell
      title="Inbox"
      subtitle={activeAccount?.googleEmail ?? 'Principal Mail'}
      rightSlot={
        <Pressable
          onPress={() =>
            router.push(`/(principal)/compose${accountId ? `?accountId=${accountId}` : ''}` as Href)
          }
        >
          <Text style={styles.compose}>Compose</Text>
        </Pressable>
      }
    >
      <View style={styles.filters}>
        <Pressable style={styles.accountBtn} onPress={() => setPickerOpen(true)}>
          <Ionicons name="mail-outline" size={16} color={principalTheme.primaryAccent} />
          <Text style={styles.accountEmail} numberOfLines={1}>
            {activeAccount?.googleEmail ?? 'Select mailbox'}
          </Text>
          {(activeAccount?.unread ?? 0) > 0 ? (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadText}>{activeAccount?.unread}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-down" size={16} color={principalTheme.textMuted} />
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.folderRow}
        >
          {FOLDERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.folderChip, folder === f.key && styles.folderActive]}
              onPress={() => setFolder(f.key)}
            >
              <Text style={[styles.folderText, folder === f.key && styles.folderTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search mail…"
          placeholderTextColor={principalTheme.textSubtle}
          style={styles.search}
          returnKeyType="search"
          onSubmitEditing={() => void load()}
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={principalTheme.primaryAccent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!activeAccount ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Mailbox not connected</Text>
              <Text style={styles.muted}>
                Connect one or more Google accounts, then switch between them here like Gmail.
              </Text>
              <Pressable style={styles.connectBtn} onPress={() => void connectMailbox('PERSONAL')}>
                <Text style={styles.connectText}>Connect Google</Text>
              </Pressable>
            </View>
          ) : items.length === 0 ? (
            <Text style={styles.muted}>No messages in this folder. Pull to sync.</Text>
          ) : (
            items.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.row, !item.isRead && styles.unread]}
                onPress={() => router.push(`/(principal)/mail/${item.id}` as Href)}
              >
                <View style={styles.rowTop}>
                  <Text style={[styles.from, !item.isRead && styles.bold]} numberOfLines={1}>
                    {item.fromName || item.fromAddress || 'Unknown'}
                  </Text>
                  <Text style={styles.date}>
                    {new Date(item.receivedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
                <Text style={[styles.subject, !item.isRead && styles.bold]} numberOfLines={1}>
                  {item.subject || '(no subject)'}
                </Text>
                <Text style={styles.snippet} numberOfLines={1}>
                  {item.snippet}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Switch mailbox</Text>
            {accounts.length === 0 ? (
              <Text style={styles.muted}>No accounts connected yet.</Text>
            ) : (
              accounts.map((a) => (
                <Pressable
                  key={a.id}
                  style={[styles.accountRow, a.id === accountId && styles.accountRowActive]}
                  onPress={() => void switchAccount(a.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountRowEmail}>{a.googleEmail}</Text>
                    <Text style={styles.accountRowMeta}>{a.accountLabel}</Text>
                  </View>
                  {(a.unread ?? 0) > 0 ? (
                    <View style={styles.unreadPill}>
                      <Text style={styles.unreadText}>{a.unread}</Text>
                    </View>
                  ) : null}
                  {a.id === accountId ? (
                    <Ionicons name="checkmark-circle" size={18} color={principalTheme.accent} />
                  ) : null}
                </Pressable>
              ))
            )}
            <Pressable
              style={styles.addAccountBtn}
              onPress={() => {
                setPickerOpen(false);
                void connectMailbox('PERSONAL');
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={principalTheme.primaryAccent} />
              <Text style={styles.addAccountText}>Add another Google account</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </PrincipalScreenShell>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  accountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: principalTheme.surface,
    borderWidth: 1,
    borderColor: principalTheme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  accountEmail: { flex: 1, fontSize: 13, fontWeight: '700', color: principalTheme.text },
  unreadPill: {
    backgroundColor: principalTheme.primaryAccent,
    borderRadius: 999,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  folderRow: { gap: 8, paddingVertical: 4 },
  folderChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: principalTheme.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: principalTheme.surface,
  },
  folderActive: {
    backgroundColor: principalTheme.primarySoft,
    borderColor: principalTheme.primaryAccent,
  },
  folderText: { fontSize: 12, color: principalTheme.textMuted, fontWeight: '600' },
  folderTextActive: { color: principalTheme.primaryAccent },
  search: {
    backgroundColor: principalTheme.surface,
    borderWidth: 1,
    borderColor: principalTheme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: principalTheme.text,
  },
  list: { padding: 16, gap: 8, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    backgroundColor: principalTheme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: principalTheme.border,
    padding: 12,
    gap: 4,
  },
  unread: { backgroundColor: '#F8FAFC' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  from: { flex: 1, fontSize: 13, color: principalTheme.text },
  date: { fontSize: 11, color: principalTheme.textSubtle },
  subject: { fontSize: 13, color: principalTheme.text },
  snippet: { fontSize: 12, color: principalTheme.textMuted },
  bold: { fontWeight: '800' },
  empty: {
    backgroundColor: principalTheme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: principalTheme.border,
    padding: 16,
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: principalTheme.text },
  connectBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: principalTheme.primaryAccent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  connectText: { color: '#fff', fontWeight: '700' },
  compose: { color: principalTheme.primaryAccent, fontWeight: '700', fontSize: 13 },
  muted: { fontSize: 13, color: principalTheme.textMuted },
  error: { color: principalTheme.urgent, fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: principalTheme.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 8,
    paddingBottom: 28,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: principalTheme.text, marginBottom: 4 },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: principalTheme.border,
    padding: 12,
  },
  accountRowActive: {
    borderColor: principalTheme.primaryAccent,
    backgroundColor: principalTheme.primarySoft,
  },
  accountRowEmail: { fontSize: 14, fontWeight: '700', color: principalTheme.text },
  accountRowMeta: { fontSize: 11, color: principalTheme.textMuted, marginTop: 2 },
  addAccountBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  addAccountText: { fontSize: 13, fontWeight: '700', color: principalTheme.primaryAccent },
});
