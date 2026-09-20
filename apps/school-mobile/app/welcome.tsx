import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { getUser, saveUser } from '@/auth/session';
import { markPasswordLogin } from '@/auth/password-gate';
import { HOME_PATH } from '@/services/notification-path';
import { NavyButton, Screen } from '@/ui/kit';
import { colors, space } from '@/theme/tokens';

export default function WelcomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('Student');

  useEffect(() => {
    void getUser().then((user) => {
      if (user?.mustResetPassword) {
        router.replace('/password');
        return;
      }
      const display = user?.displayName?.trim().split(/\s+/)[0];
      if (display) setName(display);
    });
  }, [router]);

  const continueNext = async () => {
    const user = await getUser();
    if (user?.mustResetPassword) {
      router.replace('/password');
      return;
    }
    if (user) await saveUser({ ...user, firstLogin: false });
    markPasswordLogin();
    router.replace(HOME_PATH);
  };

  return (
    <Screen title="Welcome" light insetBottom>
      <View style={styles.box}>
        <Text style={styles.hello}>Welcome, {name}!</Text>
        <Text style={styles.lead}>Your account has been successfully activated.</Text>
        <NavyButton label="Continue to Dashboard" onPress={() => void continueNext()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: 16, paddingTop: 48 },
  hello: { fontSize: 28, fontWeight: '800', color: colors.navy },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 22 },
});
