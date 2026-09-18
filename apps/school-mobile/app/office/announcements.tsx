import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '@/api/client';
import { colors } from '@/theme/tokens';
import { Kpi, OfficeShell, RowCard } from '@/ui/office-shell';

const AUDIENCES = [
  ['all', 'Everyone'],
  ['students', 'Students'],
  ['parents', 'Parents'],
  ['teachers', 'Teachers'],
] as const;

type Broadcast = {
  id: string;
  title: string;
  body: string;
  audience: string;
  createdAt: string;
  status?: string;
};

export default function OfficeAnnouncements() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number][0]>('all');
  const [rows, setRows] = useState<Broadcast[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<Broadcast[]>('/v1/school-mobile/admin/broadcasts')
      .then(setRows)
      .catch((err: Error) => setError(err.message));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Add a title and message');
      return;
    }
    setSending(true);
    try {
      await apiFetch('/v1/school-mobile/admin/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), audience }),
      });
      setTitle('');
      setBody('');
      load();
      Alert.alert('Sent', 'The announcement is in the school app inbox.');
    } catch (err) {
      Alert.alert('Could not send', err instanceof Error ? err.message : 'Try again');
    } finally {
      setSending(false);
    }
  };

  return (
    <OfficeShell
      title="Announcements"
      subtitle="Speak to the whole school in one tap"
      error={error}
    >
      <View style={styles.composer}>
        <Text style={styles.kicker}>New announcement</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={colors.muted}
          style={styles.input}
          maxLength={160}
        />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Message for students, parents or staff"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.area]}
          multiline
          maxLength={4000}
        />
        <View style={styles.chips}>
          {AUDIENCES.map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setAudience(id)}
              style={[styles.chip, audience === id && styles.chipOn]}
            >
              <Text style={[styles.chipText, audience === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable disabled={sending} onPress={() => void send()} style={styles.send}>
          <Text style={styles.sendText}>{sending ? 'Sending…' : 'Send announcement'}</Text>
        </Pressable>
      </View>
      <View style={styles.kpis}>
        <Kpi label="Sent" value={String(rows.length)} tint="#eff6ff" hint="From this office" />
      </View>
      {rows.map((row) => (
        <RowCard
          key={row.id}
          title={row.title}
          meta={`${row.audience} · ${new Date(row.createdAt).toLocaleString('en-IN')}`}
        />
      ))}
    </OfficeShell>
  );
}

const styles = StyleSheet.create({
  composer: { backgroundColor: '#fff', borderRadius: 20, padding: 14, gap: 10 },
  kicker: { fontWeight: '800', color: colors.navy, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 44,
    color: colors.ink,
    fontWeight: '600',
  },
  area: { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#f1f5f9',
  },
  chipOn: { backgroundColor: colors.navy },
  chipText: { fontWeight: '700', color: colors.muted, fontSize: 12 },
  chipTextOn: { color: '#fff' },
  send: {
    backgroundColor: colors.navy,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontWeight: '800' },
  kpis: { flexDirection: 'row', gap: 8 },
});
