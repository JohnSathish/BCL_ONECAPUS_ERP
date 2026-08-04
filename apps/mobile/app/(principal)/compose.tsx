import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { principalTheme } from '@/components/principal-portal/theme';
import {
  fetchPrincipalCommsStats,
  fetchPrincipalMessage,
  sendPrincipalMail,
} from '@/services/principal-comms';

export default function PrincipalComposeScreen() {
  const router = useRouter();
  const { replyTo } = useLocalSearchParams<{ replyTo?: string }>();
  const [accountId, setAccountId] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const stats = await fetchPrincipalCommsStats();
        if (stats.accountId) setAccountId(stats.accountId);
        if (replyTo) {
          const msg = await fetchPrincipalMessage(replyTo);
          setTo(msg.fromAddress || '');
          setSubject(`Re: ${msg.subject || ''}`.replace(/^Re: Re:/, 'Re:'));
          setBody(
            `\n\n---\nOn ${msg.receivedAt}, ${msg.fromName || msg.fromAddress} wrote:\n${msg.bodyText || msg.snippet}`,
          );
        }
      } catch (e) {
        Alert.alert('Compose unavailable', e instanceof Error ? e.message : 'Try again');
      } finally {
        setLoading(false);
      }
    })();
  }, [replyTo]);

  async function send() {
    if (!accountId) {
      Alert.alert('Connect mailbox first', 'Open Inbox and connect Google Workspace.');
      return;
    }
    const recipients = to
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!recipients.length) {
      Alert.alert('Add recipients');
      return;
    }
    setSending(true);
    try {
      await sendPrincipalMail({
        accountId,
        toAddresses: recipients,
        subject,
        bodyHtml: `<pre style="font-family:sans-serif;white-space:pre-wrap">${body
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</pre>`,
        replyToMessageId: replyTo,
      });
      Alert.alert('Sent');
      router.back();
    } catch (e) {
      Alert.alert('Send failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSending(false);
    }
  }

  return (
    <PrincipalScreenShell
      title={replyTo ? 'Reply' : 'Compose'}
      subtitle="Principal Mail"
      rightSlot={
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Close</Text>
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={principalTheme.primaryAccent} />
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="To (comma-separated)"
            placeholderTextColor={principalTheme.textSubtle}
            value={to}
            onChangeText={setTo}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Subject"
            placeholderTextColor={principalTheme.textSubtle}
            value={subject}
            onChangeText={setSubject}
          />
          <TextInput
            style={[styles.input, styles.body]}
            placeholder="Message"
            placeholderTextColor={principalTheme.textSubtle}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
          />
          <Pressable style={styles.send} disabled={sending} onPress={() => void send()}>
            <Text style={styles.sendText}>{sending ? 'Sending…' : 'Send'}</Text>
          </Pressable>
        </View>
      )}
    </PrincipalScreenShell>
  );
}

const styles = StyleSheet.create({
  form: { flex: 1, padding: 16, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  input: {
    backgroundColor: principalTheme.surface,
    borderWidth: 1,
    borderColor: principalTheme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: principalTheme.text,
  },
  body: { flex: 1, minHeight: 180 },
  send: {
    backgroundColor: principalTheme.primaryAccent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendText: { color: '#fff', fontWeight: '800' },
  back: { color: principalTheme.primaryAccent, fontWeight: '700' },
});
