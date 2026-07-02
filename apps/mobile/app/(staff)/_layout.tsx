import { Stack } from 'expo-router';
import { FacultyDrawer } from '@/components/faculty-portal/faculty-drawer';
import { FacultyPortalProvider } from '@/components/faculty-portal/faculty-portal-context';

export default function StaffLayout() {
  return (
    <FacultyPortalProvider>
      <FacultyDrawer />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="mark-attendance/[sessionId]" />
        <Stack.Screen name="timetable" />
        <Stack.Screen name="marks/index" />
        <Stack.Screen name="marks/[paperId]" />
        <Stack.Screen name="class-roster/[sectionId]" />
        <Stack.Screen name="leave" />
      </Stack>
    </FacultyPortalProvider>
  );
}
