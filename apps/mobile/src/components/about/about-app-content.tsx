import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import { facultyTheme } from '@/components/faculty-portal/theme';
import {
  BASECODE_WEBSITE_URL,
  PRODUCT_NAME,
  APP_VERSION,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from '@/constants/release';

function AboutBody({
  textColor,
  mutedColor,
  borderColor,
  surfaceColor,
  accentColor,
}: {
  textColor: string;
  mutedColor: string;
  borderColor: string;
  surfaceColor: string;
  accentColor: string;
}) {
  const version = Constants.expoConfig?.version ?? APP_VERSION;
  const phoneDisplay = SUPPORT_PHONE.startsWith('+')
    ? SUPPORT_PHONE
    : `+91 ${SUPPORT_PHONE.replace(/^91/, '').replace(/(\d{5})(\d{5})/, '$1 $2')}`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }]}>
        <Text style={[styles.brand, { color: textColor }]}>{PRODUCT_NAME}</Text>
        <Text style={[styles.version, { color: mutedColor }]}>Version {version}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }]}>
        <Text style={[styles.label, { color: mutedColor }]}>Developed by</Text>
        <Text style={[styles.value, { color: textColor }]}>BaseCode Labs Pvt. Ltd.</Text>
        <Text style={[styles.tagline, { color: mutedColor }]}>Your Technology Growth Partner</Text>
      </View>

      <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }]}>
        <LinkRow
          label="Website"
          value={BASECODE_WEBSITE_URL.replace(/^https?:\/\//, '')}
          onPress={() => void Linking.openURL(BASECODE_WEBSITE_URL)}
          accent={accentColor}
          textColor={textColor}
          mutedColor={mutedColor}
        />
        <LinkRow
          label="Email"
          value={SUPPORT_EMAIL}
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          accent={accentColor}
          textColor={textColor}
          mutedColor={mutedColor}
        />
        <LinkRow
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
    </ScrollView>
  );
}

function LinkRow({
  label,
  value,
  onPress,
  accent,
  textColor,
  mutedColor,
  last,
}: {
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
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.linkValue, { color: accent || textColor }]}>{value}</Text>
    </Pressable>
  );
}

export function StudentAboutScreen() {
  return (
    <StudentScreenShell title="About" subtitle={PRODUCT_NAME}>
      <AboutBody
        textColor={studentTheme.text}
        mutedColor={studentTheme.textMuted}
        borderColor={studentTheme.border}
        surfaceColor={studentTheme.surface}
        accentColor={studentTheme.primaryLight}
      />
    </StudentScreenShell>
  );
}

export function StaffAboutScreen() {
  return (
    <FacultyScreenShell title="About" subtitle={PRODUCT_NAME}>
      <AboutBody
        textColor={facultyTheme.text}
        mutedColor={facultyTheme.textMuted}
        borderColor={facultyTheme.border}
        surfaceColor={facultyTheme.surface}
        accentColor={facultyTheme.primary}
      />
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  brand: { fontSize: 20, fontWeight: '800' },
  version: { fontSize: 14, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700' },
  value: { fontSize: 16, fontWeight: '800' },
  tagline: { fontSize: 13 },
  linkRow: { paddingVertical: 10, gap: 4 },
  linkBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  linkValue: { fontSize: 14, fontWeight: '700' },
});
