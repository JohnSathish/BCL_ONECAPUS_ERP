import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PRINCIPAL_MOBILE_NAV,
  isPrincipalMobileNavActive,
  type PrincipalMobileNavBadgeKey,
  type PrincipalMobileNavGroup,
} from '@/config/principal-nav';
import { COLLEGE_NAME } from '@/constants/release';
import { principalTheme } from './theme';
import { usePrincipalDrawer } from './principal-drawer-context';

const PHONE_DRAWER_RATIO = 0.82;
const TABLET_BREAKPOINT = 768;
const TABLET_DRAWER_WIDTH = 320;

type Badges = Partial<Record<PrincipalMobileNavBadgeKey, number>>;

type Props = {
  badges?: Badges;
  /** When true, show campus optional modules (transport/hostel). */
  showOptionalCampus?: boolean;
};

function initialExpanded() {
  const map: Record<string, boolean> = {};
  for (const g of PRINCIPAL_MOBILE_NAV) {
    map[g.id] = g.defaultExpanded !== false;
  }
  return map;
}

export function PrincipalDrawer({ badges = {}, showOptionalCampus = true }: Props) {
  const { open, closeDrawer } = usePrincipalDrawer();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const isTablet = windowW >= TABLET_BREAKPOINT;
  const drawerWidth = isTablet ? TABLET_DRAWER_WIDTH : Math.min(windowW * PHONE_DRAWER_RATIO, 360);

  const slide = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(initialExpanded);
  const displayName = 'Principal';

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const group of PRINCIPAL_MOBILE_NAV) {
        if (group.items.some((item) => isPrincipalMobileNavActive(pathname, item))) {
          next[group.id] = true;
        }
      }
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open, slide]);

  const groups = useMemo(() => {
    return PRINCIPAL_MOBILE_NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) => showOptionalCampus || !item.optional),
    })).filter((g) => g.items.length > 0);
  }, [showOptionalCampus]);

  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  });
  const backdropOpacity = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  const go = (href: string) => {
    closeDrawer();
    // Let close animation start before navigate
    requestAnimationFrame(() => {
      router.push(href as Href);
    });
  };

  const toggleGroup = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={closeDrawer}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              paddingTop: insets.top,
              paddingBottom: insets.bottom + 8,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons name="shield-checkmark" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandEyebrow}>Principal Desk</Text>
              <Text style={styles.brandTitle} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.brandSub} numberOfLines={1}>
                {COLLEGE_NAME}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={closeDrawer}
              style={styles.closeBtn}
              accessibilityLabel="Close menu"
            >
              <Ionicons name="close" size={22} color={principalTheme.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {groups.map((group) => (
              <NavGroupBlock
                key={group.id}
                group={group}
                expanded={expanded[group.id] !== false}
                pathname={pathname}
                badges={badges}
                onToggle={() => toggleGroup(group.id)}
                onNavigate={go}
              />
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerHint}>
              {isTablet
                ? 'Tablet layout · swipe or tap outside to close'
                : 'Material navigation · tap outside to close'}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function NavGroupBlock({
  group,
  expanded,
  pathname,
  badges,
  onToggle,
  onNavigate,
}: {
  group: PrincipalMobileNavGroup;
  expanded: boolean;
  pathname: string | null;
  badges: Badges;
  onToggle: () => void;
  onNavigate: (href: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.groupHeader, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={principalTheme.textSubtle}
        />
      </Pressable>
      {expanded
        ? group.items.map((item) => {
            const active = isPrincipalMobileNavActive(pathname, item);
            const count = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0;
            return (
              <Pressable
                key={item.id}
                onPress={() => onNavigate(item.href)}
                style={({ pressed }) => [
                  styles.item,
                  active && styles.itemActive,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={active ? principalTheme.primaryAccent : principalTheme.textMuted}
                  />
                </View>
                <Text
                  style={[styles.itemLabel, active && styles.itemLabelActive]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
                {count > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
  },
  drawer: {
    maxWidth: Dimensions.get('window').width,
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    elevation: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 4, height: 0 },
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: principalTheme.border,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: principalTheme.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: principalTheme.primaryAccent,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: principalTheme.text,
  },
  brandSub: {
    fontSize: 11,
    color: principalTheme.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: principalTheme.background,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 8, paddingBottom: 24 },
  group: { marginTop: 4, marginBottom: 4 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: principalTheme.textSubtle,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  itemActive: {
    backgroundColor: principalTheme.primarySoft,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: principalTheme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#fff',
  },
  itemLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: principalTheme.text,
  },
  itemLabelActive: {
    color: principalTheme.primaryAccent,
    fontWeight: '700',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: principalTheme.urgent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  pressed: { opacity: 0.85 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: principalTheme.border,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  footerHint: {
    fontSize: 11,
    color: principalTheme.textSubtle,
  },
});
