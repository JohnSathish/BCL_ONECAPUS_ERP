import { Stack } from 'expo-router';

export default function StudentLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="fees" options={{ title: 'Fees', headerBackTitle: 'Home' }} />
      <Stack.Screen name="attendance" options={{ title: 'Attendance', headerBackTitle: 'Home' }} />
      <Stack.Screen
        name="notifications"
        options={{ title: 'Notifications', headerBackTitle: 'Home' }}
      />
    </Stack>
  );
}
