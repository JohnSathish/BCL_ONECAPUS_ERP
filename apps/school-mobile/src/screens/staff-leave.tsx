import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '@/api/client';
import { EmptyState, Loader, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';
import { addDayKey, formatMonthLong, istDayKey, sundayMonthGrid } from '@/timetable/format';

type LeaveType = {
  id: string;
  code: string;
  name: string;
  requiresDocument?: boolean;
  isLop?: boolean;
};

type Balance = {
  id: string;
  code: string;
  name: string;
  remaining: number;
  entitled: number;
};

type RequestRow = {
  id: string;
  typeName: string;
  typeCode: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason?: string | null;
  status: string;
  reviewNote?: string | null;
};

type Pack = {
  year: number;
  balances: Balance[];
  types: LeaveType[];
  requests: RequestRow[];
};

const TABS = ['Apply Leave', 'My Applications', 'Leave History'] as const;
type Tab = (typeof TABS)[number];
const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function lookFor(code: string, name: string) {
  const n = `${code} ${name}`.toLowerCase();
  if (/casual|\bcl\b/.test(n)) return { icon: '🌴', bg: '#eff6ff', ink: '#1d4ed8' };
  if (/sick|medical|\bml\b|\bsl\b/.test(n)) return { icon: '🛏️', bg: '#ecfdf3', ink: '#047857' };
  if (/earned|privilege|\bel\b/.test(n)) return { icon: '🧳', bg: '#fffbeb', ink: '#b45309' };
  return { icon: '📄', bg: '#f5f3ff', ink: '#6d28d9' };
}

function statusLook(status: string) {
  const s = status.toUpperCase();
  if (s === 'APPROVED') return { bg: '#dcfce7', ink: '#15803d', label: 'Approved' };
  if (s === 'REJECTED') return { bg: '#fee2e2', ink: '#dc2626', label: 'Rejected' };
  if (s === 'CANCELLED') return { bg: '#e2e8f0', ink: '#475569', label: 'Cancelled' };
  return { bg: '#dbeafe', ink: '#1d4ed8', label: 'Pending' };
}

function prettyDate(key: string) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function displayDate(key: string) {
  if (!key) return 'dd/mm/yyyy';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function daysBetween(from: string, to: string) {
  if (!from || !to || to < from) return 0;
  let n = 1;
  let cur = from;
  while (cur < to) {
    cur = addDayKey(cur, 1);
    n += 1;
    if (n > 400) break;
  }
  return n;
}

function fmtNum(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

export function StaffLeave() {
  const today = istDayKey();
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('Apply Leave');
  const [typeId, setTypeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState('');
  const [saving, setSaving] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [dateField, setDateField] = useState<'from' | 'to' | null>(null);
  const [monthStamp, setMonthStamp] = useState(() => today.slice(0, 7));

  const load = useCallback(async () => {
    const data = await apiFetch<Pack>('/v1/school-mobile/staff/leave');
    setPack(data);
    setError(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load()
        .catch((err: Error) => setError(err.message))
        .finally(() => setBooting(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh leave.');
    } finally {
      setRefreshing(false);
    }
  };

  const selectedType = pack?.types.find((row) => row.id === typeId) ?? null;
  const totalDays = daysBetween(fromDate, toDate);
  const cards = useMemo(() => {
    const rows = pack?.balances ?? [];
    if (rows.length <= 4) return rows;
    const head = rows.slice(0, 3);
    const rest = rows.slice(3);
    return [
      ...head,
      {
        id: 'other',
        code: 'OTHER',
        name: 'Other Leave',
        remaining: rest.reduce((n, row) => n + row.remaining, 0),
        entitled: rest.reduce((n, row) => n + row.entitled, 0),
      },
    ];
  }, [pack]);

  function resetForm() {
    setTypeId('');
    setFromDate('');
    setToDate('');
    setReason('');
    setAttachment('');
  }

  async function submit() {
    if (!typeId) {
      Alert.alert('Leave type', 'Please select a leave type.');
      return;
    }
    if (!fromDate || !toDate) {
      Alert.alert('Dates', 'Please choose from and to dates.');
      return;
    }
    if (reason.trim().length < 3) {
      Alert.alert('Reason', 'Please enter a reason for leave.');
      return;
    }
    const bal = pack?.balances.find((row) => row.id === typeId);
    if (bal && bal.entitled > 0 && totalDays > bal.remaining && !selectedType?.isLop) {
      Alert.alert('Balance', `Only ${fmtNum(bal.remaining)} day(s) remaining for ${bal.name}.`);
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/v1/school-mobile/staff/leave', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: typeId,
          fromDate,
          toDate,
          days: totalDays,
          reason: reason.trim(),
          attachment: attachment || undefined,
        }),
      });
      resetForm();
      await load();
      setTab('My Applications');
      Alert.alert('Submitted', 'Your leave application has been sent for approval.');
    } catch (err) {
      Alert.alert('Could not submit', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function pickDate(key: string) {
    if (dateField === 'from') {
      setFromDate(key);
      if (toDate && toDate < key) setToDate('');
    } else if (dateField === 'to') {
      if (fromDate && key < fromDate) {
        Alert.alert('To date', 'To date cannot be before from date.');
        return;
      }
      setToDate(key);
    }
    setDateField(null);
  }

  function shiftMonth(delta: number) {
    const [y, m] = monthStamp.split('-').map(Number);
    setMonthStamp(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7));
  }

  const applications = pack?.requests ?? [];
  const history = applications.filter((row) => {
    const s = row.status.toUpperCase();
    return s === 'APPROVED' || s === 'REJECTED' || s === 'CANCELLED';
  });
  const mine = applications.filter((row) => row.status.toUpperCase() === 'PENDING');
  const recent = applications.slice(0, 4);
  const grid = sundayMonthGrid(monthStamp);

  return (
    <Screen
      title="Leave Application"
      onBack
      action={
        <Pressable onPress={() => setTab('Leave History')} hitSlop={8}>
          <Text style={{ fontSize: 18 }}>📋</Text>
        </Pressable>
      }
    >
      {booting ? <Loader /> : null}
      {error && !pack ? <EmptyState title="Leave unavailable" body={error} /> : null}
      {!booting && pack ? (
        <ScrollView
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
        >
          <Text style={styles.subtitle}>
            Apply for leave and track your remaining balance. Approvals are recorded in the ERP.
          </Text>

          <View style={styles.kpiRow}>
            {cards.map((row) => {
              const look = lookFor(row.code, row.name);
              return (
                <View key={row.id} style={[styles.kpi, { backgroundColor: look.bg }]}>
                  <Text style={{ fontSize: 16 }}>{look.icon}</Text>
                  <Text style={[styles.kpiName, { color: look.ink }]} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={[styles.kpiValue, { color: look.ink }]}>
                    {fmtNum(row.remaining)} / {fmtNum(row.entitled)}
                  </Text>
                  <Text style={styles.kpiHint}>Remaining</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.tabs}>
            {TABS.map((item) => {
              const on = tab === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setTab(item)}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  <Text style={[styles.tabTxt, on && styles.tabTxtOn]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>

          {tab === 'Apply Leave' ? (
            <>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={{ fontSize: 16 }}>📝</Text>
                  <Text style={styles.cardTitle}>Apply for Leave</Text>
                </View>
                <Field label="Leave Type *">
                  <Pressable onPress={() => setTypeOpen(true)} style={styles.input}>
                    <Text style={selectedType ? styles.inputTxt : styles.placeholder}>
                      {selectedType?.name ?? 'Select leave type'}
                    </Text>
                    <Text style={styles.caret}>▾</Text>
                  </Pressable>
                </Field>
                <View style={styles.row2}>
                  <Field label="From Date *" style={{ flex: 1 }}>
                    <Pressable
                      onPress={() => {
                        setMonthStamp((fromDate || today).slice(0, 7));
                        setDateField('from');
                      }}
                      style={styles.input}
                    >
                      <Text style={fromDate ? styles.inputTxt : styles.placeholder}>
                        {displayDate(fromDate)}
                      </Text>
                    </Pressable>
                  </Field>
                  <Field label="To Date *" style={{ flex: 1 }}>
                    <Pressable
                      onPress={() => {
                        setMonthStamp((toDate || fromDate || today).slice(0, 7));
                        setDateField('to');
                      }}
                      style={styles.input}
                    >
                      <Text style={toDate ? styles.inputTxt : styles.placeholder}>
                        {displayDate(toDate)}
                      </Text>
                    </Pressable>
                  </Field>
                </View>
                <Field label="Total Days">
                  <View style={[styles.input, styles.inputDisabled]}>
                    <Text style={styles.inputTxt}>{totalDays}</Text>
                  </View>
                </Field>
                <Field label="Reason for Leave *">
                  <TextInput
                    value={reason}
                    onChangeText={(v) => setReason(v.slice(0, 200))}
                    placeholder="Enter reason for leave..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    style={[styles.input, styles.textarea]}
                  />
                  <Text style={styles.counter}>{reason.length}/200</Text>
                </Field>
                <Field label="Attach Document (Optional)">
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        'Supporting document',
                        'Optional documents can be submitted at the school office after you apply. This request will still be sent for approval.',
                        [
                          { text: 'OK' },
                          attachment
                            ? {
                                text: 'Remove note',
                                onPress: () => setAttachment(''),
                              }
                            : {
                                text: 'Mark as to follow',
                                onPress: () => setAttachment('To be submitted at school office'),
                              },
                        ],
                      )
                    }
                    style={styles.fileBtn}
                  >
                    <Text>📎 {attachment || 'Choose file'}</Text>
                  </Pressable>
                  <Text style={styles.fileHint}>PDF, JPG, PNG (Max 5 MB)</Text>
                </Field>
                <View style={styles.formActions}>
                  <Pressable onPress={resetForm} style={styles.resetBtn}>
                    <Text style={styles.resetTxt}>Reset</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void submit()}
                    disabled={saving}
                    style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                  >
                    <Text style={styles.submitTxt}>
                      {saving ? 'Submitting…' : 'Submit Application'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.listHead}>
                  <View style={styles.cardHead}>
                    <Text style={{ fontSize: 16 }}>🕒</Text>
                    <Text style={styles.cardTitle}>Recent Applications</Text>
                  </View>
                  <Pressable onPress={() => setTab('My Applications')}>
                    <Text style={styles.link}>View All ›</Text>
                  </Pressable>
                </View>
                {recent.length ? (
                  recent.map((row) => <LeaveRow key={row.id} row={row} />)
                ) : (
                  <Text style={styles.empty}>No applications yet.</Text>
                )}
              </View>
            </>
          ) : null}

          {tab === 'My Applications' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pending approval</Text>
              {mine.length ? (
                mine.map((row) => <LeaveRow key={row.id} row={row} />)
              ) : (
                <Text style={styles.empty}>No pending leave applications.</Text>
              )}
              <Text style={[styles.cardTitle, { marginTop: 12 }]}>All applications</Text>
              {applications.length ? (
                applications.map((row) => <LeaveRow key={row.id} row={row} />)
              ) : (
                <Text style={styles.empty}>You have not applied for leave yet.</Text>
              )}
            </View>
          ) : null}

          {tab === 'Leave History' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Approved and rejected</Text>
              {history.length ? (
                history.map((row) => <LeaveRow key={row.id} row={row} />)
              ) : (
                <Text style={styles.empty}>No leave history yet.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.note}>
            <Text style={styles.noteIcon}>ℹ️</Text>
            <Text style={styles.noteText}>
              Leave is subject to approval by the Principal / Administration. Please ensure that you
              apply in advance.
            </Text>
          </View>
        </ScrollView>
      ) : null}

      <Modal
        visible={typeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTypeOpen(false)}
      >
        <Pressable style={styles.scrim} onPress={() => setTypeOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Select leave type</Text>
            {(pack?.types ?? []).map((row) => (
              <Pressable
                key={row.id}
                onPress={() => {
                  setTypeId(row.id);
                  setTypeOpen(false);
                }}
                style={[styles.modalRow, typeId === row.id && styles.modalRowOn]}
              >
                <Text style={{ fontSize: 16 }}>{lookFor(row.code, row.name).icon}</Text>
                <Text style={styles.modalRowTxt}>{row.name}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(dateField)}
        transparent
        animationType="fade"
        onRequestClose={() => setDateField(null)}
      >
        <Pressable style={styles.scrim} onPress={() => setDateField(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <View style={styles.calHead}>
              <Pressable onPress={() => shiftMonth(-1)} hitSlop={8}>
                <Text style={styles.arrow}>‹</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{formatMonthLong(monthStamp)}</Text>
              <Pressable onPress={() => shiftMonth(1)} hitSlop={8}>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            </View>
            <View style={styles.calGrid}>
              {WEEK.map((d, i) => (
                <Text key={`${d}-${i}`} style={styles.calDow}>
                  {d}
                </Text>
              ))}
              {grid.map((cell) => {
                const on = (dateField === 'from' ? fromDate : toDate) === cell.key;
                const isToday = cell.key === today;
                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => !cell.outside && pickDate(cell.key)}
                    style={styles.calCell}
                  >
                    <View
                      style={[
                        styles.calBubble,
                        on && styles.calOn,
                        isToday && !on && styles.calToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calNum,
                          cell.outside && { color: '#cbd5e1' },
                          on && { color: '#fff' },
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Field({ label, children, style }: { label: string; children: ReactNode; style?: object }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function LeaveRow({ row }: { row: RequestRow }) {
  const look = lookFor(row.typeCode, row.typeName);
  const st = statusLook(row.status);
  return (
    <View style={styles.appRow}>
      <View style={[styles.appIcon, { backgroundColor: look.bg }]}>
        <Text>{look.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.appName}>{row.typeName}</Text>
        <Text style={styles.appMeta}>
          {prettyDate(row.fromDate)} – {prettyDate(row.toDate)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={styles.appDays}>
          {fmtNum(row.days)} Day{row.days === 1 ? '' : 's'}
        </Text>
        <View style={[styles.status, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusTxt, { color: st.ink }]}>{st.label}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  feed: { padding: space.md, gap: 12, paddingBottom: 48 },
  subtitle: {
    textAlign: 'center',
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  kpiName: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  kpiValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  kpiHint: { fontSize: 10, color: colors.muted, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#eef2ff',
    borderRadius: radii.pill,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, borderRadius: radii.pill, paddingVertical: 8, alignItems: 'center' },
  tabOn: { backgroundColor: '#2f3dd9' },
  tabTxt: { fontWeight: '800', color: '#64748b', fontSize: 11, textAlign: 'center' },
  tabTxtOn: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 14,
    gap: 12,
    shadowColor: '#1a237e',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontWeight: '800', color: colors.navy, fontSize: 15 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: '#2563eb', fontWeight: '800', fontSize: 12 },
  label: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputDisabled: { backgroundColor: '#f8fafc' },
  inputTxt: { color: colors.ink, fontWeight: '700' },
  placeholder: { color: '#94a3b8', fontWeight: '600' },
  caret: { color: colors.muted },
  textarea: { minHeight: 88, textAlignVertical: 'top', alignItems: 'flex-start' },
  counter: { alignSelf: 'flex-end', color: colors.muted, fontSize: 11, fontWeight: '700' },
  row2: { flexDirection: 'row', gap: 10 },
  fileBtn: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
  },
  fileHint: { color: colors.muted, fontSize: 11 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  resetBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resetTxt: { fontWeight: '800', color: colors.ink },
  submitBtn: {
    flex: 1.4,
    backgroundColor: '#2563eb',
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitTxt: { fontWeight: '800', color: '#fff' },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { fontWeight: '800', color: colors.ink },
  appMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  appDays: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  status: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statusTxt: { fontSize: 11, fontWeight: '800' },
  empty: { color: colors.muted, fontWeight: '600' },
  note: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#e0f2fe',
    borderRadius: radii.lg,
    padding: 12,
    alignItems: 'flex-start',
  },
  noteIcon: { fontSize: 16, marginTop: 1 },
  noteText: { flex: 1, color: '#0369a1', fontSize: 13, lineHeight: 18 },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(10, 16, 72, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: radii.lg, padding: 16, gap: 8 },
  modalTitle: { fontWeight: '800', color: colors.navy, fontSize: 16, textAlign: 'center' },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  modalRowOn: { backgroundColor: '#eef2ff' },
  modalRowTxt: { fontWeight: '700', color: colors.ink },
  calHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  arrow: { fontSize: 22, color: colors.navy, fontWeight: '700', paddingHorizontal: 8 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDow: {
    width: '14.28%',
    textAlign: 'center',
    color: colors.muted,
    fontWeight: '800',
    fontSize: 11,
    paddingVertical: 6,
  },
  calCell: { width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center' },
  calBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calOn: { backgroundColor: '#2f3dd9' },
  calToday: { borderWidth: 1, borderColor: '#2f3dd9' },
  calNum: { fontWeight: '700', color: colors.ink },
});
