import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchSchoolHome } from '@/api/school-mobile';
import {
  SchoolCard,
  SchoolEmpty,
  SchoolShell,
  SchoolSkeleton,
} from '@/components/school-sis/school-shell';
import { hideStaffAdminModules } from '@/features/school/permissions';
import { t } from '@/i18n';
import { useSchoolSession } from '@/store/school-session';
import { schoolUi } from '@/theme/school-ui';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

export default function SchoolHomeScreen() {
  const router = useRouter();
  const childId = useSchoolSession((s) => s.childId);
  const setFromHome = useSchoolSession((s) => s.setFromHome);
  const setChildId = useSchoolSession((s) => s.setChildId);
  const setLastSynced = useSchoolSession((s) => s.setLastSynced);
  const setOffline = useSchoolSession((s) => s.setOffline);
  const persona = useSchoolSession((s) => s.persona);

  const homeQuery = useQuery({
    queryKey: ['school-home', childId],
    queryFn: async () => {
      try {
        const data = await fetchSchoolHome(childId);
        setFromHome(data);
        setLastSynced(new Date().toISOString());
        setOffline(false);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (/network|timeout|failed to fetch/i.test(message)) setOffline(true);
        throw err;
      }
    },
  });

  const home = homeQuery.data ?? {};
  const me = asRecord(home.me);
  const student = asRecord(me.student);
  const attendance = asRecord(home.attendance);
  const fees = asRecord(home.fees);
  const greeting = String(home.greeting ?? t('greetingMorning'));
  const name = String(me.displayName ?? 'there');
  const classLabel = String(student.classLabel ?? me.classLabel ?? '');
  const percent = attendance.percent != null ? Number(attendance.percent) : null;
  const pending = Number(fees.pending ?? fees.outstanding ?? fees.due ?? 0);
  const children = Array.isArray(me.children) ? (me.children as Record<string, unknown>[]) : [];
  const notices = Array.isArray(home.notices) ? (home.notices as Record<string, unknown>[]) : [];
  const quick = Array.isArray(home.quickLinks)
    ? (home.quickLinks as { key: string; label: string; href: string }[])
    : [];
  const exams = Array.isArray(home.exams) ? (home.exams as Record<string, unknown>[]) : [];
  const timetable = asRecord(home.timetable);
  const slots = Array.isArray(timetable.slots)
    ? (timetable.slots as Record<string, unknown>[])
    : Array.isArray(timetable.days)
      ? []
      : [];

  return (
    <SchoolShell
      title={`${greeting}, ${name.split(' ')[0]} 👋`}
      loading={homeQuery.isLoading && !homeQuery.data}
      onRefresh={() => void homeQuery.refetch()}
    >
      {homeQuery.isError && !homeQuery.data ? (
        <SchoolEmpty title="Unable to load dashboard" body="Check your connection and try again." />
      ) : null}

      {classLabel ? (
        <Text style={styles.meta}>
          {classLabel}
          {student.admissionNumber ? ` · ${String(student.admissionNumber)}` : ''}
        </Text>
      ) : (
        <Text style={styles.meta}>{String(persona ?? 'School')}</Text>
      )}

      {persona === 'parent' && children.length > 1 ? (
        <SchoolCard>
          <Text style={styles.cardTitle}>My children</Text>
          <View style={styles.rowWrap}>
            {children.map((child) => {
              const id = String(child.studentId ?? '');
              const active = id === childId;
              return (
                <Pressable
                  key={id}
                  onPress={() => setChildId(id)}
                  style={[styles.chip, active && styles.chipOn]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextOn]}>
                    {String(child.fullName ?? 'Child')}
                  </Text>
                  <Text style={styles.chipSub}>{String(child.classLabel ?? '')}</Text>
                </Pressable>
              );
            })}
          </View>
        </SchoolCard>
      ) : null}

      {homeQuery.isLoading ? <SchoolSkeleton /> : null}

      {(persona === 'student' || persona === 'parent') && (
        <SchoolCard onPress={() => router.push('/(school)/attendance' as never)}>
          <Text style={styles.cardTitle}>{t('attendance')}</Text>
          <Text style={styles.hero}>{percent != null ? `${Math.round(percent)}%` : '—'}</Text>
          <Text style={styles.muted}>
            Present {String(attendance.present ?? 0)} · Absent {String(attendance.absent ?? 0)}
          </Text>
        </SchoolCard>
      )}

      {(persona === 'student' || persona === 'parent') && (
        <SchoolCard onPress={() => router.push('/(school)/(tabs)/fees' as never)}>
          <Text style={styles.cardTitle}>{t('fees')}</Text>
          <Text style={[styles.hero, pending > 0 && { color: schoolUi.colors.danger }]}>
            {pending > 0 ? `₹${pending.toLocaleString('en-IN')} pending` : 'No dues'}
          </Text>
        </SchoolCard>
      )}

      {slots.length > 0 ? (
        <SchoolCard onPress={() => router.push('/(school)/timetable' as never)}>
          <Text style={styles.cardTitle}>Today’s timetable</Text>
          {slots.slice(0, 4).map((slot, i) => (
            <Text key={i} style={styles.line}>
              {String(slot.start ?? slot.time ?? '')} {String(slot.subject ?? slot.name ?? '')}
            </Text>
          ))}
        </SchoolCard>
      ) : null}

      {exams.length > 0 ? (
        <SchoolCard onPress={() => router.push('/(school)/exams' as never)}>
          <Text style={styles.cardTitle}>Upcoming / results</Text>
          <Text style={styles.line}>
            {String(exams[0]?.name ?? exams[0]?.title ?? 'Examination')}
          </Text>
        </SchoolCard>
      ) : null}

      <SchoolCard>
        <Text style={styles.cardTitle}>Quick actions</Text>
        <View style={styles.rowWrap}>
          {quick
            .filter((item) => {
              if (
                hideStaffAdminModules(persona) &&
                ['payroll', 'hr', 'broadcast', 'students'].includes(item.key)
              ) {
                return false;
              }
              return true;
            })
            .map((item) => (
              <Pressable
                key={item.key}
                style={styles.action}
                onPress={() => {
                  const map: Record<string, string> = {
                    attendance: '/(school)/attendance',
                    timetable: '/(school)/timetable',
                    fees: '/(school)/(tabs)/fees',
                    exams: '/(school)/exams',
                    academics: '/(school)/(tabs)/academics',
                    notices: '/(school)/notices',
                    events: '/(school)/calendar',
                    library: '/(school)/library',
                    transport: '/(school)/transport',
                    hr: '/(school)/hr',
                    leave: '/(school)/leave',
                    reports: '/(school)/reports',
                  };
                  router.push((map[item.key] ?? '/(school)/notices') as never);
                }}
              >
                <Text style={styles.actionLabel}>{item.label}</Text>
              </Pressable>
            ))}
        </View>
      </SchoolCard>

      <SchoolCard onPress={() => router.push('/(school)/notices' as never)}>
        <Text style={styles.cardTitle}>{t('notices')}</Text>
        {notices.length === 0 ? (
          <Text style={styles.muted}>No announcements right now.</Text>
        ) : (
          notices.slice(0, 3).map((n, i) => (
            <Text key={i} style={styles.line}>
              {String(n.title ?? n.headline ?? 'Notice')}
            </Text>
          ))
        )}
      </SchoolCard>
    </SchoolShell>
  );
}

const styles = StyleSheet.create({
  meta: { color: schoolUi.colors.muted, fontWeight: '600', marginBottom: 4 },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: schoolUi.colors.muted,
    textTransform: 'uppercase',
  },
  hero: { fontSize: 28, fontWeight: '800', color: schoolUi.colors.primary, marginTop: 6 },
  muted: { color: schoolUi.colors.muted, marginTop: 4 },
  line: { marginTop: 8, color: schoolUi.colors.text, fontWeight: '600' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#eef2ff',
  },
  chipOn: { backgroundColor: schoolUi.colors.primary },
  chipText: { fontWeight: '800', color: schoolUi.colors.primary },
  chipTextOn: { color: '#fff' },
  chipSub: { fontSize: 11, color: schoolUi.colors.muted },
  action: {
    backgroundColor: '#eef2ff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 96,
  },
  actionLabel: { fontWeight: '700', color: schoolUi.colors.primary, textAlign: 'center' },
});
