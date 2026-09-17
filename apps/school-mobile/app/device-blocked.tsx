import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { clearSession } from '@/auth/session';
import { NavyButton, Screen } from '@/ui/kit';
import { colors, space } from '@/theme/tokens';

export default function DeviceBlockedScreen() {
  const router = useRouter();
  return (
    <Screen title="Device blocked by Administrator" light>
      <View style={styles.box}>
        <Text style={styles.lead}>
          This device cannot sign in until the school office unblocks it. Contact the office if you
          need access restored.
        </Text>
        <NavyButton
          label="Back to Sign In"
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
