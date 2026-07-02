import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  fetchStudentExamAdmitCard,
  fetchStudentIaSchedule,
  formatExamDate,
  formatExamTimeRange,
  type IaExamScheduleItem,
  type StudentExamAdmitCard,
} from '@/services/student-exams';

type TabKey = 'ia' | 'semester';

function IaScheduleCard({ item }: { item: IaExamScheduleItem }) {
  return (
    <View style={styles.examCard}>
      <Text style={styles.examCode}>{item.paperCode ?? 'Paper'}</Text>
      <Text style={styles.examTitle}>{item.paperName ?? 'Internal Assessment'}</Text>
      <Text style={styles.examMeta}>{formatExamDate(item.examDate)}</Text>
      <Text style={styles.examTime}>{formatExamTimeRange(item.startTime, item.endTime)}</Text>
    </View>
  );
}

export default function StudentExamScheduleScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('ia');
  const [loading, setLoading] = useState(true);
  const [iaSchedule, setIaSchedule] = useState<IaExamScheduleItem[]>([]);
  const [admit, setAdmit] = useState<StudentExamAdmitCard | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ia, semester] = await Promise.all([
        fetchStudentIaSchedule().catch(() => ({ schedule: [] })),
        fetchStudentExamAdmitCard().catch(() => null),
      ]);
      setIaSchedule(ia.schedule ?? []);
      setAdmit(semester);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const semesterRows = useMemo(() => {
    const papers = admit?.papers ?? [];
    const seats = admit?.seats ?? [];
    const rooms = admit?.rooms ?? [];
    return seats.map((seat) => ({
      seat,
      paper: papers.find((paper) => paper.id === seat.paperId),
      room: rooms.find((room) => room.id === seat.classroomId),
    }));
  }, [admit]);

  return (
    <StudentScreenShell title="Exam Schedule" subtitle="Internal & semester examinations">
      <View style={styles.tabs}>
        <TabButton label="Internal (IA)" active={tab === 'ia'} onPress={() => setTab('ia')} />
        <TabButton
          label="Semester Exams"
          active={tab === 'semester'}
          onPress={() => setTab('semester')}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {loading ? (
          <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 24 }} />
        ) : tab === 'ia' ? (
          iaSchedule.length === 0 ? (
            <Text style={styles.muted}>No internal assessment schedule published yet.</Text>
          ) : (
            iaSchedule.map((item) => <IaScheduleCard key={item.id} item={item} />)
          )
        ) : admit?.feeBlocked ? (
          <View style={styles.blockCard}>
            <Text style={styles.blockTitle}>Hall ticket blocked</Text>
            <Text style={styles.blockBody}>
              Clear outstanding fees before semester exam seating is released.
              {admit.outstandingAmount != null
                ? ` Outstanding: ₹${Number(admit.outstandingAmount).toLocaleString('en-IN')}`
                : ''}
            </Text>
            {(admit.feeBlockReasons ?? []).map((reason) => (
              <Text key={reason} style={styles.blockReason}>
                • {reason}
              </Text>
            ))}
            <Pressable
              style={styles.linkBtn}
              onPress={() => router.push('/(student)/(tabs)/fees' as never)}
            >
              <Text style={styles.linkBtnText}>Go to Fees →</Text>
            </Pressable>
          </View>
        ) : semesterRows.length === 0 ? (
          <Text style={styles.muted}>No semester exam seating has been published yet.</Text>
        ) : (
          <>
            {admit?.session?.name ? (
              <Text style={styles.sessionLabel}>{admit.session.name}</Text>
            ) : null}
            {semesterRows.map(({ seat, paper, room }) => (
              <View key={seat.id} style={styles.examCard}>
                <Text style={styles.examCode}>{paper?.paperCode ?? 'Paper'}</Text>
                <Text style={styles.examTitle}>{paper?.paperName ?? 'Semester Examination'}</Text>
                <Text style={styles.examMeta}>{formatExamDate(paper?.examDate)}</Text>
                <Text style={styles.examTime}>
                  {formatExamTimeRange(paper?.startTime, paper?.endTime)}
                </Text>
                <Text style={styles.examMeta}>
                  Room {room ? `${room.code ?? ''} ${room.name ?? ''}`.trim() : 'TBA'}
                  {seat.seatNumber ? ` · Seat ${seat.seatNumber}` : ''}
                </Text>
              </View>
            ))}
            {admit?.instructions ? (
              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>Instructions</Text>
                <Text style={styles.noteBody}>{admit.instructions}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </StudentScreenShell>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: studentTheme.surface,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  tabBtnActive: { backgroundColor: '#eff6ff', borderColor: studentTheme.primaryLight },
  tabText: { fontSize: 12, fontWeight: '700', color: studentTheme.textMuted },
  tabTextActive: { color: studentTheme.primaryLight },
  container: { padding: 16, gap: 10, paddingBottom: 28 },
  muted: { fontSize: 13, color: studentTheme.textMuted },
  sessionLabel: { fontSize: 12, fontWeight: '700', color: studentTheme.primaryLight },
  examCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 4,
  },
  examCode: { fontSize: 11, fontWeight: '800', color: studentTheme.primaryLight },
  examTitle: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  examMeta: { fontSize: 12, color: studentTheme.textMuted },
  examTime: { fontSize: 13, fontWeight: '700', color: studentTheme.text },
  blockCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 6,
  },
  blockTitle: { fontSize: 15, fontWeight: '800', color: '#991b1b' },
  blockBody: { fontSize: 13, color: '#b91c1c', lineHeight: 19 },
  blockReason: { fontSize: 12, color: '#b91c1c' },
  linkBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  linkBtnText: { color: studentTheme.primaryLight, fontWeight: '700', fontSize: 13 },
  noteCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 4,
  },
  noteTitle: { fontSize: 13, fontWeight: '800', color: studentTheme.text },
  noteBody: { fontSize: 12, color: studentTheme.textMuted, lineHeight: 18 },
});
