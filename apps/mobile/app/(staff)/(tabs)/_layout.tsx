import { Tabs } from 'expo-router';
import { FacultyTabBar } from '@/components/faculty-portal/faculty-tab-bar';

export default function FacultyTabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <FacultyTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="academics" options={{ title: 'Academics' }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance' }} />
      <Tabs.Screen name="students" options={{ title: 'Students' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      {/* Hidden from tab bar; kept inside Tabs so bottom nav stays visible */}
      <Tabs.Screen name="notifications" options={{ title: 'Notifications', href: null }} />
    </Tabs>
  );
}
