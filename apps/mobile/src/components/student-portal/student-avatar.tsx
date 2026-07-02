import { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { resolveUploadAssetUrl } from '@/utils/upload-asset-url';
import { studentTheme } from './theme';

type StudentAvatarProps = {
  name?: string;
  photoUrl?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function StudentAvatar({
  name = 'Student',
  photoUrl,
  size = 52,
  style,
}: StudentAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  const src = !failed ? resolveUploadAssetUrl(photoUrl) : undefined;
  const fontSize = Math.round(size * 0.38);

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      {src ? (
        <Image
          source={{ uri: src }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize }]}>{initials || 'S'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: studentTheme.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#93c5fd',
  },
  initials: { color: '#fff', fontWeight: '700' },
});
