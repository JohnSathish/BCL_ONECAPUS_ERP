import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { facultyTheme } from '@/components/faculty-portal/theme';
import { fetchIaMarkRoster, saveIaMarks, type IaMarkRosterStudent } from '@/services/faculty-marks';

type MarkDraft = Record<string, Record<string, string>>;

function buildDraft(students: IaMarkRosterStudent[]): MarkDraft {
  const draft: MarkDraft = {};
  for (const student of students) {
    draft[student.id] = {};
    for (const mark of student.marks) {
      draft[student.id][mark.componentId] = mark.isAbsent
        ? 'AB'
        : mark.marks != null
          ? String(mark.marks)
          : '';
    }
  }
  return draft;
}

export default function FacultyMarksEntryScreen() {
  const insets = useSafeAreaInsets();
  const { paperId, title, paperCode } = useLocalSearchParams<{
    paperId: string;
    title?: string;
    paperCode?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schemeId, setSchemeId] = useState('');
  const [schemeName, setSchemeName] = useState('');
  const [components, setComponents] = useState<
    { id: string; code: string; label: string; maxMarks: number }[]
  >([]);
  const [students, setStudents] = useState<IaMarkRosterStudent[]>([]);
  const [activeComponentId, setActiveComponentId] = useState('');
  const [draft, setDraft] = useState<MarkDraft>({});

  const activeComponent = useMemo(
    () => components.find((c) => c.id === activeComponentId) ?? components[0],
    [activeComponentId, components],
  );

  const load = useCallback(async () => {
    if (!paperId) return;
    setLoading(true);
    try {
      const roster = await fetchIaMarkRoster(paperId);
      setSchemeId(roster.scheme.id);
      setSchemeName(roster.scheme.name);
      setComponents(roster.scheme.components);
      setStudents(roster.students);
      setActiveComponentId(roster.scheme.components[0]?.id ?? '');
      setDraft(buildDraft(roster.students));
    } catch (e) {
      Alert.alert('Could not load marks', e instanceof Error ? e.message : 'Try again');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateMark(studentId: string, componentId: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [componentId]: value,
      },
    }));
  }

  async function onSave() {
    if (!paperId || !schemeId || !activeComponent) return;
    setSaving(true);
    try {
      const rows = students.map((student) => {
        const raw = draft[student.id]?.[activeComponent.id]?.trim() ?? '';
        const isAbsent = raw.toUpperCase() === 'AB';
        const marks = isAbsent || raw === '' ? undefined : Number(raw);
        return {
          studentId: student.id,
          componentId: activeComponent.id,
          marks,
          isAbsent,
        };
      });

      const result = await saveIaMarks(paperId, { schemeId, rows });
      Alert.alert('Saved', `${result.saved} mark entries updated for ${activeComponent.code}.`);
      await load();
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  }

  const screenTitle = title ?? paperCode ?? 'Mark Entry';

  return (
    <FacultyScreenShell title={screenTitle} subtitle={schemeName || 'Internal assessment'}>
      {loading ? (
        <ActivityIndicator color={facultyTheme.primaryLight} style={{ marginTop: 32 }} />
      ) : students.length === 0 ? (
        <Text style={styles.empty}>No students found for this paper.</Text>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            {components.map((component) => (
              <Pressable
                key={component.id}
                style={[styles.tab, activeComponent?.id === component.id && styles.tabActive]}
                onPress={() => setActiveComponentId(component.id)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeComponent?.id === component.id && styles.tabTextActive,
                  ]}
                >
                  {component.code} (/{component.maxMarks})
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.list}>
            {students.map((student) => {
              const componentId = activeComponent?.id ?? '';
              const value = draft[student.id]?.[componentId] ?? '';
              return (
                <View key={student.id} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.roll}>{student.rollNumber ?? '—'}</Text>
                    <Text style={styles.name} numberOfLines={1}>
                      {student.fullName ?? 'Student'}
                    </Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={(text) => updateMark(student.id, componentId, text)}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor={facultyTheme.textSubtle}
                    maxLength={6}
                  />
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Text style={styles.footerHint}>
              Use AB for absent · Max {activeComponent?.maxMarks ?? '—'}
            </Text>
            <Pressable
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              disabled={saving}
              onPress={() => void onSave()}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Saving…' : `Save ${activeComponent?.code ?? 'Marks'}`}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, color: facultyTheme.textMuted, padding: 16 },
  tabs: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: facultyTheme.surface,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  tabActive: { backgroundColor: '#EFF6FF', borderColor: facultyTheme.primaryLight },
  tabText: { fontSize: 12, fontWeight: '700', color: facultyTheme.textMuted },
  tabTextActive: { color: facultyTheme.primaryLight },
  list: { paddingHorizontal: 16, paddingBottom: 120, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: facultyTheme.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  rowInfo: { flex: 1, gap: 2 },
  roll: { fontSize: 11, fontWeight: '700', color: facultyTheme.primaryLight },
  name: { fontSize: 14, fontWeight: '600', color: facultyTheme.text },
  input: {
    width: 72,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: facultyTheme.text,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    borderRadius: 8,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: facultyTheme.surface,
    borderTopWidth: 1,
    borderTopColor: facultyTheme.border,
    gap: 8,
  },
  footerHint: { fontSize: 11, color: facultyTheme.textMuted, textAlign: 'center' },
  saveBtn: {
    backgroundColor: facultyTheme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
