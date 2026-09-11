import { Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GoldButton, Screen } from '@/ui/kit';
import { colors, space } from '@/theme/tokens';

export default function UpdateScreen() {
  const params = useLocalSearchParams<{ notes?: string; store?: string; maintenance?: string }>();
  const maintenance = params.maintenance === '1';
  return (
    <Screen>
      <View style={styles.box}>
        <Text style={styles.title}>
          {maintenance ? 'We’ll be right back' : 'A new version is available'}
        </Text>
        <Text style={styles.body}>
          {maintenance
            ? 'The St. Luke’s School app is in maintenance. Please try again shortly.'
            : params.notes || 'Please update to continue using St. Luke’s School.'}
        </Text>
        {params.store ? (
          <GoldButton
            label="Update now"
            onPress={() => void Linking.openURL(String(params.store))}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.navy },
  body: { color: colors.muted, lineHeight: 22 },
});
