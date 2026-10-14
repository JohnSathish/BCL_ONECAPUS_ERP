import { Image, StyleSheet, View } from 'react-native';
import { SCHOOL_LOGO } from '@/constants/school-branding';

export function SchoolCrest({ size = 148, framed = true }: { size?: number; framed?: boolean }) {
  const plate = framed ? size + 20 : size;
  return (
    <View
      style={[
        framed ? styles.plate : undefined,
        { width: plate, height: plate, borderRadius: plate / 2 },
      ]}
    >
      <Image
        source={SCHOOL_LOGO}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="St. Luke's Higher Secondary School crest"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    backgroundColor: '#0b1640',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(245,197,24,0.55)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
