import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        detachInactiveScreens: true,
      }}
    >
      <Stack.Screen name="splash" />
      <Stack.Screen name="select-school" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="guest" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="maintenance" />
    </Stack>
  );
}
