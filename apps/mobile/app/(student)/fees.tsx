import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { completeFeeCheckout } from '@/payments/checkout';
import {
  downloadAndShareReceiptPdf,
  fetchFeeSettings,
  fetchMyFeeAccount,
  initiateMyFeePayment,
} from '@/services/fees';
import type {
  AdmissionCycleStatus,
  MonthlyTrackerMonth,
  PayableFeeItem,
  StudentFeeAccount,
} from '@/types/fees';
import { formatInr } from '@/utils/currency';

function classifyPayable(item: PayableFeeItem) {
  const text = `${item.label} ${item.demandType ?? ''}`.toLowerCase();
  if (/monthly|tuition/.test(text)) return 'monthly';
  if (/admission|session|cycle/.test(text)) return 'admission';
  return 'other';
}

export default function StudentFeesScreen() {
  const [account, setAccount] = useState<StudentFeeAccount | null>(null);
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const payables = account?.payableItems ?? [];
  const allowAdvance = account?.studentPortal?.allowAdvanceMonthlyPayment ?? false;

  const payableByDemandId = useMemo(() => {
    const map = new Map<string, PayableFeeItem>();
    for (const p of payables) map.set(p.demandId, p);
    return map;
  }, [payables]);

  const pendingTrackerMonths = useMemo(
    () => account?.monthlyTracker?.months.filter((m) => m.status === 'PENDING') ?? [],
    [account?.monthlyTracker?.months],
  );

  const admissionPayables = payables.filter((p) => classifyPayable(p) === 'admission');
  const otherPayables = payables.filter((p) => classifyPayable(p) === 'other');

  const selectedItems = useMemo(
    () => payables.filter((p) => selectedIds.has(p.id)),
    [payables, selectedIds],
  );
  const selectedTotal = useMemo(
    () => selectedItems.reduce((s, p) => s + p.amount, 0),
    [selectedItems],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [acct, settings] = await Promise.all([fetchMyFeeAccount(), fetchFeeSettings()]);
      setAccount(acct);
      setOnlineEnabled(settings.onlinePaymentEnabled);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load fees');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setPayableSelection = (ids: string[]) => setSelectedIds(new Set(ids));

  const toggleDemand = (demandId: string) => {
    const item = payableByDemandId.get(demandId);
    if (item) toggleItem(item.id);
  };

  const removeFromCart = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const selectCurrentMonth = () => {
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const month =
      account?.monthlyTracker?.months.find(
        (m) => m.period === currentPeriod && m.status === 'PENDING',
      ) ?? pendingTrackerMonths[0];
    if (!month?.demandId) return;
    const item = payableByDemandId.get(month.demandId);
    if (item) setPayableSelection([item.id]);
  };

  const selectQuarter = () => {
    const ids = pendingTrackerMonths
      .slice(0, 3)
      .map((m) => (m.demandId ? payableByDemandId.get(m.demandId)?.id : null))
      .filter((id): id is string => Boolean(id));
    if (ids.length) setPayableSelection(ids);
  };

  const selectAllPending = () => {
    const ids = pendingTrackerMonths
      .map((m) => (m.demandId ? payableByDemandId.get(m.demandId)?.id : null))
      .filter((id): id is string => Boolean(id));
    if (ids.length) setPayableSelection(ids);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const onPay = async () => {
    const demandIds = [...new Set(selectedItems.map((p) => p.demandId))];
    if (!demandIds.length || selectedTotal <= 0) {
      Alert.alert('Select fees', 'Choose at least one outstanding item to pay.');
      return;
    }
    setPaying(true);
    setMessage('');
    setSuccess(false);
    try {
      const res = await initiateMyFeePayment({
        amount: selectedTotal,
        provider: 'RAZORPAY',
        demandIds,
      });
      const result = await completeFeeCheckout(res.checkout);
      setSuccess(result.success);
      setMessage(result.message);
      if (result.success) {
        setSelectedIds(new Set());
        await load();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
      if (msg !== 'Payment cancelled') {
        setSuccess(false);
        setMessage(msg);
      }
    } finally {
      setPaying(false);
    }
  };

  const onDownloadReceipt = async (receiptId: string, receiptNo: string) => {
    setDownloadingReceiptId(receiptId);
    try {
      await downloadAndShareReceiptPdf(receiptId, receiptNo);
    } catch (e) {
      Alert.alert('Receipt', e instanceof Error ? e.message : 'Could not open receipt');
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const tracker = account?.monthlyTracker;

  if (loading && !account) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading fee account…</Text>
      </View>
    );
  }

  if (!account?.studentId) {
    return (
      <View style={styles.centered}>
        <Text>No student profile linked to this account.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          selectedItems.length > 0 && styles.containerWithCart,
        ]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <View style={styles.summaryRow}>
          <SummaryCard
            label="Outstanding"
            value={formatInr(account.summary.outstanding)}
            warn={account.summary.outstanding > 0}
          />
          <SummaryCard label="Paid" value={formatInr(account.summary.totalPaid)} />
        </View>
        <View style={styles.summaryRow}>
          <SummaryCard label="Admission" value={account.admissionFeeStatus?.status ?? '—'} />
          <SummaryCard
            label="Monthly"
            value={
              account.monthlyFeeStatus?.status === 'PAID'
                ? 'Clear'
                : `${account.monthlyTracker?.pendingMonths ?? 0} pending`
            }
            warn={account.monthlyFeeStatus?.status === 'PENDING'}
          />
        </View>

        {(account.admissionCycles?.length ?? 0) > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admission fee timeline</Text>
            <Text style={styles.hint}>Select payable cycles to add them to your cart.</Text>
            {account.admissionCycles!.map((cycle) => (
              <AdmissionCycleRow
                key={cycle.cycleId}
                cycle={cycle}
                payable={cycle.demandId ? payableByDemandId.get(cycle.demandId) : undefined}
                selected={
                  cycle.demandId
                    ? selectedIds.has(payableByDemandId.get(cycle.demandId)?.id ?? '')
                    : false
                }
                onToggle={() => cycle.demandId && toggleDemand(cycle.demandId)}
              />
            ))}
          </View>
        ) : null}

        {tracker?.months?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Monthly fee calendar · {tracker.year}</Text>
            <QuickSelectBar
              pendingCount={pendingTrackerMonths.length}
              onSelectCurrent={selectCurrentMonth}
              onSelectQuarter={selectQuarter}
              onSelectAllPending={selectAllPending}
              onClear={clearSelection}
            />
            <View style={styles.monthGrid}>
              {tracker.months.map((m) => (
                <MonthlyCalendarCell
                  key={m.period}
                  month={m}
                  payable={m.demandId ? payableByDemandId.get(m.demandId) : undefined}
                  selected={
                    m.demandId
                      ? selectedIds.has(payableByDemandId.get(m.demandId)?.id ?? '')
                      : false
                  }
                  allowAdvance={allowAdvance}
                  onToggle={() => m.demandId && toggleDemand(m.demandId)}
                />
              ))}
            </View>
            <Text style={styles.hint}>
              Paid {tracker.paidMonths} · Pending {tracker.pendingMonths}
              {!allowAdvance
                ? ' · Future months locked until generated'
                : ' · Advance payment enabled'}
            </Text>
          </View>
        ) : null}

        {admissionPayables.length || otherPayables.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Other payable items</Text>
            {admissionPayables.map((item) => (
              <PayableRow
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                onToggle={() => toggleItem(item.id)}
              />
            ))}
            {otherPayables.map((item) => (
              <PayableRow
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                onToggle={() => toggleItem(item.id)}
              />
            ))}
          </View>
        ) : payables.length === 0 && account.summary.outstanding <= 0 ? (
          <View style={styles.clearBox}>
            <Text style={styles.clearText}>All fees are clear. No payment due.</Text>
          </View>
        ) : null}

        {message ? (
          <View style={[styles.banner, success ? styles.bannerOk : styles.bannerErr]}>
            <Text style={success ? styles.bannerOkText : styles.bannerErrText}>{message}</Text>
          </View>
        ) : null}

        {account.paymentHistory?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment history</Text>
            {account.paymentHistory.slice(0, 10).map((row) => (
              <View key={row.id} style={styles.receiptRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.receiptNo}>
                    {new Date(row.paidAt).toLocaleDateString('en-IN')} · {row.paymentSourceLabel}
                  </Text>
                  <Text style={styles.hint}>{row.feeHeads.join(', ') || 'Fee payment'}</Text>
                </View>
                <Text style={styles.receiptAmt}>{formatInr(row.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {account.receipts?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receipts</Text>
            {account.receipts.slice(0, 10).map((r) => (
              <View key={r.id} style={styles.receiptRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.receiptNo}>{r.receiptNo}</Text>
                  <Text style={styles.hint}>
                    {new Date(r.issuedAt).toLocaleDateString('en-IN')} · {formatInr(r.amount)}
                  </Text>
                </View>
                <Pressable
                  style={styles.downloadBtn}
                  disabled={downloadingReceiptId === r.id}
                  onPress={() => void onDownloadReceipt(r.id, r.receiptNo)}
                >
                  {downloadingReceiptId === r.id ? (
                    <ActivityIndicator size="small" color="#1d4ed8" />
                  ) : (
                    <Text style={styles.downloadBtnText}>PDF</Text>
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {selectedItems.length > 0 ? (
        <PaymentCartBar
          items={selectedItems}
          total={selectedTotal}
          onlineEnabled={onlineEnabled}
          paying={paying}
          onRemove={removeFromCart}
          onPay={() => void onPay()}
        />
      ) : null}
    </View>
  );
}

function QuickSelectBar({
  pendingCount,
  onSelectCurrent,
  onSelectQuarter,
  onSelectAllPending,
  onClear,
}: {
  pendingCount: number;
  onSelectCurrent: () => void;
  onSelectQuarter: () => void;
  onSelectAllPending: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.quickRow}>
      <Chip label="Current" onPress={onSelectCurrent} />
      <Chip label="Quarter" onPress={onSelectQuarter} disabled={pendingCount < 2} />
      <Chip label="All pending" onPress={onSelectAllPending} disabled={pendingCount < 1} />
      <Chip label="Clear" onPress={onClear} variant="ghost" />
    </View>
  );
}

function Chip({
  label,
  onPress,
  disabled,
  variant,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'ghost';
}) {
  return (
    <Pressable
      style={[
        styles.chip,
        variant === 'ghost' && styles.chipGhost,
        disabled && styles.chipDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={[styles.chipText, variant === 'ghost' && styles.chipGhostText]}>{label}</Text>
    </Pressable>
  );
}

function MonthlyCalendarCell({
  month,
  payable,
  selected,
  allowAdvance,
  onToggle,
}: {
  month: MonthlyTrackerMonth;
  payable?: PayableFeeItem;
  selected: boolean;
  allowAdvance: boolean;
  onToggle: () => void;
}) {
  const amount = payable?.amount ?? month.balanceAmount ?? month.amount ?? 0;
  const isPaid = month.status === 'PAID';
  const isAdvanceSelectable = month.status === 'NOT_GENERATED' && allowAdvance && Boolean(payable);
  const selectable = (month.status === 'PENDING' || isAdvanceSelectable) && Boolean(payable);

  if (isPaid) {
    return (
      <View style={[styles.monthCell, styles.monthPaid]}>
        <Text style={styles.monthCheck}>✓</Text>
        <Text style={styles.monthLabel}>{month.shortLabel}</Text>
        <Text style={styles.monthStatus}>Paid</Text>
      </View>
    );
  }

  if (selectable) {
    return (
      <Pressable
        style={[styles.monthCell, styles.monthPending, selected && styles.monthSelected]}
        onPress={onToggle}
      >
        <View style={[styles.monthCheckbox, selected && styles.monthCheckboxOn]}>
          {selected ? <Text style={styles.monthCheckboxMark}>✓</Text> : null}
        </View>
        <Text style={styles.monthLabel}>{month.shortLabel}</Text>
        <Text style={styles.monthAmount}>{formatInr(amount)}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.monthCell, styles.monthFuture]}>
      <Text style={styles.monthLock}>🔒</Text>
      <Text style={styles.monthLabel}>{month.shortLabel}</Text>
      <Text style={styles.monthStatus}>Locked</Text>
    </View>
  );
}

function AdmissionCycleRow({
  cycle,
  payable,
  selected,
  onToggle,
}: {
  cycle: AdmissionCycleStatus;
  payable?: PayableFeeItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const selectable = Boolean(payable);
  const amount =
    payable?.amount ?? cycle.balanceAmount ?? cycle.totalAmount ?? cycle.configuredAmount;

  return (
    <Pressable
      style={[styles.cycleRow, selectable && selected && styles.cycleRowSelected]}
      disabled={!selectable}
      onPress={onToggle}
    >
      {selectable ? (
        <View style={[styles.checkbox, selected && styles.checkboxOn]}>
          {selected ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
      ) : (
        <View style={styles.cycleDot} />
      )}
      <View style={styles.cycleBody}>
        <Text style={styles.cycleName}>{cycle.cycleName}</Text>
        <Text style={styles.hint}>{cycle.covers}</Text>
      </View>
      <View style={styles.cycleRight}>
        <Text style={styles.cycleAmount}>{formatInr(amount)}</Text>
        <Text style={styles.cycleStatus}>{cycle.status}</Text>
      </View>
    </Pressable>
  );
}

function PaymentCartBar({
  items,
  total,
  onlineEnabled,
  paying,
  onRemove,
  onPay,
}: {
  items: PayableFeeItem[];
  total: number;
  onlineEnabled: boolean;
  paying: boolean;
  onRemove: (id: string) => void;
  onPay: () => void;
}) {
  return (
    <View style={styles.cartBar}>
      <Text style={styles.cartTitle}>Payment cart · {items.length} item(s)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cartScroll}>
        {items.map((item) => (
          <View key={item.id} style={styles.cartChip}>
            <Text style={styles.cartChipLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.cartChipAmt}>{formatInr(item.amount)}</Text>
            <Pressable onPress={() => onRemove(item.id)} hitSlop={8}>
              <Text style={styles.cartRemove}>×</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <View style={styles.cartFooter}>
        <Text style={styles.cartTotal}>
          Total <Text style={styles.cartTotalAmt}>{formatInr(total)}</Text>
        </Text>
        <Pressable
          style={[styles.payButton, (!onlineEnabled || paying || total <= 0) && styles.payDisabled]}
          disabled={!onlineEnabled || paying || total <= 0}
          onPress={onPay}
        >
          {paying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payButtonText}>Pay now</Text>
          )}
        </Pressable>
      </View>
      {!onlineEnabled ? (
        <Text style={styles.hintWarn}>Online payment is not available for this institution.</Text>
      ) : null}
    </View>
  );
}

function SummaryCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={[styles.summaryCard, warn && styles.summaryWarn]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function PayableRow({
  item,
  selected,
  onToggle,
}: {
  item: PayableFeeItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={styles.payableRow} onPress={onToggle}>
      <View style={[styles.checkbox, selected && styles.checkboxOn]}>
        {selected ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <View style={styles.payableBody}>
        <Text style={styles.payableLabel}>{item.label}</Text>
        {item.fineAmount > 0 ? (
          <Text style={styles.fine}>Includes late fine {formatInr(item.fineAmount)}</Text>
        ) : null}
      </View>
      <Text style={styles.payableAmt}>{formatInr(item.amount)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  containerWithCart: { paddingBottom: 200 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  muted: { color: '#666' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  summaryWarn: { borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  summaryLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase' },
  summaryValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  section: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipGhost: { borderColor: 'transparent', backgroundColor: 'transparent' },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },
  chipGhostText: { color: '#6b7280' },
  payableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  payableBody: { flex: 1 },
  payableLabel: { fontWeight: '600' },
  fine: { fontSize: 12, color: '#dc2626', marginTop: 2 },
  payableAmt: { fontWeight: '700' },
  hint: { fontSize: 12, color: '#6b7280' },
  hintWarn: { fontSize: 12, color: '#92400e' },
  clearBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  clearText: { color: '#065f46' },
  banner: { borderRadius: 8, padding: 12 },
  bannerOk: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  bannerErr: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  bannerOkText: { color: '#065f46' },
  bannerErrText: { color: '#991b1b' },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  receiptNo: { fontWeight: '500' },
  receiptAmt: { fontWeight: '600' },
  downloadBtn: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 44,
    alignItems: 'center',
  },
  downloadBtnText: { color: '#1d4ed8', fontWeight: '600', fontSize: 12 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthCell: {
    width: '15%',
    minWidth: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  monthPaid: { borderColor: '#86efac', backgroundColor: '#ecfdf5' },
  monthPending: { borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  monthFuture: { borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  monthSelected: { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  monthLabel: { fontSize: 11, fontWeight: '700' },
  monthStatus: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  monthAmount: { fontSize: 8, color: '#92400e', marginTop: 2 },
  monthCheck: { fontSize: 12, color: '#059669' },
  monthLock: { fontSize: 10 },
  monthCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#d97706',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  monthCheckboxOn: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  monthCheckboxMark: { color: '#fff', fontSize: 9, fontWeight: '700' },
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
  },
  cycleRowSelected: { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  cycleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d1d5db',
  },
  cycleBody: { flex: 1 },
  cycleName: { fontWeight: '600' },
  cycleRight: { alignItems: 'flex-end' },
  cycleAmount: { fontWeight: '700' },
  cycleStatus: { fontSize: 10, color: '#6b7280', marginTop: 2, textTransform: 'uppercase' },
  cartBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  cartTitle: { fontSize: 13, fontWeight: '600' },
  cartScroll: { maxHeight: 44 },
  cartChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    maxWidth: 180,
  },
  cartChipLabel: { fontSize: 12, fontWeight: '500', flexShrink: 1 },
  cartChipAmt: { fontSize: 12, fontWeight: '700' },
  cartRemove: { fontSize: 16, color: '#6b7280', fontWeight: '700' },
  cartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cartTotal: { flex: 1, fontSize: 14 },
  cartTotalAmt: { fontWeight: '700', fontSize: 16 },
  payButton: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 110,
    alignItems: 'center',
  },
  payDisabled: { opacity: 0.5 },
  payButtonText: { color: '#fff', fontWeight: '600' },
});
