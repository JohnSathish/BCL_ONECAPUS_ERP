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
  fetchPrincipalMailboxAccounts,
  fetchPrincipalMessage,
  getStoredMailboxAccountId,
  sendPrincipalMail,
  setStoredMailboxAccountId,
  type PrincipalMailboxAccount,
} from '@/services/principal-comms';

export default function PrincipalComposeScreen() {
  const router = useRouter();
  const { replyTo, accountId: accountIdParam } = useLocalSearchParams<{
    replyTo?: string;
    accountId?: string;
  }>();
  const [accounts, setAccounts] = useState<PrincipalMailboxAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const fromEmail = accounts.find((a) => a.id === accountId)?.googleEmail;

  useEffect(() => {
    void (async () => {
      try {
        const [list, stored] = await Promise.all([
          fetchPrincipalMailboxAccounts(),
          getStoredMailboxAccountId(),
        ]);
        const active = (list ?? []).filter((a) => a.status === 'ACTIVE');
        setAccounts(active);
        const preferred =
          (typeof accountIdParam === 'string' && accountIdParam) || stored || active[0]?.id || '';
        const resolved =
          preferred && active.some((a) => a.id === preferred) ? preferred : active[0]?.id || '';
        setAccountId(resolved);
        if (resolved) await setStoredMailboxAccountId(resolved);

        if (replyTo) {
          const msg = await fetchPrincipalMessage(replyTo);
          setTo(msg.fromAddress || '');
          setSubject(`Re: ${msg.subject || ''}`.replace(/^Re: Re:/, 'Re:'));
          setBody(
            `\n\n---\nOn ${msg.receivedAt}, ${msg.fromName || msg.fromAddress} wrote:\n${msg.bodyText || msg.snippet}`,
          );
          if (msg.account?.id) {
            setAccountId(msg.account.id);
            await setStoredMailboxAccountId(msg.account.id);
          }
        }
      } catch (e) {
        Alert.alert('Compose unavailable', e instanceof Error ? e.message : 'Try again');
      } finally {
        setLoading(false);
      }
    })();
  }, [accountIdParam, replyTo]);

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
      subtitle={fromEmail ?? 'Principal Mail'}
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
          {accounts.length > 1 ? (
            <View style={styles.fromRow}>
              <Text style={styles.fromLabel}>From</Text>
              <View style={styles.fromChips}>
                {accounts.map((a) => (
                  <Pressable
                    key={a.id}
                    style={[styles.fromChip, a.id === accountId && styles.fromChipActive]}
                    onPress={() => {
                      setAccountId(a.id);
                      void setStoredMailboxAccountId(a.id);
                    }}
                  >
                    <Text
                      style={[styles.fromChipText, a.id === accountId && styles.fromChipTextActive]}
                      numberOfLines={1}
                    >
                      {a.googleEmail}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : fromEmail ? (
            <Text style={styles.singleFrom}>From: {fromEmail}</Text>
          ) : null}
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
  fromRow: { gap: 6 },
  fromLabel: { fontSize: 12, fontWeight: '700', color: principalTheme.textMuted },
  fromChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fromChip: {
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: principalTheme.border,
    backgroundColor: principalTheme.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fromChipActive: {
    borderColor: principalTheme.primaryAccent,
    backgroundColor: principalTheme.primarySoft,
  },
  fromChipText: { fontSize: 12, color: principalTheme.textMuted, fontWeight: '600' },
  fromChipTextActive: { color: principalTheme.primaryAccent, fontWeight: '800' },
  singleFrom: { fontSize: 12, color: principalTheme.textMuted, fontWeight: '600' },
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
