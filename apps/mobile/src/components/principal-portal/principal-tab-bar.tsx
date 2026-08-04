import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { principalTheme } from './theme';

const TAB_META: Record<string, { label: string; icon: string }> = {
  index: { label: 'Home', icon: '🏠' },
  inbox: { label: 'Inbox', icon: '✉️' },
  approvals: { label: 'Approvals', icon: '✅' },
  profile: { label: 'Profile', icon: '👤' },
};

export function PrincipalTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes
        .filter((route) => Boolean(TAB_META[route.name]))
        .map((route) => {
          const index = state.routes.findIndex((r) => r.key === route.key);
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
    backgroundColor: principalTheme.surface,
    borderTopWidth: 1,
    borderTopColor: principalTheme.border,
    paddingTop: 8,
    paddingHorizontal: 4,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  icon: { fontSize: 18, opacity: 0.5 },
  iconActive: { opacity: 1 },
  label: { fontSize: 10, color: principalTheme.textMuted, fontWeight: '500' },
  labelActive: { color: principalTheme.primaryAccent, fontWeight: '700' },
});
