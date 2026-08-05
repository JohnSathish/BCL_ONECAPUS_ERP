import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { usePrincipalDrawerOptional } from '@/components/principal-portal/principal-drawer-context';
import { principalTheme } from '@/components/principal-portal/theme';
import { PRINCIPAL_MOBILE_NAV } from '@/config/principal-nav';

const MODULE_COPY: Record<
  string,
  { title: string; blurb: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  staff: {
    title: 'Staff Management',
    blurb:
      'Review staff roster, department headcount, and role assignments from the Principal command view.',
    icon: 'people-outline',
  },
  attendance: {
    title: 'Attendance Overview',
    blurb:
      'Campus-wide student and staff attendance pulse. Live rings already appear on your Dashboard home.',
    icon: 'checkbox-outline',
  },
  fees: {
    title: 'Fee & Finance Summary',
    blurb:
      'Collection trends and outstanding balances for executive review. Monthly totals are on Dashboard KPIs.',
    icon: 'wallet-outline',
  },
  academic: {
    title: 'Academic Performance',
    blurb: 'Programme and department performance summaries for Principal oversight.',
    icon: 'book-outline',
  },
  examinations: {
    title: 'Examination & Results',
    blurb: 'Exam schedules, result publication status, and exception queues.',
    icon: 'clipboard-outline',
  },
  timetable: {
    title: 'Timetable',
    blurb: 'Institutional timetable overview across streams and shifts.',
    icon: 'calendar-outline',
  },
  reports: {
    title: 'Reports & Analytics',
    blurb: 'Executive reports and analytics packs for governance and NAAC evidence.',
    icon: 'bar-chart-outline',
  },
  announcements: {
    title: 'Announcements',
    blurb: 'Publish and track campus-wide notices from the Principal Desk.',
    icon: 'megaphone-outline',
  },
  events: {
    title: 'Events & Calendar',
    blurb: 'Institutional calendar, meetings, and campus events.',
    icon: 'calendar-outline',
  },
  documents: {
    title: 'Documents & Circulars',
    blurb: 'Official circulars and document vault for Principal review.',
    icon: 'document-text-outline',
  },
  grievances: {
    title: 'Complaints & Grievances',
    blurb: 'Track grievance cases and escalation outcomes.',
    icon: 'alert-circle-outline',
  },
  transport: {
    title: 'Transport',
    blurb: 'Fleet and route overview for campuses where transport is enabled.',
    icon: 'bus-outline',
  },
  hostel: {
    title: 'Hostel',
    blurb: 'Hostel occupancy and administrative overview where applicable.',
    icon: 'home-outline',
  },
  library: {
    title: 'Library Overview',
    blurb: 'Library utilisation and circulation snapshot for leadership.',
    icon: 'library-outline',
  },
  'ai-insights': {
    title: 'AI Insights / Principal Assistant',
    blurb: 'AI-assisted campus insights and recommended actions for the Principal.',
    icon: 'sparkles-outline',
  },
};

function resolveMeta(slug: string) {
  if (MODULE_COPY[slug]) return MODULE_COPY[slug];
  for (const group of PRINCIPAL_MOBILE_NAV) {
    const item = group.items.find((i) => i.href.endsWith(`/module/${slug}`));
    if (item) {
      return {
        title: item.label,
        blurb: 'This Principal module is wired in navigation and opening on device.',
        icon: item.icon,
      };
    }
  }
  return {
    title: 'Principal Module',
    blurb: 'This command center module is being prepared for mobile.',
    icon: 'apps-outline' as const,
  };
}

export default function PrincipalModuleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const drawer = usePrincipalDrawerOptional();
  const key = String(slug || '');
  const meta = resolveMeta(key);

  return (
    <PrincipalScreenShell
      title={meta.title}
      subtitle="Principal command module"
      leftSlot={
        <Pressable
          hitSlop={10}
          onPress={() => drawer?.openDrawer()}
          accessibilityLabel="Open menu"
          style={styles.menuBtn}
        >
          <Ionicons name="menu" size={22} color={principalTheme.primaryAccent} />
        </Pressable>
      }
    >
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name={meta.icon} size={28} color={principalTheme.primaryAccent} />
        </View>
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.blurb}>{meta.blurb}</Text>
        <Text style={styles.note}>
          Full mobile workflows continue to roll out. Use Dashboard, Inbox, Leave Approvals, and
          Student Lookup for live actions today — or open the same module in Principal Desk on web.
        </Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push('/(principal)/(tabs)' as Href)}
        >
          <Text style={styles.primaryBtnText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    </PrincipalScreenShell>
  );
}

const styles = StyleSheet.create({
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: principalTheme.primarySoft,
  },
  card: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: principalTheme.border,
    gap: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: principalTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: principalTheme.text,
  },
  blurb: {
    fontSize: 14,
    lineHeight: 20,
    color: principalTheme.textMuted,
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    color: principalTheme.textSubtle,
    marginTop: 4,
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: principalTheme.primaryAccent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
