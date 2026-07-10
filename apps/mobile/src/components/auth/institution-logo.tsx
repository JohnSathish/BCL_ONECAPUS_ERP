import { useMemo, useState } from 'react';
import { Image, type ImageStyle, StyleSheet, View, type StyleProp } from 'react-native';
import { useSchoolConfig } from '@/hooks/use-school-config';
import { resolveCollegeLogoUri } from '@/utils/upload-asset-url';

const DEFAULT_LOGO = require('../../../assets/college-logo-default.png');

type Props = {
  branding?: { logoUrl?: string | null };
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function InstitutionLogo({ branding, size = 46, style }: Props) {
  const { school } = useSchoolConfig();
  const remoteUri = useMemo(
    () => resolveCollegeLogoUri(branding, [school?.logoUrl]),
    [branding, school?.logoUrl],
  );
  const [useBundled, setUseBundled] = useState(!remoteUri);

  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (useBundled || !remoteUri) {
    return <Image source={DEFAULT_LOGO} style={[dimension, style]} resizeMode="contain" />;
  }

  return (
    <Image
      source={{ uri: remoteUri }}
      defaultSource={DEFAULT_LOGO}
      style={[dimension, style]}
      resizeMode="contain"
      onError={() => setUseBundled(true)}
    />
  );
}

export function InstitutionLogoRing({
  branding,
  size = 46,
}: {
  branding?: { logoUrl?: string | null };
  size?: number;
}) {
  return (
    <View
      style={[styles.ring, { width: size + 10, height: size + 10, borderRadius: (size + 10) / 2 }]}
    >
      <InstitutionLogo branding={branding} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});
