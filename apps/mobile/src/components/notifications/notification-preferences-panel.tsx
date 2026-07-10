import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  fetchNotificationPreferences,
  upsertNotificationPreference,
} from '@/services/notifications';
import { STAFF_PUSH_CATEGORIES, STUDENT_PUSH_CATEGORIES } from '@/types/notifications';

type ThemeColors = {
  primary: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
};

export function NotificationPreferencesPanel({
  role,
  theme,
}: {
  role: 'student' | 'staff';
  theme: ThemeColors;
}) {
  const categories = role === 'staff' ? STAFF_PUSH_CATEGORIES : STUDENT_PUSH_CATEGORIES;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');

  const defaults = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of categories) map[c.key] = true;
    return map;
  }, [categories]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prefs = await fetchNotificationPreferences();
      const push = prefs.find((p) => p.channel === 'PUSH');
      setEnabled(push?.enabled ?? true);
      const next = { ...defaults };
      const raw = (push?.settings ?? {}) as Record<string, unknown>;
      for (const key of Object.keys(next)) {
        if (key in raw) next[key] = raw[key] !== false;
      }
      setSettings(next);
      setMessage('');
    } catch (e) {
      setSettings(defaults);
      setMessage(e instanceof Error ? e.message : 'Could not load preferences');
    } finally {
      setLoading(false);
    }
  }, [defaults]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(nextEnabled: boolean, nextSettings: Record<string, boolean>) {
    setSaving(true);
    setMessage('');
    try {
      await upsertNotificationPreference({
        channel: 'PUSH',
        enabled: nextEnabled,
        settings: nextSettings,
      });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {message ? <Text style={styles.error}>{message}</Text> : null}

      <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Push notifications</Text>
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Master switch for OS push alerts
            </Text>
          </View>
          <Switch
            value={enabled}
            disabled={saving}
            onValueChange={(value) => {
              setEnabled(value);
              void persist(value, settings);
            }}
          />
        </View>
      </View>

      <Text style={[styles.section, { color: theme.text }]}>Categories</Text>
      <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        {categories.map((cat, index) => (
          <View
            key={cat.key}
            style={[
              styles.row,
              index < categories.length - 1 && styles.rowBorder,
              { borderBottomColor: theme.border },
            ]}
          >
            <Text style={[styles.label, { color: theme.text }]}>{cat.label}</Text>
            <Switch
              value={enabled ? (settings[cat.key] ?? true) : false}
              disabled={saving || !enabled}
              onValueChange={(value) => {
                const next = { ...settings, [cat.key]: value };
                setSettings(next);
                void persist(enabled, next);
              }}
            />
          </View>
        ))}
      </View>

      <Pressable onPress={() => void load()} style={styles.reload}>
        <Text style={{ color: theme.primary, fontWeight: '700' }}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowBorder: { borderBottomWidth: 1 },
  title: { fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 12, marginTop: 2 },
  label: { flex: 1, fontSize: 14, fontWeight: '600' },
  section: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  error: { color: '#DC2626', fontSize: 13 },
  reload: { alignItems: 'center', paddingVertical: 8 },
});
