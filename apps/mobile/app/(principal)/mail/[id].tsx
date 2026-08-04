import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { principalTheme } from '@/components/principal-portal/theme';
import { fetchPrincipalMessage, principalMessageAction } from '@/services/principal-comms';
import type { PrincipalMailMessage } from '@/types/principal-desk';

export default function PrincipalMailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [message, setMessage] = useState<PrincipalMailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        setMessage(await fetchPrincipalMessage(id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open message');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function act(action: 'star' | 'unstar' | 'archive' | 'trash' | 'markUnread') {
    if (!id) return;
    try {
      await principalMessageAction(id, action);
      if (action === 'archive' || action === 'trash') {
        router.back();
        return;
      }
      setMessage(await fetchPrincipalMessage(id));
    } catch (e) {
      Alert.alert('Action failed', e instanceof Error ? e.message : 'Try again');
    }
  }

  return (
    <PrincipalScreenShell
      title="Message"
      subtitle={message?.fromAddress ?? 'Mail'}
      rightSlot={
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={principalTheme.primaryAccent} />
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : message ? (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.actions}>
            <Pressable
              style={styles.chip}
              onPress={() => router.push(`/(principal)/compose?replyTo=${message.id}` as Href)}
            >
              <Text style={styles.chipText}>Reply</Text>
            </Pressable>
            <Pressable
              style={styles.chip}
              onPress={() => void act(message.starred ? 'unstar' : 'star')}
            >
              <Text style={styles.chipText}>{message.starred ? 'Unstar' : 'Star'}</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => void act('archive')}>
              <Text style={styles.chipText}>Archive</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => void act('trash')}>
              <Text style={styles.chipText}>Trash</Text>
            </Pressable>
          </View>
          <Text style={styles.subject}>{message.subject || '(no subject)'}</Text>
          <Text style={styles.meta}>From: {message.fromName || message.fromAddress}</Text>
          <Text style={styles.meta}>{new Date(message.receivedAt).toLocaleString('en-IN')}</Text>
          <Text style={styles.body}>
            {message.bodyText ||
              (message.bodyHtml
                ? message.bodyHtml
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                : message.snippet)}
          </Text>
        </ScrollView>
      ) : null}
    </PrincipalScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: principalTheme.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: principalTheme.primaryAccent, fontWeight: '700', fontSize: 12 },
  subject: { fontSize: 18, fontWeight: '800', color: principalTheme.text },
  meta: { fontSize: 12, color: principalTheme.textMuted },
  body: { fontSize: 14, color: principalTheme.text, lineHeight: 22, marginTop: 8 },
  back: { color: principalTheme.primaryAccent, fontWeight: '700' },
  error: { color: principalTheme.urgent, padding: 16 },
});
