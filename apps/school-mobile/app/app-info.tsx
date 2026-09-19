import { Linking, StyleSheet, Text, View } from 'react-native';
import { APP_VERSION } from '@/api/config';
import { Screen } from '@/ui/kit';
import { colors, space } from '@/theme/tokens';

export default function AppInfoScreen() {
  return (
    <Screen title="App Information" onBack light>
      <View style={styles.box}>
        <Text style={styles.name}>St. Luke's School</Text>
        <Text style={styles.meta}>Version {APP_VERSION}</Text>
        <Text style={styles.meta}>St. Luke's Secondary School, Tura</Text>
        <Text
          style={styles.link}
          onPress={() => void Linking.openURL('https://stlukestura.in/privacy-policy')}
        >
          Privacy policy
        </Text>
        <Text style={styles.foot}>Knowledge · Service · Light</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: 8 },
  name: { fontSize: 22, fontWeight: '800', color: colors.navy },
  meta: { color: colors.muted },
  link: { color: colors.navy, fontWeight: '800', marginTop: 8 },
  foot: { marginTop: 24, color: colors.navy, fontWeight: '700' },
});
