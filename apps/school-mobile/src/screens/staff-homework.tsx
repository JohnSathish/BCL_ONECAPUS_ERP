import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { apiFetch } from '@/api/client';
import {
  assignHomework,
  formatHomeworkDay,
  homeworkStatusTone,
  isoPlusDays,
  isoToday,
  openHomeworkAttachment,
  stripHtml,
  type HomeworkItem,
  type HomeworkOptions,
} from '@/homework/api';
import { EmptyState, Loader, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

type PickFile = { uri: string; name: string; mimeType: string };

function toDisplayDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function shiftIso(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function FieldCard({
  icon,
  iconBg,
  label,
  required,
  children,
}: {
  icon: string;
  iconBg: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldCard}>
      <View style={styles.fieldHead}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Text style={styles.iconTxt}>{icon}</Text>
        </View>
        <Text style={styles.fieldLabel}>
          {label}
          {required ? <Text style={styles.req}> *</Text> : null}
        </Text>
      </View>
      {children}
    </View>
  );
}

function DateField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <View style={styles.dateRow}>
      <Pressable onPress={() => onChange(shiftIso(value, -1))} style={styles.dateBtn}>
        <Text style={styles.dateBtnTxt}>‹</Text>
      </Pressable>
      <Text style={styles.dateValue}>{toDisplayDate(value)}</Text>
      <Pressable onPress={() => onChange(shiftIso(value, 1))} style={styles.dateBtn}>
        <Text style={styles.dateBtnTxt}>›</Text>
      </Pressable>
      <Text style={styles.calMark}>📅</Text>
    </View>
  );
}

function Radio({
  on,
  label,
  onPress,
  right,
}: {
  on: boolean;
  label: string;
  onPress: () => void;
  right?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={styles.radioRow}>
      <View style={[styles.radioOuter, on && styles.radioOuterOn]}>
        {on ? <View style={styles.radioInner} /> : null}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
      {right}
    </Pressable>
  );
}

export function StaffHomeworkScreen() {
  const [items, setItems] = useState<HomeworkItem[] | null>(null);
  const [options, setOptions] = useState<HomeworkOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [picker, setPicker] = useState<'class' | 'section' | 'subject' | null>(null);

  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [assignDate, setAssignDate] = useState(isoToday());
  const [dueDate, setDueDate] = useState(isoPlusDays(7));
  const [visibleTo, setVisibleTo] = useState<'STUDENTS' | 'STUDENTS_PARENTS'>('STUDENTS');
  const [files, setFiles] = useState<PickFile[]>([]);
  const [enrolled, setEnrolled] = useState(0);

  const grades = options?.classes ?? [];
  const selectedGrade = grades.find((g) => g.gradeId === gradeId) ?? grades[0];
  const sectionRows = selectedGrade?.sections ?? [];
  const selectedSection = sectionRows.find((s) => s.id === sectionId);

  const subjects = useMemo(() => {
    const all = options?.subjects ?? [];
    const gid = selectedGrade?.gradeId;
    if (!gid) return all;
    const forGrade = all.filter((s) => !s.gradeId || s.gradeId === gid);
    return forGrade.length ? forGrade : all;
  }, [options, selectedGrade]);

  const classLabel = selectedGrade
    ? `${selectedGrade.name}${selectedSection ? ` ${selectedSection.name}` : ''}`.trim()
    : 'your class';

  const resetForm = () => {
    setTitle('');
    setBody('');
    setAssignDate(isoToday());
    setDueDate(isoPlusDays(7));
    setVisibleTo('STUDENTS');
    setFiles([]);
    setSubjectId('');
    setOk(null);
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, opts] = await Promise.all([
        apiFetch<{ items?: HomeworkItem[] }>('/v1/school-mobile/homework'),
        apiFetch<HomeworkOptions>('/v1/school-mobile/homework/options'),
      ]);
      setItems(Array.isArray(list.items) ? list.items : []);
      setOptions(opts);
      const first = opts.classes?.[0];
      if (first) {
        setGradeId((cur) => cur || first.gradeId);
        setSectionId((cur) => cur || first.sections?.[0]?.id || '');
      }
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Could not load homework.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!sectionId) {
      setEnrolled(0);
      return;
    }
    let alive = true;
    void apiFetch<{ students?: unknown[] }>(
      `/v1/school-mobile/attendance/roster?sectionId=${encodeURIComponent(sectionId)}&date=${encodeURIComponent(isoToday())}`,
    )
      .then((data) => {
        if (alive) setEnrolled(Array.isArray(data.students) ? data.students.length : 0);
      })
      .catch(() => {
        if (alive) setEnrolled(0);
      });
    return () => {
      alive = false;
    };
  }, [sectionId]);

  const wrapBody = (before: string, after = before) => {
    setBody(
      (cur) =>
        `${cur}${cur && !cur.endsWith('\n') && !cur.endsWith(' ') ? ' ' : ''}${before}text${after}`,
    );
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const next = (result.assets ?? []).map((asset) => ({
        uri: asset.uri,
        name: asset.name || 'attachment',
        mimeType: asset.mimeType || 'application/octet-stream',
      }));
      setFiles((prev) => [...prev, ...next].slice(0, 8));
    } catch {
      Alert.alert('Attachments', 'Could not open the file picker.');
    }
  };

  const submit = async (asDraft: boolean) => {
    if (!sectionId) {
      setError('Select class and section.');
      return;
    }
    if (!subjectId) {
      setError('Select a subject.');
      return;
    }
    if (!title.trim()) {
      setError('Enter a homework title.');
      return;
    }
    if (!body.trim()) {
      setError('Enter description / instructions.');
      return;
    }
    if (dueDate < assignDate) {
      setError('Due date cannot be before the assign date.');
      return;
    }
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      await assignHomework({
        sectionId,
        subjectId,
        title,
        body,
        assignDate,
        dueDate,
        visibleTo,
        asDraft,
        files,
      });
      setOk(asDraft ? 'Draft saved.' : 'Homework assigned.');
      resetForm();
      setComposeOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign homework.');
    } finally {
      setSaving(false);
    }
  };

  if (items == null) {
    return (
      <Screen title="Homework" onBack>
        <Loader />
      </Screen>
    );
  }

  if (composeOpen) {
    return (
      <Screen light insetBottom>
        <View style={styles.createBar}>
          <Pressable
            onPress={() => {
              setComposeOpen(false);
              setError(null);
            }}
            hitSlop={12}
            style={styles.backHit}
          >
            <Text style={styles.backChev}>‹</Text>
          </Pressable>
          <View style={styles.createBarMid}>
            <Text style={styles.createTitle}>Create Homework</Text>
          </View>
          <Pressable
            onPress={() =>
              Alert.alert(
                'Create Homework',
                'Fill class, subject, title and instructions, then tap Assign Homework. Students will see it in their app.',
              )
            }
            hitSlop={8}
            style={styles.helpBtn}
          >
            <Text style={styles.helpTxt}>?</Text>
          </Pressable>
        </View>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Text style={styles.subtitle}>
            Assign homework to your students. It will be visible in their mobile app.
          </Text>
          {error ? <Text style={[styles.error, styles.padH]}>{error}</Text> : null}
          {ok ? <Text style={[styles.ok, styles.padH]}>{ok}</Text> : null}

          <ScrollView
            contentContainerStyle={styles.createPad}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <FieldCard icon="🎓" iconBg="#dbeafe" label="Class" required>
                  <Pressable style={styles.select} onPress={() => setPicker('class')}>
                    <Text style={styles.selectTxt} numberOfLines={1}>
                      {selectedGrade?.name || 'Select Class'}
                    </Text>
                    <Text style={styles.chev}>▾</Text>
                  </Pressable>
                </FieldCard>
              </View>
              <View style={styles.col}>
                <FieldCard icon="▦" iconBg="#ede9fe" label="Section" required>
                  <Pressable style={styles.select} onPress={() => setPicker('section')}>
                    <Text style={styles.selectTxt} numberOfLines={1}>
                      {selectedSection?.name || 'Select Section'}
                    </Text>
                    <Text style={styles.chev}>▾</Text>
                  </Pressable>
                </FieldCard>
              </View>
            </View>

            <View style={styles.twoCol}>
              <View style={styles.col}>
                <FieldCard icon="📖" iconBg="#fee2e2" label="Subject" required>
                  <Pressable style={styles.select} onPress={() => setPicker('subject')}>
                    <Text style={styles.selectTxt} numberOfLines={1}>
                      {subjects.find((s) => s.id === subjectId)?.name || 'Select Subject'}
                    </Text>
                    <Text style={styles.chev}>▾</Text>
                  </Pressable>
                </FieldCard>
              </View>
              <View style={styles.col}>
                <FieldCard icon="📄" iconBg="#dcfce7" label="Homework Title" required>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Test"
                    placeholderTextColor="#94a3b8"
                    style={styles.textField}
                  />
                </FieldCard>
              </View>
            </View>

            <FieldCard icon="📝" iconBg="#ffedd5" label="Description / Instructions" required>
              <View style={styles.toolbar}>
                {[
                  { label: 'B', run: () => wrapBody('**', '**') },
                  { label: 'I', run: () => wrapBody('_', '_') },
                  { label: 'U', run: () => wrapBody('__', '__') },
                  { label: '•', run: () => setBody((c) => `${c}${c ? '\n' : ''}• `) },
                  { label: '1.', run: () => setBody((c) => `${c}${c ? '\n' : ''}1. `) },
                ].map((btn) => (
                  <Pressable key={btn.label} onPress={btn.run} style={styles.toolBtn}>
                    <Text style={styles.toolTxt}>{btn.label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={body}
                onChangeText={(t) => setBody(t.slice(0, 1000))}
                placeholder="Complete the attached worksheet…"
                placeholderTextColor="#94a3b8"
                style={styles.area}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.counter}>{body.length}/1000</Text>
            </FieldCard>

            <View style={styles.twoCol}>
              <View style={styles.col}>
                <FieldCard icon="📅" iconBg="#dbeafe" label="Assign Date" required>
                  <DateField value={assignDate} onChange={setAssignDate} />
                </FieldCard>
              </View>
              <View style={styles.col}>
                <FieldCard icon="📅" iconBg="#fee2e2" label="Due Date" required>
                  <DateField value={dueDate} onChange={setDueDate} />
                </FieldCard>
              </View>
            </View>

            <FieldCard icon="📎" iconBg="#ede9fe" label="Attachments (Optional)">
              <View style={styles.attachRow}>
                <Pressable onPress={() => void pickFiles()} style={styles.chooseBtn}>
                  <Text style={styles.chooseTxt}>📎 Choose files</Text>
                </Pressable>
                <Text style={styles.chooseHint}>
                  {files.length ? `${files.length} file(s) chosen` : 'No file chosen'}
                </Text>
              </View>
              <Text style={styles.hint}>
                You can upload PDF, DOC, DOCX, JPG or PNG (Max 5 MB each)
              </Text>
              {files.map((file) => (
                <View key={`${file.uri}-${file.name}`} style={styles.fileRow}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Pressable
                    onPress={() => setFiles((prev) => prev.filter((f) => f.uri !== file.uri))}
                  >
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </FieldCard>

            <FieldCard icon="👥" iconBg="#dcfce7" label="Assign To" required>
              <Radio
                on
                label={`All students in the class (${classLabel})`}
                onPress={() => undefined}
              />
              <Radio
                on={false}
                label="Select specific students"
                onPress={() =>
                  Alert.alert(
                    'Assign to class',
                    'Homework is sent to every student in the selected class section.',
                  )
                }
                right={
                  <Pressable
                    style={styles.selectStudentsBtn}
                    onPress={() =>
                      Alert.alert(
                        'Assign to class',
                        'Homework is sent to every student in the selected class section.',
                      )
                    }
                  >
                    <Text style={styles.selectStudentsTxt}>Select Students</Text>
                  </Pressable>
                }
              />
              <View style={styles.infoBanner}>
                <Text style={styles.infoIcon}>ℹ</Text>
                <Text style={styles.infoTxt}>
                  This homework will be sent to {enrolled || '—'} students in {classLabel}
                </Text>
              </View>
            </FieldCard>

            <FieldCard icon="👁" iconBg="#ede9fe" label="Visible To" required>
              <Radio
                on={visibleTo === 'STUDENTS'}
                label="Students only"
                onPress={() => setVisibleTo('STUDENTS')}
              />
              <Radio
                on={visibleTo === 'STUDENTS_PARENTS'}
                label="Students & Parents"
                onPress={() => setVisibleTo('STUDENTS_PARENTS')}
              />
            </FieldCard>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable disabled={saving} onPress={() => void submit(true)} style={styles.draftBtn}>
              <Text style={styles.draftTxt}>{saving ? 'Saving…' : 'Save as Draft'}</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={() => void submit(false)}
              style={styles.assignBtn}
            >
              <Text style={styles.assignTxt}>{saving ? 'Sending…' : 'Assign Homework  ✈'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        {picker ? (
          <Pressable style={styles.sheetBg} onPress={() => setPicker(null)}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>
                {picker === 'class'
                  ? 'Select Class'
                  : picker === 'section'
                    ? 'Select Section'
                    : 'Select Subject'}
              </Text>
              <ScrollView style={{ maxHeight: 320 }}>
                {picker === 'class'
                  ? grades.map((g) => (
                      <Pressable
                        key={g.gradeId}
                        style={styles.sheetRow}
                        onPress={() => {
                          setGradeId(g.gradeId);
                          setSectionId(g.sections?.[0]?.id || '');
                          setSubjectId('');
                          setPicker(null);
                        }}
                      >
                        <Text style={styles.sheetRowTxt}>{g.name}</Text>
                      </Pressable>
                    ))
                  : null}
                {picker === 'section'
                  ? sectionRows.map((s) => (
                      <Pressable
                        key={s.id}
                        style={styles.sheetRow}
                        onPress={() => {
                          setSectionId(s.id);
                          setPicker(null);
                        }}
                      >
                        <Text style={styles.sheetRowTxt}>{s.name}</Text>
                      </Pressable>
                    ))
                  : null}
                {picker === 'subject'
                  ? subjects.map((s) => (
                      <Pressable
                        key={s.id}
                        style={styles.sheetRow}
                        onPress={() => {
                          setSubjectId(s.id);
                          setPicker(null);
                        }}
                      >
                        <Text style={styles.sheetRowTxt}>{s.name}</Text>
                      </Pressable>
                    ))
                  : null}
              </ScrollView>
            </View>
          </Pressable>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      title="Homework"
      onBack
      action={
        <Pressable onPress={() => setComposeOpen(true)} hitSlop={8}>
          <Text style={styles.action}>+ Create</Text>
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={styles.listPad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
            tintColor={colors.navy}
          />
        }
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {ok ? <Text style={styles.ok}>{ok}</Text> : null}

        <Pressable style={styles.cta} onPress={() => setComposeOpen(true)}>
          <Text style={styles.ctaTitle}>Create Homework</Text>
          <Text style={styles.ctaBody}>
            Assign homework to your class with instructions and attachments.
          </Text>
        </Pressable>

        <Text style={styles.listHeading}>Your assignments</Text>
        {!items.length ? (
          <EmptyState
            title="No homework yet"
            body="Tap Create Homework to assign work to your teaching class."
          />
        ) : (
          items.map((row) => {
            const tone = homeworkStatusTone(row.listStatus);
            return (
              <View key={row.id} style={styles.listCard}>
                <View style={styles.listTop}>
                  <View style={styles.bookIcon}>
                    <Text>📖</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listSubject}>{row.subjectName}</Text>
                    <Text style={styles.listClass}>{row.classLabel}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.badgeDot, { color: tone.ink }]}>●</Text>
                    <Text style={[styles.badgeText, { color: tone.ink }]}>{tone.label}</Text>
                  </View>
                </View>
                <Text style={styles.listTitle}>{row.title}</Text>
                {row.body ? (
                  <Text style={styles.listBody} numberOfLines={2}>
                    {stripHtml(row.body)}
                  </Text>
                ) : null}
                <Text style={styles.subs}>
                  Due {formatHomeworkDay(row.dueDate)} · Submissions {row.submitted ?? 0}/
                  {row.enrolled ?? 0}
                </Text>
                {row.files?.length ? (
                  <View style={styles.files}>
                    {row.files.map((file) => (
                      <Pressable
                        key={file.id}
                        style={styles.fileChip}
                        onPress={() => {
                          void openHomeworkAttachment(row.id, file).catch((err) =>
                            Alert.alert(
                              'Attachment',
                              err instanceof Error ? err.message : 'Could not open file.',
                            ),
                          );
                        }}
                      >
                        <Text style={styles.fileChipTxt} numberOfLines={1}>
                          📎 {file.fileName}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  createBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingBottom: 4,
  },
  backHit: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backChev: { fontSize: 28, color: colors.navy, marginTop: -4 },
  createBarMid: { flex: 1, alignItems: 'center' },
  createTitle: { fontSize: 18, fontWeight: '800', color: colors.navy },
  padH: { paddingHorizontal: space.md },
  subtitle: {
    paddingHorizontal: space.md,
    paddingBottom: 8,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  createPad: { padding: space.md, gap: 12, paddingBottom: 24 },
  listPad: { padding: space.md, gap: 12, paddingBottom: space.xl },
  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  fieldCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e8eef8',
    gap: 8,
  },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTxt: { fontSize: 14 },
  fieldLabel: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  req: { color: '#e11d48' },
  select: {
    borderWidth: 1,
    borderColor: '#dbe3f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  selectTxt: { flex: 1, color: colors.ink, fontWeight: '600' },
  chev: { color: colors.muted, fontWeight: '800' },
  textField: {
    borderWidth: 1,
    borderColor: '#dbe3f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: colors.ink,
    backgroundColor: '#f8fafc',
    fontWeight: '600',
  },
  toolbar: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  toolBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTxt: { color: colors.navy, fontWeight: '800' },
  area: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#dbe3f0',
    borderRadius: 10,
    padding: 10,
    color: colors.ink,
    backgroundColor: '#f8fafc',
    lineHeight: 20,
  },
  counter: { alignSelf: 'flex-end', color: colors.muted, fontSize: 11, fontWeight: '600' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dbe3f0',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 2,
  },
  dateBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  dateBtnTxt: { fontSize: 18, color: colors.navy, fontWeight: '800' },
  dateValue: { flex: 1, textAlign: 'center', fontWeight: '700', color: colors.ink, fontSize: 13 },
  calMark: { fontSize: 12, marginRight: 4 },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  chooseBtn: {
    backgroundColor: '#e0e7ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chooseTxt: { color: colors.navy, fontWeight: '800' },
  chooseHint: { color: colors.muted, fontWeight: '600', flex: 1 },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileName: { flex: 1, color: colors.ink, fontWeight: '600' },
  remove: { color: colors.danger, fontWeight: '700' },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterOn: { borderColor: colors.navy },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.navy },
  radioLabel: { flex: 1, color: colors.ink, fontWeight: '600', fontSize: 13 },
  selectStudentsBtn: {
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectStudentsTxt: { color: colors.navy, fontWeight: '700', fontSize: 12 },
  infoBanner: {
    marginTop: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  infoIcon: { color: colors.navy, fontWeight: '800' },
  infoTxt: { flex: 1, color: colors.navy, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: '#e8eef8',
    backgroundColor: '#fff',
  },
  draftBtn: {
    flex: 1,
    backgroundColor: '#e0e7ff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  draftTxt: { color: colors.navy, fontWeight: '800' },
  assignBtn: {
    flex: 1.3,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  assignTxt: { color: '#fff', fontWeight: '800' },
  helpBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTxt: { color: colors.navy, fontWeight: '800' },
  action: { color: colors.navy, fontWeight: '800' },
  error: { color: colors.danger, marginBottom: 4 },
  ok: { color: colors.green, fontWeight: '700', marginBottom: 4 },
  cta: {
    backgroundColor: colors.navy,
    borderRadius: 18,
    padding: space.md,
    gap: 4,
  },
  ctaTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  ctaBody: { color: '#c7d2fe', lineHeight: 18 },
  listHeading: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8eef8',
    gap: 8,
  },
  listTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bookIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listSubject: { color: colors.navy, fontWeight: '800' },
  listClass: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeDot: { fontSize: 8 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  listTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  listBody: { color: colors.muted, lineHeight: 19 },
  subs: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  files: { gap: 6 },
  fileChip: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fileChipTxt: { color: colors.navy, fontWeight: '700', fontSize: 13 },
  sheetBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 28,
  },
  sheetTitle: { fontWeight: '800', fontSize: 16, color: colors.navy, marginBottom: 8 },
  sheetRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sheetRowTxt: { color: colors.ink, fontWeight: '600', fontSize: 15 },
});
