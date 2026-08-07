import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Action = {
  label: string;
  onPress: () => void;
  primary?: boolean;
};

type Props = {
  visible: boolean;
  title: string;
  body: string;
  primaryColor?: string;
  actions?: Action[];
  onClose: () => void;
};

export function NotificationMessageModal({
  visible,
  title,
  body,
  primaryColor = '#1D4ED8',
  actions,
  onClose,
}: Props) {
  const resolvedActions: Action[] =
    actions && actions.length > 0 ? actions : [{ label: 'OK', onPress: onClose, primary: true }];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.hero}>
            <View style={[styles.heroGlow, { backgroundColor: `${primaryColor}14` }]} />
            <View style={styles.bellWrap}>
              <Ionicons name="notifications" size={52} color="#60A5FA" />
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            </View>
            <View style={[styles.spark, styles.sparkLeft]} />
            <View style={[styles.spark, styles.sparkRight]} />
            <View style={[styles.spark, styles.sparkTop]} />
          </View>

          <Text style={[styles.title, { color: primaryColor }]}>{title || 'Notification'}</Text>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: `${primaryColor}55` }]} />
            <View style={[styles.dividerDiamond, { backgroundColor: primaryColor }]} />
            <View style={[styles.dividerLine, { backgroundColor: `${primaryColor}55` }]} />
          </View>

          <View style={styles.bodyRow}>
            <View style={[styles.infoRail, { backgroundColor: `${primaryColor}18` }]}>
              <View style={[styles.infoIcon, { backgroundColor: primaryColor }]}>
                <Text style={styles.infoGlyph}>i</Text>
              </View>
            </View>
            <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.bodyText}>{body.trim() || 'No additional details.'}</Text>
            </ScrollView>
          </View>

          <View style={styles.footerRule} />

          <View style={styles.actions}>
            {resolvedActions.length === 1 ? (
              <View style={styles.okRow}>
                <Ionicons name="leaf-outline" size={18} color={primaryColor} style={styles.leaf} />
                <Pressable
                  onPress={() => {
                    resolvedActions[0].onPress();
                    onClose();
                  }}
                  style={[styles.okBtn, { backgroundColor: primaryColor }]}
                >
                  <Text style={styles.okBtnText}>{resolvedActions[0].label}</Text>
                </Pressable>
                <Ionicons
                  name="leaf-outline"
                  size={18}
                  color={primaryColor}
                  style={[styles.leaf, styles.leafFlip]}
                />
              </View>
            ) : (
              resolvedActions.map((action, index) => {
                const isPrimary = action.primary ?? index === resolvedActions.length - 1;
                return (
                  <Pressable
                    key={`${action.label}-${index}`}
                    onPress={() => {
                      action.onPress();
                      onClose();
                    }}
                    style={[
                      styles.secondaryBtn,
                      isPrimary
                        ? { backgroundColor: primaryColor }
                        : { borderColor: `${primaryColor}55`, borderWidth: 1 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.secondaryBtnText,
                        { color: isPrimary ? '#fff' : primaryColor },
                      ]}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    maxHeight: '82%',
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 96,
    marginBottom: 8,
  },
  heroGlow: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  bellWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    right: -6,
    top: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  spark: {
    position: 'absolute',
    width: 10,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#93C5FD',
  },
  sparkLeft: { left: 28, top: 42, transform: [{ rotate: '-28deg' }] },
  sparkRight: { right: 28, top: 40, transform: [{ rotate: '28deg' }] },
  sparkTop: { top: 18, width: 8, transform: [{ rotate: '90deg' }] },
  title: {
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
    paddingHorizontal: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerDiamond: {
    width: 8,
    height: 8,
    transform: [{ rotate: '45deg' }],
  },
  bodyRow: {
    flexDirection: 'row',
    gap: 10,
    minHeight: 80,
    maxHeight: 260,
  },
  infoRail: {
    width: 36,
    borderRadius: 12,
    alignItems: 'center',
    paddingTop: 10,
  },
  infoIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoGlyph: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 15,
  },
  bodyScroll: { flex: 1 },
  bodyText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 21,
  },
  footerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginTop: 16,
    marginBottom: 14,
  },
  actions: { gap: 8 },
  okRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  leaf: { opacity: 0.85 },
  leafFlip: { transform: [{ scaleX: -1 }] },
  okBtn: {
    minWidth: 140,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  okBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryBtn: {
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
