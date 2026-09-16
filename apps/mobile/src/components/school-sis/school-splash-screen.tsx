import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SchoolCrest } from '@/components/school-sis/school-crest';
import { SCHOOL_BRAND } from '@/constants/school-branding';

export function SchoolSplashScreen() {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={[SCHOOL_BRAND.navyDeep, SCHOOL_BRAND.navyMid, '#163a7a']}
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.center}>
        <SchoolCrest size={180} />
        <Text style={styles.name}>{SCHOOL_BRAND.legalName}</Text>
        <Text style={styles.motto}>{SCHOOL_BRAND.motto}</Text>
        <Text style={styles.address}>{SCHOOL_BRAND.addressLine}</Text>
        <Text style={styles.city}>{SCHOOL_BRAND.cityLine}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  name: {
    marginTop: 22,
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 28,
  },
  motto: { marginTop: 10, color: SCHOOL_BRAND.gold, fontWeight: '700', fontSize: 14 },
  address: { marginTop: 14, color: '#e8eefc', fontWeight: '700', fontSize: 16 },
  city: { marginTop: 4, color: '#b7c4e6', fontSize: 14 },
});
