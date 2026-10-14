import { Image, type ImageStyle, StyleSheet, View, type StyleProp } from 'react-native';
import { useSchoolConfig } from '@/hooks/use-school-config';
import { isSchoolSisConfig } from '@/auth/school-product';
import { SCHOOL_LOGO } from '@/constants/school-branding';

/** Transparent crest — the app-icon PNG includes a purple plate that letterboxes badly. */
const DEFAULT_LOGO = require('../../../assets/college-crest.png');

type Shape = 'circle' | 'rounded';

type Props = {
  branding?: { logoUrl?: string | null };
  size?: number;
  style?: StyleProp<ImageStyle>;
  /** How the logo is cropped. College login uses a filled circle. */
  shape?: Shape;
};

export function InstitutionLogo({
  branding: _branding,
  size = 46,
  style,
  shape = 'rounded',
}: Props) {
  const { school } = useSchoolConfig();
  const schoolSis = isSchoolSisConfig(school);
  const radius = shape === 'circle' ? size / 2 : Math.max(16, Math.round(size * 0.22));
  const wrap = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: 'hidden' as const,
    backgroundColor: '#ffffff',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const source = schoolSis ? SCHOOL_LOGO : DEFAULT_LOGO;
  const pad = 6;
  const inner = size - pad * 2;
  const imageStyle: ImageStyle = {
    width: inner,
    height: inner,
  };

  return (
    <View style={wrap}>
      <Image source={source} style={[imageStyle, style]} resizeMode="contain" />
    </View>
  );
}

export function InstitutionLogoRing({
  branding,
  size = 46,
  shape = 'rounded',
}: {
  branding?: { logoUrl?: string | null };
  size?: number;
  shape?: Shape;
}) {
  const pad = 6;
  const outer = size + pad * 2;
  const radius = shape === 'circle' ? outer / 2 : Math.max(12, Math.round(outer * 0.22));
  return (
    <View
      style={[
        styles.ring,
        {
          width: outer,
          height: outer,
          borderRadius: radius,
          padding: pad,
        },
      ]}
    >
      <InstitutionLogo branding={branding} size={size} shape={shape} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
