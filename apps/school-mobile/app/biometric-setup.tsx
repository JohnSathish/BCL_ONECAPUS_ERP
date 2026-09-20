import { Redirect } from 'expo-router';
import { HOME_PATH } from '@/services/notification-path';

export default function BiometricSetupScreen() {
  return <Redirect href={HOME_PATH} />;
}
