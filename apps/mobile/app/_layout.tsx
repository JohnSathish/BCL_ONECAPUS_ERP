import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthFailureRedirect } from '@/hooks/useAuthFailureRedirect';

export default function RootLayout() {
  useAuthFailureRedirect();

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="(staff)" />
      </Stack>
    </SafeAreaProvider>
  );
}
