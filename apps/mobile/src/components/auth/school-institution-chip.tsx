import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { switchInstitution } from '@/auth/switch-institution';
import { COLLEGE_NAME, PRODUCT_NAME } from '@/constants/release';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useSchoolConfig } from '@/hooks/use-school-config';

function institutionLabel(
  brandingName: string | null | undefined,
  schoolName: string | null | undefined,
) {
  const fromBranding = brandingName?.trim();
  if (fromBranding) return fromBranding;
  const fromSchool = schoolName?.trim();
  if (
    fromSchool &&
    fromSchool.toLowerCase() !== PRODUCT_NAME.toLowerCase() &&
    !/onecampus/i.test(fromSchool)
  ) {
    return fromSchool;
  }
  return COLLEGE_NAME;
}

export function SchoolInstitutionChip({
  light,
}: {
  /** Use on dark gradient headers */
  light?: boolean;
}) {
  const router = useRouter();
  const { school } = useSchoolConfig();
  const { config } = useBootstrap();

  if (!school) return null;

  const label = institutionLabel(config?.branding?.displayName, school.name);

  return (
    <View style={[styles.wrap, light && styles.wrapLight]}>
      <Text style={[styles.label, light && styles.labelLight]} numberOfLines={1}>
        {label}
      </Text>
      <Pressable
        hitSlop={8}
        onPress={() => {
          void switchInstitution(router);
        }}
      >
        <Text style={[styles.change, light && styles.changeLight]}>Change</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 60, 137, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  wrapLight: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  label: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  labelLight: { color: '#e0e7ff' },
  change: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
  },
  changeLight: { color: '#bfdbfe' },
});
