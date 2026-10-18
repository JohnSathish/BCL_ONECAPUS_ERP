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
import { COLLEGE_NAME } from '@/constants/release';
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
    for (const category of categories) map[category.key] = true;
    return map;
  }, [categories]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prefs = await fetchNotificationPreferences();
      const push = prefs.find((pref) => pref.channel === 'PUSH');
      setEnabled(push?.enabled ?? true);
      const next = { ...defaults };
      const raw = (push?.settings ?? {}) as Record<string, unknown>;
      for (const key of Object.keys(next)) {
        if (key in raw) next[key] = raw[key] !== false;
      }
      setSettings(next);
      setMessage('');
    } catch (error) {
      setSettings(defaults);
      setMessage(error instanceof Error ? error.message : 'Could not load preferences');
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  const allOn = enabled && categories.every((category) => settings[category.key] !== false);

  function toggleAll() {
    const turnOn = !allOn;
    const next = Object.fromEntries(categories.map((category) => [category.key, turnOn]));
    setSettings(next);
    setEnabled(turnOn ? true : enabled);
    void persist(turnOn ? true : enabled, next);
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

      <View style={styles.masterCard}>
        <View style={styles.masterRow}>
          <View style={styles.bellBubble}>
            <Text style={styles.bell}>🔔</Text>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.text }]}>Push Notifications</Text>
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Master switch for all app notifications
            </Text>
          </View>
          <Switch
            value={enabled}
            disabled={saving}
            trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
            thumbColor="#FFFFFF"
            onValueChange={(value) => {
              setEnabled(value);
              void persist(value, settings);
            }}
          />
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            You will receive important updates and alerts from {COLLEGE_NAME}.
          </Text>
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={[styles.section, { color: theme.text }]}>Notification Categories</Text>
        <Pressable onPress={toggleAll} disabled={saving} hitSlop={8}>
          <Text style={[styles.enableAll, { color: theme.primary }]}>
            {allOn ? 'Disable all' : 'Enable all'}
          </Text>
        </Pressable>
      </View>

      {categories.map((category) => (
        <View key={category.key} style={styles.categoryCard}>
          <View style={[styles.iconBubble, { backgroundColor: category.tint }]}>
            <Text style={styles.icon}>{category.icon}</Text>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.categoryTitle, { color: theme.text }]}>{category.label}</Text>
            <Text style={[styles.hint, { color: theme.textMuted }]}>{category.description}</Text>
          </View>
          <Switch
            value={enabled ? (settings[category.key] ?? true) : false}
            disabled={saving || !enabled}
            trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
            thumbColor="#FFFFFF"
            onValueChange={(value) => {
              const next = { ...settings, [category.key]: value };
              setSettings(next);
              void persist(enabled, next);
            }}
          />
        </View>
      ))}

      <Pressable
        style={[styles.refresh, { backgroundColor: theme.primary }]}
        onPress={() => void load()}
        disabled={saving}
      >
        <Text style={styles.refreshText}>{saving ? 'Saving…' : '↻  Refresh'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, gap: 10, paddingBottom: 32 },
  masterCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  masterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bell: { fontSize: 18 },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '800' },
  hint: { fontSize: 12, lineHeight: 16 },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 10,
    alignItems: 'flex-start',
  },
  infoIcon: { fontSize: 14, marginTop: 1 },
  infoText: { flex: 1, fontSize: 12, color: '#1E3A8A', lineHeight: 17, fontWeight: '600' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  section: { fontSize: 16, fontWeight: '800' },
  enableAll: { fontSize: 13, fontWeight: '800' },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },
  categoryTitle: { fontSize: 14, fontWeight: '800' },
  error: { color: '#DC2626', fontSize: 13 },
  refresh: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  refreshText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
