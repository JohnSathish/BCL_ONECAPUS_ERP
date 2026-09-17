import { Alert } from 'react-native';
import { logoutCurrent } from '@/auth/account';
import { clearSession, isBiometricLoginEnabled } from '@/auth/session';

export function confirmLogout(onDone: () => void) {
  void (async () => {
    const biometric = await isBiometricLoginEnabled();
    Alert.alert(
      'Log out of your account?',
      biometric
        ? 'You will need to sign in again to access this account. Biometric login will be turned off on this device until you enable it after the next sign-in.'
        : 'You will need to sign in again to access this account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            void logoutCurrent()
              .catch(() => undefined)
              .then(() => clearSession())
              .then(onDone);
          },
        },
      ],
    );
  })();
}
