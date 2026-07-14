import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="splash" />
      <Stack.Screen name="select-school" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="qr-login" />
      <Stack.Screen name="rfid-login" />
      <Stack.Screen name="guest" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen
        name="change-password"
        options={{ gestureEnabled: false, headerBackVisible: false }}
      />
      <Stack.Screen name="maintenance" />
    </Stack>
  );
}
