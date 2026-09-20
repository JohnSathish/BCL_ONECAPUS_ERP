import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { initials, inr, monthTitle } from '@/fees/format';
import { EmptyState, Loader } from '@/ui/kit';
import { colors } from '@/theme/tokens';

type MonthRow = {
  feeMonth: string;
  monthLabel: string;
  totalDue: number;
  grossDue: number;
  status: 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE';
  selectable: boolean;
};
type HistoryRow = {
  id: string;
  paidAt: string;
  receiptNumber: string;
  months: string[];
  amount: number;
  status: string;
};
type Guardian = { fullName: string; relation: string; phone?: string | null };
type FeesPayload = {
  structure?: {
    lines?: Array<{ code?: string; label: string; amount: number | null; kind?: string }>;
  } | null;
  monthly?: {
    academicYear?: { name?: string };
    student?: {
      fullName?: string;
      admissionNumber?: string;
      phone?: string | null;
      photoUrl?: string | null;
    };
    className?: string;
    sectionName?: string;
    currentMonth?: string;
    unpaidMonths?: number;
    totalOutstanding?: number;
    rows?: MonthRow[];
    history?: HistoryRow[];
  } | null;
  profile?: {
    fullName?: string;
    admissionNumber?: string;
    classLabel?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    academicYearName?: string | null;
    photoUrl?: string | null;
    guardians?: Guardian[];
  } | null;
};

function currentMonthLabel(iso?: string) {
  if (!iso) return '—';
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return iso;
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function StudentPhoto({ uri, name }: { uri?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  const src = mediaUrl(uri);
  if (!src || broken) {
    return (
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(name)}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: src }}
      style={styles.avatarPhoto}
      resizeMode="cover"
      onError={() => setBroken(true)}
    />
  );
}

export default function FeesScreen() {
  const router = useRouter();
  const [data, setData] = useState<FeesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<FeesPayload>('/v1/school-mobile/fees')
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const monthly = data?.monthly;
  const rows = monthly?.rows ?? [];
  const dueRows = rows.filter((r) => r.selectable);
  const paidCount = rows.filter((r) => r.status === 'PAID').length;
  const labels = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.feeMonth, r.monthLabel])),
    [rows],
  );
  const selected = rows.filter((r) => picked.includes(r.feeMonth));
  const monthlyTotal = selected.reduce((sum, r) => sum + r.totalDue, 0);
  const parent = data?.profile?.guardians?.[0];
  const name = monthly?.student?.fullName || data?.profile?.fullName || 'Student';
  const admission = monthly?.student?.admissionNumber || data?.profile?.admissionNumber;
  const classLabel =
    data?.profile?.classLabel ||
    [monthly?.className, monthly?.sectionName].filter(Boolean).join(' ') ||
    null;
  const year = monthly?.academicYear?.name || data?.profile?.academicYearName || '';
  const photo = data?.profile?.photoUrl || monthly?.student?.photoUrl || null;
  const admLine = data?.structure?.lines?.find(
    (l) => l.code === 'ADM' || /admission/i.test(l.label),
  );
  const admPaid = Boolean(
    admLine?.amount != null &&
    (monthly?.history ?? []).some((h) => Math.abs(h.amount - (admLine.amount ?? 0)) < 1),
  );
  const history = (monthly?.history ?? []).slice(0, 3);

  const toggle = (month: string, selectable: boolean) => {
    if (!selectable) return;
    setPicked((cur) => (cur.includes(month) ? cur.filter((m) => m !== month) : [...cur, month]));
  };

  if (!data && !error) {
    return (
      <SafeAreaView style={styles.page} edges={['top']}>
        <Loader />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.page}>
      <LinearGradient colors={['#1a237e', '#283593']} style={styles.hero}>
        <SafeAreaView edges={['top']} style={styles.heroBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.heroTitle}>Fees</Text>
          <Pressable onPress={() => router.push('/fees-history')} style={styles.historyChip}>
            <Text style={styles.historyChipText}>Payment History</Text>
          </Pressable>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {error ? <EmptyState title="Fee details unavailable" body={error} /> : null}

        <View style={styles.card}>
          <View style={styles.who}>
            <StudentPhoto uri={photo} name={name} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.meta}>
                {[admission, classLabel ? `Class ${classLabel}` : null, year]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <View style={styles.active}>
              <View style={styles.dot} />
              <Text style={styles.activeText}>Active Student</Text>
            </View>
          </View>
          <View style={styles.contacts}>
            <Contact icon="👤" label="Parent" value={parent?.fullName || '—'} />
            <Contact
              icon="📱"
              label="Mobile"
              value={data?.profile?.phone || monthly?.student?.phone || parent?.phone || '—'}
            />
            <Contact icon="✉️" label="Email" value={data?.profile?.email || '—'} />
            <Contact icon="🏠" label="Address" value={data?.profile?.address || '—'} />
          </View>
        </View>

        <View style={styles.stats}>
          <Stat
            icon="💳"
            label="Total Outstanding"
            value={inr(monthly?.totalOutstanding ?? 0)}
            tint="#eff6ff"
          />
          <Stat
            icon="⏰"
            label="Unpaid Months"
            value={String(monthly?.unpaidMonths ?? 0)}
            tint="#fff1f2"
          />
          <Stat icon="✅" label="Paid Months" value={String(paidCount)} tint="#ecfdf5" />
          <Stat
            icon="📅"
            label="Current Month"
            value={currentMonthLabel(monthly?.currentMonth)}
            tint="#f5f3ff"
          />
        </View>

        {admLine ? (
          <View style={[styles.card, styles.adm, admPaid ? styles.admPaid : styles.admDue]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.admTitle}>🎓 Admission Fee</Text>
              <Text style={styles.admBody}>
                {admPaid
                  ? `Admission fee for ${year || 'this year'} has been paid.`
                  : `${admLine.label}${admLine.amount != null ? ` · ${inr(admLine.amount)}` : ''}`}
              </Text>
            </View>
            <Text style={admPaid ? styles.paidPill : styles.duePill}>
              {admPaid ? 'Paid' : 'Due'}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.monthHead}>
            <Text style={styles.section}>📅 Select Months to Pay</Text>
            {year ? <Text style={styles.yearChip}>{year}</Text> : null}
          </View>
          {!dueRows.length ? (
            <Text style={styles.quiet}>No unpaid months on this ledger.</Text>
          ) : (
            <View style={styles.monthGrid}>
              {dueRows.map((row) => {
                const on = picked.includes(row.feeMonth);
                return (
                  <Pressable
                    key={row.feeMonth}
                    onPress={() => toggle(row.feeMonth, row.selectable)}
                    style={[
                      styles.month,
                      on && styles.monthOn,
                      row.status === 'OVERDUE' && styles.monthOver,
                    ]}
                  >
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.monthDue}>DUE</Text>
                    <Text style={styles.monthName}>{row.monthLabel}</Text>
                    <Text style={styles.monthAmt}>{inr(row.totalDue || row.grossDue)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={styles.actions}>
            <Pressable
              onPress={() => setPicked(dueRows.map((r) => r.feeMonth))}
              style={styles.action}
            >
              <Text style={styles.actionText}>Select All</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const cur = monthly?.currentMonth;
                const row = dueRows.find((r) => r.feeMonth === cur);
                if (row) setPicked([row.feeMonth]);
              }}
              style={styles.action}
            >
              <Text style={styles.actionText}>Pay Current Month</Text>
            </Pressable>
            <Pressable onPress={() => setPicked([])} style={styles.action}>
              <Text style={styles.actionText}>Clear Selection</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Payment Summary</Text>
          <Summary label="Selected Months" value={String(picked.length)} />
          <Summary label="Monthly Fee Total" value={inr(monthlyTotal)} />
          <Summary label="Concession (Optional)" value={inr(0)} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{inr(monthlyTotal)}</Text>
          </View>
          <Pressable
            disabled={!picked.length}
            onPress={() =>
              Alert.alert(
                'Proceed to pay',
                `Pay ${inr(monthlyTotal)} at the school office. Online payment will appear here when the office enables it.`,
              )
            }
            style={[styles.pay, !picked.length && styles.payOff]}
          >
            <Text style={styles.payText}>Proceed to Pay →</Text>
          </Pressable>
          <Text style={styles.secure}>
            Secure Payment · UPI, Debit/Credit Card, Net Banking or Wallet
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.monthHead}>
            <Text style={styles.section}>Recent Payments</Text>
            <Pressable onPress={() => router.push('/fees-history')}>
              <Text style={styles.viewAll}>View All →</Text>
            </Pressable>
          </View>
          {!history.length ? (
            <Text style={styles.quiet}>No receipts yet.</Text>
          ) : (
            history.map((row) => (
              <Pressable
                key={row.id}
                style={styles.payRow}
                onPress={() => router.push('/fees-history')}
              >
                <View style={styles.dateBox}>
                  <Text style={styles.dateDay}>
                    {new Date(row.paidAt).toLocaleDateString('en-IN', { day: '2-digit' })}
                  </Text>
                  <Text style={styles.dateMon}>
                    {new Date(row.paidAt).toLocaleDateString('en-IN', { month: 'short' })}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payName}>{monthTitle(row.months ?? [], labels)}</Text>
                  <Text style={styles.payMeta}>Transaction ID: {row.receiptNumber}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.paidMini}>Paid</Text>
                  <Text style={styles.payAmt}>{inr(row.amount)}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Contact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.contact}>
      <Text style={styles.contactIcon}>{icon}</Text>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text style={styles.contactValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
  tint,
}: {
  icon: string;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <View style={[styles.stat, { backgroundColor: tint }]}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#eef2fb' },
  hero: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: 16 },
  heroBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: '#fff', fontSize: 32, marginTop: -4 },
  heroTitle: { flex: 1, textAlign: 'center', color: '#fff', fontWeight: '800', fontSize: 18 },
  historyChip: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  historyChipText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  body: { padding: 14, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#1a237e',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eef2ff',
  },
  avatarText: { color: colors.navy, fontWeight: '800' },
  name: { fontWeight: '800', color: colors.ink, fontSize: 15, textTransform: 'uppercase' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  active: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  activeText: { color: '#16a34a', fontWeight: '700', fontSize: 11 },
  contacts: { flexDirection: 'row', marginTop: 14, gap: 6 },
  contact: { flex: 1 },
  contactIcon: { fontSize: 12 },
  contactLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  contactValue: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 2 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 16, padding: 10, gap: 2 },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  statValue: { color: colors.ink, fontWeight: '800', fontSize: 12 },
  adm: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  admPaid: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#bbf7d0' },
  admDue: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa' },
  admTitle: { fontWeight: '800', color: colors.ink },
  admBody: { color: colors.muted, fontSize: 12, marginTop: 2 },
  paidPill: { color: '#15803d', fontWeight: '800' },
  duePill: { color: '#c2410c', fontWeight: '800' },
  monthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  yearChip: {
    backgroundColor: '#eef2ff',
    color: colors.navy,
    fontWeight: '700',
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  quiet: { color: colors.muted, marginTop: 10 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  month: {
    width: '31.5%',
    borderWidth: 1,
    borderColor: '#fecdd3',
    backgroundColor: '#fff1f2',
    borderRadius: 12,
    padding: 8,
    minHeight: 88,
  },
  monthOn: { borderColor: colors.navy, backgroundColor: '#eef2ff' },
  monthOver: {},
  check: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  checkMark: { color: '#fff', fontSize: 10, fontWeight: '800' },
  monthDue: {
    position: 'absolute',
    right: 8,
    top: 8,
    color: '#e11d48',
    fontSize: 10,
    fontWeight: '800',
  },
  monthName: { marginTop: 10, fontWeight: '700', color: colors.ink, fontSize: 12 },
  monthAmt: { color: colors.navy, fontWeight: '800', marginTop: 4, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  action: { paddingVertical: 6 },
  actionText: { color: colors.navy, fontWeight: '700', fontSize: 12 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  sumLabel: { color: colors.muted },
  sumValue: { fontWeight: '700', color: colors.ink },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: { fontWeight: '800', fontSize: 16, color: colors.ink },
  totalValue: { fontWeight: '800', fontSize: 18, color: colors.ink },
  pay: {
    marginTop: 14,
    backgroundColor: colors.navy,
    borderRadius: 999,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payOff: { opacity: 0.45 },
  payText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secure: { textAlign: 'center', color: colors.muted, fontSize: 11, marginTop: 10 },
  viewAll: { color: colors.navy, fontWeight: '700', fontSize: 12 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  dateBox: {
    width: 44,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dateDay: { fontWeight: '800', color: colors.navy, fontSize: 16 },
  dateMon: { color: colors.navy, fontSize: 10, fontWeight: '700' },
  payName: { fontWeight: '800', color: colors.ink },
  payMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  paidMini: { color: '#16a34a', fontWeight: '800', fontSize: 11 },
  payAmt: { fontWeight: '800', color: colors.ink, marginTop: 2 },
});
