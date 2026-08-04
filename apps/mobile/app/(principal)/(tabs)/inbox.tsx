import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { principalTheme } from '@/components/principal-portal/theme';
import { fetchPrincipalMessages, startPrincipalMailboxOAuth } from '@/services/principal-comms';
import type { PrincipalMailListItem } from '@/types/principal-desk';

const FOLDERS = [
  { key: 'INBOX', label: 'Inbox' },
  { key: 'SENT', label: 'Sent' },
  { key: 'DRAFTS', label: 'Drafts' },
  { key: 'ARCHIVE', label: 'Archive' },
] as const;

export default function PrincipalInboxScreen() {
  const router = useRouter();
  const [folder, setFolder] = useState<(typeof FOLDERS)[number]['key']>('INBOX');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PrincipalMailListItem[]>([]);
  const [account, setAccount] = useState<{ id: string; googleEmail: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const res = await fetchPrincipalMessages({
          folder,
          q: q.trim() || undefined,
          take: 40,
        });
        setItems(res.items ?? []);
        setAccount(res.account);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load mail');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [folder, q],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function connectMailbox() {
    try {
      const { authUrl } = await startPrincipalMailboxOAuth('PERSONAL');
      await Linking.openURL(authUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start Google connect');
    }
  }

  return (
    <PrincipalScreenShell
      title="Inbox"
      subtitle={account?.googleEmail ?? 'Principal Mail'}
      rightSlot={
        <Pressable onPress={() => router.push('/(principal)/compose' as Href)}>
          <Text style={styles.compose}>Compose</Text>
        </Pressable>
      }
    >
      <View style={styles.filters}>
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

          {!account ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Mailbox not connected</Text>
              <Text style={styles.muted}>
                Connect Google Workspace to read and reply without leaving the app.
              </Text>
              <Pressable style={styles.connectBtn} onPress={() => void connectMailbox()}>
                <Text style={styles.connectText}>Connect Google</Text>
              </Pressable>
            </View>
          ) : items.length === 0 ? (
            <Text style={styles.muted}>No messages in this folder.</Text>
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
    </PrincipalScreenShell>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
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
});
