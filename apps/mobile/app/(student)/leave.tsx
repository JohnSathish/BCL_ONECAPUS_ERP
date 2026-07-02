import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DateField } from '@/components/ui/date-field';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  applyStudentLeave,
  computeLeaveDays,
  fetchStudentLeaveApplications,
  fetchStudentLeaveTypes,
  formatLeaveDate,
  formatLeaveStatus,
  leaveStatusColor,
  type StudentLeaveApplication,
  type StudentLeaveType,
} from '@/services/student-leave';

function LeaveTypeChip({
  type,
  selected,
  onPress,
}: {
  type: StudentLeaveType;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.typeChip, selected && styles.typeChipActive]} onPress={onPress}>
      <Text style={[styles.typeChipText, selected && styles.typeChipTextActive]}>{type.name}</Text>
      <Text style={[styles.typeChipCode, selected && styles.typeChipTextActive]}>{type.code}</Text>
    </Pressable>
  );
}

export default function StudentLeaveScreen() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<StudentLeaveType[]>([]);
  const [applications, setApplications] = useState<StudentLeaveApplication[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');

  const pendingCount = applications.filter((a) => a.status === 'PENDING').length;
  const dayCount = useMemo(
    () => (fromDate && toDate ? computeLeaveDays(fromDate, toDate) : null),
    [fromDate, toDate],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [types, apps] = await Promise.all([
        fetchStudentLeaveTypes(),
        fetchStudentLeaveApplications(),
      ]);
      setLeaveTypes(types);
      setApplications(apps);
      setLeaveTypeId((prev) => prev || types[0]?.id || '');
    } catch {
      setLeaveTypes([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit() {
    if (!leaveTypeId) {
      Alert.alert('Select leave type', 'Choose a leave type before submitting.');
      return;
    }
    if (!fromDate || !toDate) {
      Alert.alert('Dates required', 'Select both from and to dates.');
      return;
    }
    if (dayCount == null || dayCount < 1) {
      Alert.alert('Invalid dates', 'To date must be on or after from date.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Reason required', 'Briefly describe the reason for leave.');
      return;
    }

    setSubmitting(true);
    try {
      await applyStudentLeave({
        leaveTypeId,
        fromDate,
        toDate,
        reason: reason.trim(),
      });
      Alert.alert('Submitted', 'Your leave request has been sent for approval.');
      setFromDate('');
      setToDate('');
      setReason('');
      await load();
    } catch (e) {
      Alert.alert('Could not submit', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StudentScreenShell title="Apply Leave" subtitle="Submit & track leave requests">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        keyboardShouldPersistTaps="handled"
      >
        {loading && leaveTypes.length === 0 ? (
          <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Leave Requests</Text>
              <Text style={styles.summaryMeta}>Pending approval: {pendingCount}</Text>
              <Text style={styles.summaryHint}>
                Leave balance tracking is managed by the college office after approval.
              </Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>Apply Leave</Text>

              {leaveTypes.length === 0 ? (
                <Text style={styles.muted}>No leave types are configured yet.</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.typeRow}
                >
                  {leaveTypes.map((type) => (
                    <LeaveTypeChip
                      key={type.id}
                      type={type}
                      selected={leaveTypeId === type.id}
                      onPress={() => setLeaveTypeId(type.id)}
                    />
                  ))}
                </ScrollView>
              )}

              <View style={styles.dateRow}>
                <DateField
                  label="From"
                  value={fromDate}
                  onChange={(next) => {
                    setFromDate(next);
                    if (toDate && computeLeaveDays(next, toDate) === null) setToDate('');
                  }}
                  placeholder="Select start date"
                  accentColor={studentTheme.primaryLight}
                  mutedColor={studentTheme.textMuted}
                  borderColor={studentTheme.border}
                />
                <DateField
                  label="To"
                  value={toDate}
                  onChange={setToDate}
                  placeholder="Select end date"
                  minimumDate={fromDate ? new Date(fromDate) : undefined}
                  accentColor={studentTheme.primaryLight}
                  mutedColor={studentTheme.textMuted}
                  borderColor={studentTheme.border}
                />
              </View>

              {dayCount != null ? (
                <Text style={styles.dayCount}>{dayCount} day(s) requested</Text>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.label}>Reason</Text>
                <TextInput
                  style={[styles.input, styles.reasonInput]}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Reason for leave"
                  placeholderTextColor={studentTheme.textSubtle}
                  multiline
                />
              </View>

              <Pressable
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                disabled={submitting || leaveTypes.length === 0}
                onPress={() => void onSubmit()}
              >
                <Text style={styles.submitBtnText}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.historyCard}>
              <Text style={styles.sectionTitle}>Recent Requests</Text>
              {applications.length === 0 ? (
                <Text style={styles.muted}>No leave requests yet.</Text>
              ) : (
                applications.map((application) => {
                  const color = leaveStatusColor(application.status);
                  return (
                    <View key={application.id} style={styles.historyRow}>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyTitle}>
                          {application.leaveType?.name ?? 'Leave'} · {application.totalDays ?? '—'}{' '}
                          day(s)
                        </Text>
                        <Text style={styles.historyDates}>
                          {formatLeaveDate(application.fromDate)} →{' '}
                          {formatLeaveDate(application.toDate)}
                        </Text>
                        {application.reason ? (
                          <Text style={styles.historyReason} numberOfLines={2}>
                            {application.reason}
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: `${color}18` }]}>
                        <Text style={[styles.statusText, { color }]}>
                          {formatLeaveStatus(application.status)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  summaryCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4,
  },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  summaryMeta: { fontSize: 13, fontWeight: '700', color: studentTheme.primaryLight },
  summaryHint: { fontSize: 12, color: studentTheme.textMuted, marginTop: 4 },
  formCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  typeRow: { gap: 8, paddingVertical: 2 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: studentTheme.border,
    minWidth: 88,
  },
  typeChipActive: { backgroundColor: '#eff6ff', borderColor: studentTheme.primaryLight },
  typeChipText: { fontSize: 13, fontWeight: '700', color: studentTheme.text },
  typeChipCode: { fontSize: 10, color: studentTheme.textMuted, marginTop: 2 },
  typeChipTextActive: { color: studentTheme.primaryLight },
  dateRow: { flexDirection: 'row', gap: 10 },
  field: { gap: 4 },
  label: { fontSize: 12, fontWeight: '700', color: studentTheme.textMuted },
  input: {
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: studentTheme.text,
    backgroundColor: '#f8fafc',
  },
  reasonInput: { minHeight: 72, textAlignVertical: 'top' },
  dayCount: { fontSize: 12, fontWeight: '700', color: studentTheme.primaryLight },
  muted: { fontSize: 13, color: studentTheme.textMuted },
  submitBtn: {
    backgroundColor: studentTheme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  historyCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  historyRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historyInfo: { flex: 1, gap: 2 },
  historyTitle: { fontSize: 13, fontWeight: '700', color: studentTheme.text },
  historyDates: { fontSize: 12, color: studentTheme.textMuted },
  historyReason: { fontSize: 11, color: studentTheme.textSubtle, marginTop: 2 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '800' },
});
