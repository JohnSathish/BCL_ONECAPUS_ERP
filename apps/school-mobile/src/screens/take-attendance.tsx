import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { Card, EmptyState, Loader, NavyButton, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

const STATUS = [
  { code: 'PRESENT', letter: 'P', bg: '#dcfce7', fg: '#166534' },
  { code: 'ABSENT', letter: 'A', bg: '#fee2e2', fg: '#991b1b' },
  { code: 'LATE', letter: 'L', bg: '#ffedd5', fg: '#9a3412' },
  { code: 'HALF_DAY', letter: 'H', bg: '#e0e7ff', fg: '#3730a3' },
  { code: 'LEAVE', letter: 'LV', bg: '#fef9c3', fg: '#854d0e' },
] as const;

type ClassRow = { sectionId: string; label: string; status: string };
type StudentRow = {
  studentId: string;
  fullName: string;
  admissionNumber?: string | null;
  rollNumber?: string | null;
  status?: string | null;
  remark?: string | null;
};

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftIso(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function prettyDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function prettyStatus(value?: string | null) {
  if (!value || value === 'NOT_SUBMITTED') return 'Not submitted';
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function TakeAttendanceForm({ showBack = true }: { showBack?: boolean }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ sectionId?: string }>();
  const preset = Array.isArray(params.sectionId) ? params.sectionId[0] : params.sectionId;
  const [date, setDate] = useState(isoToday());
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sectionId, setSectionId] = useState(preset || '');
  const [academicYearId, setAcademicYearId] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [holidayBlocked, setHolidayBlocked] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const dateRef = useRef(date);
  const sectionRef = useRef(sectionId);
  dateRef.current = date;
  sectionRef.current = sectionId;

  const loadClasses = useCallback(
    async (day: string, keepSection?: string) => {
      const today = await apiFetch<{ classes?: ClassRow[] }>(
        `/v1/school-mobile/teacher/today?date=${encodeURIComponent(day)}`,
      );
      const rows = today.classes ?? [];
      const preferred = keepSection || preset || rows[0]?.sectionId || '';
      if (preferred && !rows.some((row) => row.sectionId === preferred)) {
        rows.unshift({
          sectionId: preferred,
          label: 'Assigned class',
          status: 'NOT_SUBMITTED',
        });
      }
      setClasses(rows);
      setSectionId(preferred);
      return preferred;
    },
    [preset],
  );

  const loadRoster = useCallback(async (day: string, section: string) => {
    if (!section) {
      setStudents([]);
      setMarks({});
      setAcademicYearId('');
      setSessionStatus(null);
      return;
    }
    const roster = await apiFetch<{
      academicYear?: { id: string };
      holidayBlocked?: boolean;
      canEdit?: boolean;
      session?: { status?: string } | null;
      students?: StudentRow[];
    }>(
      `/v1/school-mobile/attendance/roster?date=${encodeURIComponent(day)}&sectionId=${encodeURIComponent(section)}`,
    );
    const list = roster.students ?? [];
    setAcademicYearId(roster.academicYear?.id ?? '');
    setHolidayBlocked(Boolean(roster.holidayBlocked));
    setCanEdit(roster.canEdit !== false);
    setSessionStatus(roster.session?.status ?? null);
    setStudents(list);
    const next: Record<string, string> = {};
    const note: Record<string, string> = {};
    for (const row of list) {
      if (row.status && STATUS.some((item) => item.code === row.status)) {
        next[row.studentId] = row.status;
      }
      if (row.remark) note[row.studentId] = row.remark;
    }
    setMarks(next);
    setRemarks(note);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const section = await loadClasses(dateRef.current, sectionRef.current || preset);
          if (!cancelled) await loadRoster(dateRef.current, section);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Could not load attendance.');
            setStudents([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [loadClasses, loadRoster, preset]),
  );

  const changeDate = async (next: string) => {
    setDate(next);
    setOk(null);
    setLoading(true);
    setError(null);
    try {
      const section = await loadClasses(next, sectionId);
      await loadRoster(next, section);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load attendance.');
    } finally {
      setLoading(false);
    }
  };

  const changeSection = async (id: string) => {
    setSectionId(id);
    setOk(null);
    setLoading(true);
    setError(null);
    try {
      await loadRoster(date, id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this class.');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const markedCount = useMemo(
    () => students.filter((row) => marks[row.studentId]).length,
    [marks, students],
  );

  const save = async () => {
    if (!sectionId || !academicYearId) {
      setError('Select a class before saving.');
      return;
    }
    const records = students
      .filter((row) => marks[row.studentId])
      .map((row) => ({
        studentId: row.studentId,
        statusCode: marks[row.studentId],
        remark: remarks[row.studentId]?.trim() || undefined,
      }));
    if (!records.length) {
      setError('Mark at least one student before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch('/v1/school-mobile/attendance/submit', {
        method: 'POST',
        body: JSON.stringify({
          academicYearId,
          date,
          sectionId,
          records,
        }),
      });
      setOk('Attendance saved. It is now visible in the staff portal.');
      await loadRoster(date, sectionId);
      await loadClasses(date, sectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const editable = canEdit && !holidayBlocked;
  const selected = classes.find((row) => row.sectionId === sectionId);

  return (
    <Screen title="Take Attendance" onBack={showBack} light>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.dateBar}>
          <Pressable onPress={() => void changeDate(shiftIso(date, -1))} style={styles.dateBtn}>
            <Text style={styles.dateBtnText}>‹</Text>
          </Pressable>
          <View style={styles.dateMid}>
            <Text style={styles.dateLabel}>{prettyDate(date)}</Text>
            {date !== isoToday() ? (
              <Pressable onPress={() => void changeDate(isoToday())}>
                <Text style={styles.today}>Jump to today</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={() => void changeDate(shiftIso(date, 1))} style={styles.dateBtn}>
            <Text style={styles.dateBtnText}>›</Text>
          </Pressable>
        </View>

        {!classes.length && !loading ? (
          <EmptyState
            title="No assigned class"
            body="You can only mark attendance for classes assigned to you in the school ERP."
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {classes.map((row) => {
              const on = row.sectionId === sectionId;
              return (
                <Pressable
                  key={row.sectionId}
                  onPress={() => void changeSection(row.sectionId)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{row.label}</Text>
                  <Text style={[styles.chipMeta, on && styles.chipTextOn]}>
                    {prettyStatus(row.status)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {selected ? (
          <Text style={styles.summary}>
            {selected.label} · {prettyStatus(sessionStatus || selected.status)}
            {holidayBlocked ? ' · Holiday / off day' : ''}
          </Text>
        ) : null}

        {holidayBlocked ? (
          <Text style={styles.warn}>Attendance is not taken on holidays or weekly offs.</Text>
        ) : null}
        {!canEdit && !holidayBlocked ? (
          <Text style={styles.warn}>This register is locked. Ask the office to unlock it.</Text>
        ) : null}

        {loading ? <Loader /> : null}

        {!loading && sectionId && !students.length ? (
          <EmptyState
            title="No students in this class"
            body="The section roster will appear here once students are enrolled."
          />
        ) : null}

        {students.map((row) => {
          const mark = marks[row.studentId];
          return (
            <Card key={row.studentId}>
              <View style={styles.studentHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{row.fullName}</Text>
                  <Text style={styles.studentMeta}>
                    {[row.rollNumber ? `Roll ${row.rollNumber}` : null, row.admissionNumber]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </View>
              <View style={styles.statusRow}>
                {STATUS.map((item) => {
                  const on = mark === item.code;
                  return (
                    <Pressable
                      key={item.code}
                      disabled={!editable}
                      onPress={() => setMarks((prev) => ({ ...prev, [row.studentId]: item.code }))}
                      style={[
                        styles.status,
                        { backgroundColor: on ? item.bg : '#f8fafc' },
                        on && { borderColor: item.fg },
                        !editable && { opacity: 0.5 },
                      ]}
                    >
                      <Text style={[styles.statusLetter, { color: on ? item.fg : colors.muted }]}>
                        {item.letter}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {editable ? (
                <TextInput
                  placeholder="Remark (optional)"
                  value={remarks[row.studentId] ?? ''}
                  onChangeText={(value) =>
                    setRemarks((prev) => ({ ...prev, [row.studentId]: value }))
                  }
                  style={styles.remark}
                  placeholderTextColor={colors.muted}
                />
              ) : null}
            </Card>
          );
        })}

        {students.length ? (
          <View style={styles.actions}>
            <Text style={styles.count}>
              {markedCount} of {students.length} marked
            </Text>
            {editable ? (
              <Pressable
                onPress={() => {
                  const next: Record<string, string> = {};
                  for (const row of students) next[row.studentId] = 'PRESENT';
                  setMarks(next);
                }}
              >
                <Text style={styles.link}>Mark all present</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {ok ? <Text style={styles.ok}>{ok}</Text> : null}

        {editable && students.length ? (
          <NavyButton
            label={saving ? 'Saving…' : 'Save attendance'}
            onPress={() => void save()}
            disabled={saving}
          />
        ) : null}

        {showBack && !students.length && !loading ? (
          <NavyButton label="Back" onPress={() => router.back()} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.md, gap: 12, paddingBottom: 40 },
  dateBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnText: { fontSize: 28, color: colors.navy, marginTop: -2 },
  dateMid: { flex: 1, alignItems: 'center' },
  dateLabel: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  today: { color: colors.navy, fontWeight: '700', marginTop: 2, fontSize: 12 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#e4e8f2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 120,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontWeight: '800', color: colors.ink },
  chipTextOn: { color: '#fff' },
  chipMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  summary: { color: colors.muted, fontWeight: '600' },
  warn: { color: '#92400e', backgroundColor: '#fef3c7', padding: 10, borderRadius: 12 },
  studentHead: { flexDirection: 'row', alignItems: 'center' },
  studentName: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  studentMeta: { color: colors.muted, marginTop: 2, fontSize: 12 },
  statusRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  status: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4e8f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLetter: { fontWeight: '800', fontSize: 12 },
  remark: {
    marginTop: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    color: colors.ink,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { color: colors.muted, fontWeight: '700' },
  link: { color: colors.navy, fontWeight: '800' },
  error: { color: colors.danger, fontWeight: '700' },
  ok: { color: colors.green, fontWeight: '700' },
});
