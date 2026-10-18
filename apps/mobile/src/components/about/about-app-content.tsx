import { useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import { facultyTheme } from '@/components/faculty-portal/theme';
import {
  BASECODE_WEBSITE_URL,
  COLLEGE_NAME,
  DEVELOPER_NAME,
  DEVELOPER_TAGLINE,
  PRODUCT_NAME,
  APP_VERSION,
  PRIVACY_POLICY_URL,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  TERMS_URL,
} from '@/constants/release';

const LICENSES = [
  { name: 'React', license: 'MIT' },
  { name: 'React Native', license: 'MIT' },
  { name: 'Expo', license: 'MIT' },
  { name: 'Expo Router', license: 'MIT' },
  { name: 'React Navigation', license: 'MIT' },
  { name: 'TanStack Query', license: 'MIT' },
  { name: 'Zustand', license: 'MIT' },
  { name: 'i18next', license: 'MIT' },
] as const;

function AboutBody({
  textColor,
  mutedColor,
  borderColor,
  surfaceColor,
  accentColor,
  audience,
  blurb,
}: {
  textColor: string;
  mutedColor: string;
  borderColor: string;
  surfaceColor: string;
  accentColor: string;
  audience: string;
  blurb: string;
}) {
  const [licensesOpen, setLicensesOpen] = useState(false);
  const version = Constants.expoConfig?.version ?? APP_VERSION;
  const phoneDisplay = SUPPORT_PHONE.startsWith('+')
    ? SUPPORT_PHONE
    : `+91 ${SUPPORT_PHONE.replace(/^91/, '').replace(/(\d{5})(\d{5})/, '$1 $2')}`;
  const year = new Date().getFullYear();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.hero, { backgroundColor: surfaceColor, borderColor }]}>
        <View style={styles.heroRow}>
          <Image source={require('../../../assets/icon.png')} style={styles.appIcon} />
          <View style={styles.heroCopy}>
            <Text style={[styles.brand, { color: textColor }]}>{PRODUCT_NAME}</Text>
            <Text style={[styles.audience, { color: mutedColor }]}>{audience}</Text>
            <View style={styles.versionPill}>
              <Text style={[styles.version, { color: accentColor }]}>Version {version}</Text>
            </View>
          </View>
        </View>
        <Text style={[styles.blurb, { color: mutedColor }]}>{blurb}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }]}>
        <View style={styles.developerRow}>
          <View style={styles.developerCopy}>
            <Text style={[styles.kicker, { color: mutedColor }]}>Developed by</Text>
            <Text style={[styles.developer, { color: textColor }]}>{DEVELOPER_NAME}</Text>
            <Text style={[styles.tagline, { color: mutedColor }]}>{DEVELOPER_TAGLINE}</Text>
          </View>
          <View style={styles.mark}>
            <Text style={styles.markLetter}>B</Text>
            <Text style={styles.markName}>BASECODE{'\n'}LABS</Text>
          </View>
        </View>
      </View>

      <View
        style={[styles.card, { backgroundColor: surfaceColor, borderColor, paddingVertical: 4 }]}
      >
        <LinkRow
          icon="🌐"
          tint="#DBEAFE"
          label="Website"
          value={BASECODE_WEBSITE_URL.replace(/^https?:\/\//, '')}
          onPress={() => void Linking.openURL(BASECODE_WEBSITE_URL)}
          accent={accentColor}
          textColor={textColor}
          mutedColor={mutedColor}
        />
        <LinkRow
          icon="✉️"
          tint="#D1FAE5"
          label="Email"
          value={SUPPORT_EMAIL}
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          accent={accentColor}
          textColor={textColor}
          mutedColor={mutedColor}
        />
        <LinkRow
          icon="📞"
          tint="#FFEDD5"
          label="Phone"
          value={phoneDisplay}
          onPress={() =>
            void Linking.openURL(`tel:+91${SUPPORT_PHONE.replace(/\D/g, '').slice(-10)}`)
          }
          accent={accentColor}
          textColor={textColor}
          mutedColor={mutedColor}
          last
        />
      </View>

      <Pressable
        style={[styles.menuCard, { backgroundColor: surfaceColor, borderColor }]}
        onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
      >
        <View style={[styles.menuIcon, { backgroundColor: '#EDE9FE' }]}>
          <Text>🔒</Text>
        </View>
        <View style={styles.menuCopy}>
          <Text style={[styles.menuTitle, { color: textColor }]}>Privacy Policy</Text>
          <Text style={[styles.menuHint, { color: mutedColor }]}>Read our privacy policy</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable
        style={[styles.menuCard, { backgroundColor: surfaceColor, borderColor }]}
        onPress={() => void Linking.openURL(TERMS_URL)}
      >
        <View style={[styles.menuIcon, { backgroundColor: '#DBEAFE' }]}>
          <Text>📋</Text>
        </View>
        <View style={styles.menuCopy}>
          <Text style={[styles.menuTitle, { color: textColor }]}>Terms & Conditions</Text>
          <Text style={[styles.menuHint, { color: mutedColor }]}>
            Read app terms and conditions
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable
        style={[styles.menuCard, { backgroundColor: surfaceColor, borderColor }]}
        onPress={() => setLicensesOpen(true)}
      >
        <View style={[styles.menuIcon, { backgroundColor: '#D1FAE5' }]}>
          <Text>{'</>'}</Text>
        </View>
        <View style={styles.menuCopy}>
          <Text style={[styles.menuTitle, { color: textColor }]}>Open Source Licenses</Text>
          <Text style={[styles.menuHint, { color: mutedColor }]}>
            Third-party libraries and licenses
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={[styles.footerTitle, { color: mutedColor }]}>
          © {year} {DEVELOPER_NAME}
        </Text>
        <Text style={[styles.footerHint, { color: mutedColor }]}>All rights reserved.</Text>
      </View>

      <Modal
        visible={licensesOpen}
        animationType="slide"
        onRequestClose={() => setLicensesOpen(false)}
      >
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Open Source Licenses</Text>
          <Text style={styles.modalHint}>Main libraries used by this app.</Text>
          <ScrollView contentContainerStyle={styles.licenseList}>
            {LICENSES.map((item) => (
              <View key={item.name} style={styles.licenseRow}>
                <Text style={styles.licenseName}>{item.name}</Text>
                <Text style={styles.licenseKind}>{item.license}</Text>
              </View>
            ))}
          </ScrollView>
          <Pressable style={styles.closeBtn} onPress={() => setLicensesOpen(false)}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

function LinkRow({
  icon,
  tint,
  label,
  value,
  onPress,
  accent,
  textColor,
  mutedColor,
  last,
}: {
  icon: string;
  tint: string;
  label: string;
  value: string;
  onPress: () => void;
  accent: string;
  textColor: string;
  mutedColor: string;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.linkRow, !last && styles.linkBorder, { borderBottomColor: mutedColor + '33' }]}
    >
      <View style={[styles.menuIcon, { backgroundColor: tint }]}>
        <Text>{icon}</Text>
      </View>
      <View style={styles.menuCopy}>
        <Text style={[styles.kicker, { color: mutedColor }]}>{label}</Text>
        <Text style={[styles.linkValue, { color: accent || textColor }]}>{value}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function StudentAboutScreen() {
  return (
    <StudentScreenShell title="About" subtitle={COLLEGE_NAME}>
      <AboutBody
        textColor={studentTheme.text}
        mutedColor={studentTheme.textMuted}
        borderColor={studentTheme.border}
        surfaceColor={studentTheme.surface}
        accentColor={studentTheme.primaryLight}
        audience="Student Mobile App"
        blurb="A unified platform for students to access academic information, attendance, fees, notifications and more."
      />
    </StudentScreenShell>
  );
}

export function StaffAboutScreen() {
  return (
    <FacultyScreenShell title="About" subtitle={COLLEGE_NAME}>
      <AboutBody
        textColor={facultyTheme.text}
        mutedColor={facultyTheme.textMuted}
        borderColor={facultyTheme.border}
        surfaceColor={facultyTheme.surface}
        accentColor={facultyTheme.primary}
        audience="Faculty Mobile App"
        blurb="A unified platform for faculty to manage classes, attendance, marks, notifications and more."
      />
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 36 },
  hero: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  heroRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  appIcon: { width: 64, height: 64, borderRadius: 16 },
  heroCopy: { flex: 1, gap: 2 },
  brand: { fontSize: 20, fontWeight: '800' },
  audience: { fontSize: 13, fontWeight: '600' },
  versionPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  version: { fontSize: 12, fontWeight: '700' },
  blurb: { fontSize: 13, lineHeight: 19 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  developerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  developerCopy: { flex: 1, gap: 2 },
  kicker: { fontSize: 12, fontWeight: '600' },
  developer: { fontSize: 16, fontWeight: '800' },
  tagline: { fontSize: 12 },
  mark: { alignItems: 'center', width: 72 },
  markLetter: { fontSize: 28, fontWeight: '900', color: '#1D4ED8' },
  markName: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1D4ED8',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  linkBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  linkValue: { fontSize: 14, fontWeight: '800' },
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: { flex: 1, gap: 2 },
  menuTitle: { fontSize: 15, fontWeight: '800' },
  menuHint: { fontSize: 12 },
  chevron: { fontSize: 22, color: '#9CA3AF', fontWeight: '600' },
  footer: {
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    paddingVertical: 16,
    alignItems: 'center',
    gap: 2,
  },
  footerTitle: { fontSize: 13, fontWeight: '800' },
  footerHint: { fontSize: 12 },
  modal: { flex: 1, padding: 20, paddingTop: 48, backgroundColor: '#fff' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  modalHint: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 12 },
  licenseList: { gap: 8, paddingBottom: 16 },
  licenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  licenseName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  licenseKind: { fontSize: 13, fontWeight: '700', color: '#1D4ED8' },
  closeBtn: {
    backgroundColor: '#0F3C89',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeText: { color: '#fff', fontWeight: '800' },
});
