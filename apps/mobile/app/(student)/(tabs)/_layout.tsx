import { Tabs } from 'expo-router';
import { StudentTabBar } from '@/components/student-portal/student-tab-bar';

export default function StudentTabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <StudentTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="academics" options={{ title: 'My Academics' }} />
      <Tabs.Screen name="fees" options={{ title: 'Fees' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
