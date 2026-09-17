import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { clearSession } from '@/auth/session';
import { NavyButton, Screen } from '@/ui/kit';
import { colors, space } from '@/theme/tokens';

export default function SessionEndedScreen() {
  const router = useRouter();
  return (
    <Screen title="Session Ended" light>
      <View style={styles.box}>
        <Text style={styles.lead}>
          Your access to this device has been revoked by the school administrator. Please sign in
          again or contact the school office if you believe this is a mistake.
        </Text>
        <NavyButton
          label="Sign In"
          onPress={() => {
            void clearSession().then(() => router.replace('/login'));
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: 16, paddingTop: 36 },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 22 },
});
