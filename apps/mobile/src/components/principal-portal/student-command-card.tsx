import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { principalTheme } from '@/components/principal-portal/theme';
import type { StudentCommandCard } from '@/types/principal-desk';
import { formatInr } from '@/utils/currency';

const BAND_COLOR: Record<StudentCommandCard['attendance']['band'], string> = {
  green: principalTheme.accent,
  orange: principalTheme.pending,
  red: principalTheme.urgent,
  neutral: principalTheme.textMuted,
};

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone ? { color: tone } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function StudentCommandCardView({ card }: { card: StudentCommandCard }) {
  const { basic, academic, attendance, fees, admitCard, library, hostel, examination } = card;
  const attPct = attendance.percentage != null ? `${attendance.percentage.toFixed(1)}%` : '—';
  const attTone = BAND_COLOR[attendance.band] ?? principalTheme.textMuted;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <StudentAvatar name={basic.fullName} photoUrl={basic.photoUrl} size={64} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{basic.fullName}</Text>
          <Text style={styles.meta}>
            {basic.enrollmentNumber}
            {basic.rollNumber ? ` · Roll ${basic.rollNumber}` : ''}
          </Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{academic.statusLabel || academic.status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Academic</Text>
        <Text style={styles.line}>
          {[academic.programme, academic.department].filter(Boolean).join(' · ') || '—'}
        </Text>
        <Text style={styles.subLine}>
          {[
            academic.semester != null ? `Sem ${academic.semester}` : null,
            academic.batch ? `Batch ${academic.batch}` : null,
            academic.majorSubject,
          ]
            .filter(Boolean)
            .join(' · ') || '—'}
        </Text>
      </View>

      <View style={styles.metricsRow}>
        <Metric label="Attendance" value={attPct} tone={attTone} />
        <Metric
          label="Fees due"
          value={formatInr(fees.outstandingAmount ?? 0)}
          tone={(fees.outstandingAmount ?? 0) > 0 ? principalTheme.urgent : principalTheme.accent}
        />
        <Metric
          label="Admit card"
          value={admitCard.eligible ? 'Eligible' : 'Blocked'}
          tone={admitCard.eligible ? principalTheme.accent : principalTheme.urgent}
        />
      </View>

      {!admitCard.eligible && admitCard.reasons?.length ? (
        <View style={styles.reasonBox}>
          {admitCard.reasons.slice(0, 3).map((reason) => (
            <Text key={reason} style={styles.reason}>
              • {reason}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Library</Text>
        <Text style={styles.line}>
          Held {library.booksCurrentlyHeld} · Due {library.dueBooks} · Fine{' '}
          {formatInr(library.fineAmount ?? 0)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Examination</Text>
        <Text style={styles.line}>
          {examination.examinationEligible ? 'Exam eligible' : 'Not eligible'}
          {examination.backlogs > 0 ? ` · ${examination.backlogs} backlog(s)` : ''}
          {examination.assignmentsPending > 0
            ? ` · ${examination.assignmentsPending} assignment(s) pending`
            : ''}
        </Text>
      </View>

      {hostel.isHosteller ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hostel</Text>
          <Text style={styles.line}>
            {[hostel.block, hostel.room].filter(Boolean).join(' / ') || 'Hosteller'}
            {hostel.warden ? ` · Warden: ${hostel.warden}` : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.contactRow}>
        {basic.mobile ? (
          <Pressable
            style={styles.contactBtn}
            onPress={() => void Linking.openURL(`tel:${basic.mobile}`)}
          >
            <Ionicons name="call-outline" size={16} color={principalTheme.primaryAccent} />
            <Text style={styles.contactText}>{basic.mobile}</Text>
          </Pressable>
        ) : null}
        {basic.email ? (
          <Pressable
            style={styles.contactBtn}
            onPress={() => void Linking.openURL(`mailto:${basic.email}`)}
          >
            <Ionicons name="mail-outline" size={16} color={principalTheme.primaryAccent} />
            <Text style={styles.contactText} numberOfLines={1}>
              {basic.email}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: principalTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: principalTheme.border,
    padding: 16,
    gap: 14,
  },
  header: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  headerText: { flex: 1, gap: 4 },
  name: { fontSize: 18, fontWeight: '800', color: principalTheme.text },
  meta: { fontSize: 13, color: principalTheme.textMuted, fontWeight: '600' },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: principalTheme.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: principalTheme.primaryAccent,
    textTransform: 'uppercase',
  },
  section: { gap: 4 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: principalTheme.textSubtle,
  },
  line: { fontSize: 14, color: principalTheme.text, fontWeight: '600' },
  subLine: { fontSize: 13, color: principalTheme.textMuted },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1,
    backgroundColor: principalTheme.background,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  metricLabel: { fontSize: 10, fontWeight: '700', color: principalTheme.textMuted },
  metricValue: { fontSize: 13, fontWeight: '800', color: principalTheme.text },
  reasonBox: {
    backgroundColor: principalTheme.criticalBg,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  reason: { fontSize: 12, color: principalTheme.urgent, lineHeight: 17 },
  contactRow: { gap: 8 },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: principalTheme.primarySoft,
  },
  contactText: { flex: 1, fontSize: 13, fontWeight: '600', color: principalTheme.primaryAccent },
});
