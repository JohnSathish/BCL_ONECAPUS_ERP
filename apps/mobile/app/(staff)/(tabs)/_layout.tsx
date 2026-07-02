import { Tabs } from 'expo-router';
import { FacultyTabBar } from '@/components/faculty-portal/faculty-tab-bar';

export default function FacultyTabsLayout() {
  return (
    <Tabs tabBar={(props) => <FacultyTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="academics" options={{ title: 'Academics' }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance' }} />
      <Tabs.Screen name="students" options={{ title: 'Students' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
