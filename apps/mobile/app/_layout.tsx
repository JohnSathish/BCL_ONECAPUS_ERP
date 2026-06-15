import { Stack } from 'expo-router';
import { useAuthFailureRedirect } from '@/hooks/useAuthFailureRedirect';

export default function RootLayout() {
  useAuthFailureRedirect();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(auth)/maintenance" />
      <Stack.Screen name="(student)" />
      <Stack.Screen name="(staff)/index" />
    </Stack>
  );
}
