import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { PremiumSplashScreen } from '@/components/auth/premium-splash-screen';
import { SPLASH_DURATION_MS } from '@/constants/release';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(auth)/welcome');
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <>
      <StatusBar style="light" />
      <PremiumSplashScreen />
    </>
  );
}
