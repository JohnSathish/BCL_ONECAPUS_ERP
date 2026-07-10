import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { setAuthFailureHandler } from '@/api/client';

export function useAuthFailureRedirect() {
  const router = useRouter();

  useEffect(() => {
    setAuthFailureHandler(() => {
      router.replace('/(auth)/login?reason=session_expired');
    });
    return () => setAuthFailureHandler(() => {});
  }, [router]);
}
