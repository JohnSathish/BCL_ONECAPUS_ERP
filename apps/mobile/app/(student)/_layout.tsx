import { Stack } from 'expo-router';
import { StudentDrawer } from '@/components/student-portal/student-drawer';
import { StudentPortalProvider } from '@/components/student-portal/student-portal-context';

export default function StudentLayout() {
  return (
    <StudentPortalProvider>
      <StudentDrawer />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="timetable" />
        <Stack.Screen name="exam-schedule" />
        <Stack.Screen name="results" />
        <Stack.Screen name="leave" />
        <Stack.Screen name="library" />
        <Stack.Screen name="assignments" />
      </Stack>
    </StudentPortalProvider>
  );
}
