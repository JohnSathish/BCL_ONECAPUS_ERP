import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { NavyButton, Screen } from '@/ui/kit';
import { colors, space } from '@/theme/tokens';

export default function AuthSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ purpose?: string; admission?: string }>();
  const reset = params.purpose === 'RESET';

  return (
    <Screen title={reset ? 'Password Updated' : 'Account Activated Successfully'} light>
      <View style={styles.box}>
        <Text style={styles.lead}>
          {reset
            ? 'Your password has been updated. Sign in with your admission or roll number and new password.'
            : 'Your account is now ready.'}
        </Text>
        {params.admission ? (
          <Text style={styles.admit}>Admission No. {params.admission}</Text>
        ) : null}
        <NavyButton label="Continue to Sign In" onPress={() => router.replace('/login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: 16 },
  lead: { color: colors.muted, lineHeight: 22, fontSize: 16 },
  admit: { fontWeight: '800', color: colors.navy, fontSize: 16 },
});
