import { Redirect, usePathname } from 'expo-router';
import { HOME_PATH } from '@/services/notification-path';

export default function NotFound() {
  const path = usePathname();
  if (path.includes('(tabs)')) {
    return <Redirect href={HOME_PATH} />;
  }
  return <Redirect href="/" />;
}
