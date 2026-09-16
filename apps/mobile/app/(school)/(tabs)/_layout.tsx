import { Tabs } from 'expo-router';
import { SchoolTabBar } from '@/components/school-sis/school-tab-bar';
import { tabsForPersona } from '@/features/school/permissions';
import { useSchoolSession } from '@/store/school-session';

export default function SchoolTabsLayout() {
  const persona = useSchoolSession((s) => s.persona);
  const features = useSchoolSession((s) => s.features);
  const allowed = new Set(tabsForPersona(persona, features).map((t) => t.name));

  return (
    <Tabs tabBar={(props) => <SchoolTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen
        name="academics"
        options={{ title: 'Academics', href: allowed.has('academics') ? undefined : null }}
      />
      <Tabs.Screen
        name="fees"
        options={{ title: 'Fees', href: allowed.has('fees') ? undefined : null }}
      />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
