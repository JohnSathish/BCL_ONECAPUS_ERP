import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { facultyTheme } from './theme';

const TAB_META: Record<string, { label: string; icon: string }> = {
  index: { label: 'Home', icon: '🏠' },
  academics: { label: 'Academics', icon: '📚' },
  attendance: { label: 'Attendance', icon: '✅' },
  students: { label: 'Students', icon: '👨‍🎓' },
  profile: { label: 'Profile', icon: '👤' },
};

export function FacultyTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta = TAB_META[route.name] ?? { label: route.name, icon: '•' };
        const { options } = descriptors[route.key];
        const label = options.title ?? meta.label;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            style={styles.tab}
          >
            <Text style={[styles.icon, focused && styles.iconActive]}>{meta.icon}</Text>
            <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: facultyTheme.surface,
    borderTopWidth: 1,
    borderTopColor: facultyTheme.border,
    paddingTop: 8,
    paddingHorizontal: 4,
    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  icon: { fontSize: 18, opacity: 0.55 },
  iconActive: { opacity: 1 },
  label: { fontSize: 10, color: facultyTheme.textMuted, fontWeight: '500' },
  labelActive: { color: facultyTheme.primaryLight, fontWeight: '700' },
});
