import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { principalTheme } from '@/components/principal-portal/theme';
import {
  downloadPrincipalAttachment,
  fetchPrincipalMessage,
  principalMessageAction,
} from '@/services/principal-comms';
import type { PrincipalMailMessage } from '@/types/principal-desk';
import {
  extractLinkedFilesFromMailBody,
  plainTextFromHtml,
  stripLinkedFileMarkup,
} from '@/utils/mail-body-links';

function gmailBase64ToStandard(data: string) {
  return data.replace(/-/g, '+').replace(/_/g, '/');
}

async function saveAndShareAttachment(file: {
  filename: string;
  mimeType: string;
  dataBase64Url: string;
}) {
  const safe = (file.filename || 'attachment').replace(/[^\w.\-()+ ]+/g, '_');
  const uri = `${FileSystem.cacheDirectory}mail-${Date.now()}-${safe}`;
  await FileSystem.writeAsStringAsync(uri, gmailBase64ToStandard(file.dataBase64Url), {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(uri, {
    mimeType: file.mimeType || 'application/octet-stream',
    dialogTitle: file.filename,
  });
}

export default function PrincipalMailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [message, setMessage] = useState<PrincipalMailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  const bodySource = useMemo(() => {
    if (!message) return '';
    const parts = [message.bodyText, message.bodyHtml, message.snippet].filter(Boolean);
    return parts.join('\n');
  }, [message]);

  const linkedFiles = useMemo(() => extractLinkedFilesFromMailBody(bodySource), [bodySource]);

  const displayBody = useMemo(() => {
    const primary =
      message?.bodyText?.trim() ||
      (message?.bodyHtml ? plainTextFromHtml(message.bodyHtml) : '') ||
      message?.snippet ||
      '';
    return stripLinkedFileMarkup(primary);
  }, [message]);

  const mimeAttachments = message?.attachments ?? [];

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

  async function openLinked(url: string) {
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert('Cannot open link', url);
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Open failed', e instanceof Error ? e.message : 'Try again');
    }
  }

  async function downloadMime(attId: string, filename: string) {
    setDownloadingId(attId);
    try {
      const file = await downloadPrincipalAttachment(attId);
      await saveAndShareAttachment({
        filename: file.filename || filename,
        mimeType: file.mimeType,
        dataBase64Url: file.dataBase64Url,
      });
    } catch (e) {
      Alert.alert('Download failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setDownloadingId(null);
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

          {(mimeAttachments.length > 0 || linkedFiles.length > 0) && (
            <View style={styles.attachBox}>
              <Text style={styles.attachTitle}>Attachments</Text>
              {mimeAttachments.map((a) => (
                <Pressable
                  key={a.id}
                  style={styles.attachRow}
                  disabled={downloadingId === a.id}
                  onPress={() => void downloadMime(a.id, a.filename)}
                >
                  <View style={styles.attachIcon}>
                    {downloadingId === a.id ? (
                      <ActivityIndicator size="small" color={principalTheme.primaryAccent} />
                    ) : (
                      <Ionicons
                        name="download-outline"
                        size={18}
                        color={principalTheme.primaryAccent}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachName} numberOfLines={2}>
                      {a.filename}
                    </Text>
                    <Text style={styles.attachHint}>
                      {a.sizeBytes > 0
                        ? `${Math.max(1, Math.round(a.sizeBytes / 1024))} KB · Tap to download`
                        : 'Tap to download'}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {linkedFiles.map((f) => (
                <Pressable
                  key={f.url}
                  style={styles.attachRow}
                  onPress={() => void openLinked(f.url)}
                >
                  <View style={styles.attachIcon}>
                    <Ionicons name="open-outline" size={18} color={principalTheme.primaryAccent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachName} numberOfLines={2}>
                      {f.label}
                    </Text>
                    <Text style={styles.attachHint}>
                      {f.url.includes('drive.google.com')
                        ? 'Google Drive · Tap to open'
                        : 'Link · Tap to open'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.body}>{displayBody || message.snippet}</Text>
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
  attachBox: {
    marginTop: 4,
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: principalTheme.border,
    backgroundColor: principalTheme.surface,
  },
  attachTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: principalTheme.textSubtle,
  },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: principalTheme.primarySoft,
  },
  attachIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  attachName: { fontSize: 13, fontWeight: '700', color: principalTheme.text },
  attachHint: { fontSize: 11, color: principalTheme.textMuted, marginTop: 2 },
  body: { fontSize: 14, color: principalTheme.text, lineHeight: 22, marginTop: 8 },
  back: { color: principalTheme.primaryAccent, fontWeight: '700' },
  error: { color: principalTheme.urgent, padding: 16 },
});
