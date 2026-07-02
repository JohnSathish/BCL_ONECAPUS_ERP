import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  assignmentStatusColor,
  assignmentStatusLabel,
  fetchAllStudentAssignments,
  fetchLmsDashboard,
  formatDueDate,
  type StudentAssignmentRow,
} from '@/services/student-lms';

function AssignmentCard({ assignment }: { assignment: StudentAssignmentRow }) {
  const status = assignmentStatusLabel(assignment);
  const color = assignmentStatusColor(status);
  const marks = assignment.mySubmission?.feedback?.[0]?.marksAwarded;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.courseCode}>{assignment.courseCode ?? assignment.workspaceTitle}</Text>
        <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
          <Text style={[styles.badgeText, { color }]}>{status}</Text>
        </View>
      </View>
      <Text style={styles.title}>{assignment.title}</Text>
      <Text style={styles.meta}>{assignment.workspaceTitle}</Text>
      <Text style={styles.meta}>Due {formatDueDate(assignment.dueAt)}</Text>
      {assignment.maxMarks != null ? (
        <Text style={styles.meta}>Max marks {assignment.maxMarks}</Text>
      ) : null}
      {marks != null ? <Text style={styles.marks}>Marks awarded: {marks}</Text> : null}
    </View>
  );
}

export default function StudentAssignmentsScreen() {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<StudentAssignmentRow[]>([]);
  const [dueCount, setDueCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, dashboard] = await Promise.all([
        fetchAllStudentAssignments().catch(() => []),
        fetchLmsDashboard().catch(() => null),
      ]);
      setAssignments(rows);
      setDueCount(dashboard?.cards?.assignmentsDue ?? rows.filter((a) => !a.mySubmission).length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const pending = assignments.filter(
      (a) => assignmentStatusLabel(a) === 'Pending' || assignmentStatusLabel(a) === 'Overdue',
    );
    const submitted = assignments.filter((a) => {
      const status = assignmentStatusLabel(a);
      return status === 'Submitted' || status === 'Returned';
    });
    const graded = assignments.filter((a) => assignmentStatusLabel(a) === 'Graded');
    return { pending, submitted, graded };
  }, [assignments]);

  return (
    <StudentScreenShell title="Assignments" subtitle="LMS coursework across your subjects">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {loading && assignments.length === 0 ? (
          <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{dueCount}</Text>
              <Text style={styles.summaryLabel}>Assignments due</Text>
            </View>

            {assignments.length === 0 ? (
              <Text style={styles.muted}>No published assignments in your LMS workspaces yet.</Text>
            ) : (
              <>
                {grouped.pending.length > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>Due / Pending</Text>
                    {grouped.pending.map((assignment) => (
                      <AssignmentCard key={assignment.id} assignment={assignment} />
                    ))}
                  </>
                ) : null}

                {grouped.submitted.length > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>Submitted</Text>
                    {grouped.submitted.map((assignment) => (
                      <AssignmentCard key={assignment.id} assignment={assignment} />
                    ))}
                  </>
                ) : null}

                {grouped.graded.length > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>Graded</Text>
                    {grouped.graded.map((assignment) => (
                      <AssignmentCard key={assignment.id} assignment={assignment} />
                    ))}
                  </>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  muted: { fontSize: 13, color: studentTheme.textMuted },
  summaryCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  summaryValue: { fontSize: 28, fontWeight: '800', color: studentTheme.primaryLight },
  summaryLabel: { fontSize: 12, color: studentTheme.textMuted, marginTop: 4 },
  card: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  courseCode: { fontSize: 11, fontWeight: '800', color: studentTheme.primaryLight, flex: 1 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  title: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  meta: { fontSize: 12, color: studentTheme.textMuted },
  marks: { fontSize: 12, fontWeight: '700', color: studentTheme.success, marginTop: 4 },
});
