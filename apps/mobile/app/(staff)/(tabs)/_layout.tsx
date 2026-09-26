import { Tabs } from 'expo-router';
import { FacultyTabBar } from '@/components/faculty-portal/faculty-tab-bar';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { isTeachingStaffProfile } from '@/components/faculty-portal/drawer-menu';

export default function FacultyTabsLayout() {
  const { home } = useFacultyPortal();
  const teaching = isTeachingStaffProfile(home?.profile?.isTeaching);

  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <FacultyTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen
        name="academics"
        options={{ title: 'Academics', href: teaching ? undefined : null }}
      />
      <Tabs.Screen
        name="attendance"
        options={{ title: 'Attendance', href: teaching ? undefined : null }}
      />
      <Tabs.Screen
        name="students"
        options={{ title: 'Students', href: teaching ? undefined : null }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          // Teaching faculty keep Alerts in the drawer / quick actions only.
          href: teaching ? null : undefined,
        }}
      />
    </Tabs>
  );
}
