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
  useWindowDimensions,
  View,
} from 'react-native';
import { DateField } from '@/components/ui/date-field';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';
import {
  applyLeave,
  computeLeaveDays,
  fetchLeaveApplications,
  fetchLeaveSummary,
  formatLeaveDate,
  formatLeaveStatus,
  leaveStatusColor,
  type LeaveApplication,
  type LeaveSummary,
  type LeaveTypeOption,
} from '@/services/faculty-leave';

function BalanceTile({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.balanceTile}>
      <Text style={styles.balanceValue}>{value}</Text>
      <Text style={styles.balanceLabel}>{label}</Text>
    </View>
  );
}

function LeaveTypeChip({
  type,
  selected,
  onPress,
}: {
  type: LeaveTypeOption;
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

function ApplicationRow({ application }: { application: LeaveApplication }) {
  const color = leaveStatusColor(application.status);
  const statusText = formatLeaveStatus(application);
  const approvedOn = application.approvedAt || application.reviewedAt;
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyInfo}>
        <Text style={styles.historyTitle}>
          {application.leaveType?.name ?? 'Leave'} · {application.totalDays ?? '—'} day(s)
        </Text>
        <Text style={styles.historyDates}>
          {formatLeaveDate(application.fromDate)} → {formatLeaveDate(application.toDate)}
        </Text>
        {application.reason ? (
          <Text style={styles.historyReason} numberOfLines={2}>
            {application.reason}
          </Text>
        ) : null}
        {application.status === 'APPROVED' &&
        (application.approvedByRole || application.reviewedByRole) ? (
          <Text style={styles.historyReason} numberOfLines={2}>
            Approved by {application.approvedByRole || application.reviewedByRole}
            {approvedOn
              ? ` · ${new Date(approvedOn).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : ''}
          </Text>
        ) : null}
      </View>
      <View style={[styles.statusBadge, { backgroundColor: `${color}18` }]}>
        <Text style={[styles.statusText, { color }]}>{statusText}</Text>
      </View>
    </View>
  );
}

export default function FacultyLeaveScreen() {
  const { refreshHome } = useFacultyPortal();
  const { width } = useWindowDimensions();
  const stackDates = width < 380;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<LeaveSummary | null>(null);
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');

  const leaveTypes = summary?.leaveTypes ?? [];
  const dayCount = useMemo(
    () => (fromDate && toDate ? computeLeaveDays(fromDate, toDate) : null),
    [fromDate, toDate],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, apps] = await Promise.all([
        fetchLeaveSummary(),
        fetchLeaveApplications(),
      ]);
      setSummary(summaryData);
      setApplications(apps);
      setLeaveTypeId((prev) => prev || summaryData.leaveTypes?.[0]?.id || '');
    } catch {
      setSummary(null);
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
      await applyLeave({
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
      await refreshHome();
    } catch (e) {
      Alert.alert('Could not submit', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FacultyScreenShell title="Leave" subtitle="Apply & track leave requests">
      <ScrollView
        contentContainerStyle={[styles.container, { paddingHorizontal: stackDates ? 12 : 16 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        keyboardShouldPersistTaps="handled"
      >
        {loading && !summary ? (
          <ActivityIndicator color={facultyTheme.primaryLight} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.sectionTitle}>Leave Balance</Text>
              <View style={styles.balanceRow}>
                <BalanceTile label="CL" value={summary?.casual ?? 0} />
                <BalanceTile label="SL" value={summary?.sick ?? 0} />
                <BalanceTile label="EL" value={summary?.earned ?? 0} />
              </View>
              <Text style={styles.pendingText}>
                Pending requests: {summary?.pendingRequests ?? 0}
              </Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>Apply Leave</Text>

              {leaveTypes.length === 0 ? (
                <Text style={styles.helperText}>
                  No leave types are configured. Contact HR to set up leave types.
                </Text>
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

              <View style={[styles.dateRow, stackDates && styles.dateRowStacked]}>
                <View style={stackDates ? styles.dateFieldFull : styles.dateFieldHalf}>
                  <DateField
                    label="From"
                    value={fromDate}
                    onChange={(next) => {
                      setFromDate(next);
                      if (toDate && computeLeaveDays(next, toDate) === null) {
                        setToDate('');
                      }
                    }}
                    placeholder="Select start date"
                    accentColor={facultyTheme.primaryLight}
                    mutedColor={facultyTheme.textMuted}
                    borderColor={facultyTheme.border}
                    surfaceColor="#F9FAFB"
                  />
                </View>
                <View style={stackDates ? styles.dateFieldFull : styles.dateFieldHalf}>
                  <DateField
                    label="To"
                    value={toDate}
                    onChange={setToDate}
                    placeholder="Select end date"
                    minimumDate={fromDate ? new Date(fromDate) : undefined}
                    accentColor={facultyTheme.primaryLight}
                    mutedColor={facultyTheme.textMuted}
                    borderColor={facultyTheme.border}
                    surfaceColor="#F9FAFB"
                  />
                </View>
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
                  placeholderTextColor={facultyTheme.textSubtle}
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
                <Text style={styles.helperText}>No leave requests yet.</Text>
              ) : (
                applications.map((application) => (
                  <ApplicationRow key={application.id} application={application} />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16, gap: 14, paddingBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  balanceCard: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  balanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  balanceTile: {
    flex: 1,
    minWidth: 88,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  balanceValue: { fontSize: 22, fontWeight: '800', color: facultyTheme.text },
  balanceLabel: { fontSize: 11, fontWeight: '700', color: facultyTheme.textMuted, marginTop: 2 },
  pendingText: { fontSize: 12, color: facultyTheme.textMuted },
  formCard: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  typeRow: { gap: 8, paddingVertical: 2 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: facultyTheme.border,
    minWidth: 88,
  },
  typeChipActive: { backgroundColor: '#EFF6FF', borderColor: facultyTheme.primaryLight },
  typeChipText: { fontSize: 13, fontWeight: '700', color: facultyTheme.text },
  typeChipCode: { fontSize: 10, color: facultyTheme.textMuted, marginTop: 2 },
  typeChipTextActive: { color: facultyTheme.primaryLight },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dateRowStacked: { flexDirection: 'column' },
  dateFieldHalf: { flex: 1, minWidth: 140 },
  dateFieldFull: { width: '100%' },
  field: { flex: 1, gap: 4, minWidth: 140 },
  label: { fontSize: 12, fontWeight: '700', color: facultyTheme.textMuted },
  input: {
    borderWidth: 1,
    borderColor: facultyTheme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: facultyTheme.text,
    backgroundColor: '#F9FAFB',
  },
  reasonInput: { minHeight: 72, textAlignVertical: 'top' },
  dayCount: { fontSize: 12, fontWeight: '700', color: facultyTheme.primaryLight },
  helperText: { fontSize: 13, color: facultyTheme.textMuted },
  submitBtn: {
    backgroundColor: facultyTheme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  historyCard: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  historyRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: facultyTheme.border,
  },
  historyInfo: { flex: 1, gap: 2 },
  historyTitle: { fontSize: 13, fontWeight: '700', color: facultyTheme.text },
  historyDates: { fontSize: 12, color: facultyTheme.textMuted },
  historyReason: { fontSize: 11, color: facultyTheme.textSubtle, marginTop: 2 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '800' },
});
