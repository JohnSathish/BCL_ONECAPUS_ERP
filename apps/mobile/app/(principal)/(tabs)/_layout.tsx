import { Tabs } from 'expo-router';
import { PrincipalTabBar } from '@/components/principal-portal/principal-tab-bar';

export default function PrincipalTabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <PrincipalTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="approvals" options={{ title: 'Approvals' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notifications', href: null }} />
    </Tabs>
  );
}
