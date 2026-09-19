import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUser } from '@/auth/session';
import { appMode, type AppMode } from '@/persona';
import { colors } from '@/theme/tokens';

export const unstable_settings = {
  initialRouteName: 'index',
};

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>;
}

function ReportsIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.fab, focused && styles.fabOn]}>
      <Text style={{ fontSize: 18 }}>📊</Text>
    </View>
  );
}

export default function TabsLayout() {
  const [mode, setMode] = useState<AppMode>('student');
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      void getUser().then((user) => setMode(appMode(user)));
    }, []),
  );

  const office = mode === 'office';
  const staff = mode === 'staff';
  const bottom = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#edf0f7',
          height: (office ? 64 : 56) + bottom,
          paddingBottom: bottom,
          paddingTop: office ? 10 : 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: staff ? 'Dashboard' : 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="attendance-tab"
        options={{
          title: 'Attendance',
          href: staff ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon emoji="✅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Classes',
          href: staff ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon emoji="📚" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          href: staff ? null : undefined,
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          href: office ? undefined : null,
          tabBarIcon: ({ focused }) => <ReportsIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: office || staff ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: 'Gallery',
          href: office || staff ? null : undefined,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🖼️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Menu',
          href: office || staff ? null : undefined,
          tabBarIcon: ({ focused }) => <TabIcon emoji="☰" focused={focused} />,
        }}
      />
      <Tabs.Screen name="notices" options={{ href: null, title: 'Notices' }} />
      <Tabs.Screen name="events" options={{ href: null, title: 'Events' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  fabOn: { backgroundColor: '#12185c' },
});
