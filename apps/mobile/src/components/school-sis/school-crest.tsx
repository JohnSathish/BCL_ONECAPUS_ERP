import { Image, StyleSheet, View } from 'react-native';
import { SCHOOL_LOGO } from '@/constants/school-branding';

export function SchoolCrest({ size = 148 }: { size?: number }) {
  const plate = size + 16;
  return (
    <View style={[styles.plate, { width: plate, height: plate, borderRadius: plate / 2 }]}>
      <Image
        source={SCHOOL_LOGO}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="contain"
        accessibilityLabel="St. Luke's Higher Secondary School crest"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b1640',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
