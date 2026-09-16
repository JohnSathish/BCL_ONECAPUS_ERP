import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { schoolUi } from '@/theme/school-ui';
import { tabsForPersona } from '@/features/school/permissions';
import { useSchoolSession } from '@/store/school-session';

export function SchoolTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const persona = useSchoolSession((s) => s.persona);
  const features = useSchoolSession((s) => s.features);
  const allowed = new Set(tabsForPersona(persona, features).map((t) => t.name));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        if (!allowed.has(route.name)) return null;
        const focused = state.index === index;
        const meta = tabsForPersona(persona, features).find((t) => t.name === route.name);
        const { options } = descriptors[route.key];
        const label = options.title ?? meta?.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityLabel={label}
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
            <Text style={[styles.icon, focused && styles.iconActive]}>{meta?.icon ?? '•'}</Text>
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
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: schoolUi.colors.border,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  icon: { fontSize: 18 },
  iconActive: { transform: [{ scale: 1.08 }] },
  label: { fontSize: 11, color: schoolUi.colors.muted, marginTop: 2, fontWeight: '600' },
  labelActive: { color: schoolUi.colors.primary },
});
