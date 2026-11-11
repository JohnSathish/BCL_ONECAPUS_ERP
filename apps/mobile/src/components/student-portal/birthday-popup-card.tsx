import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudentAvatar } from '@/components/student-portal/student-avatar';

type Props = {
  visible: boolean;
  name: string;
  photoUrl?: string | null;
  message: string;
  collegeName: string;
  onClose: () => void;
};

const BUNTING = ['#F43F5E', '#FACC15', '#38BDF8', '#22C55E', '#FB923C', '#A855F7'];

export function BirthdayPopupCard({
  visible,
  name,
  photoUrl,
  message,
  collegeName,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const cardWidth = Math.min(width - 36, 380);
  const compact = height < 740;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.backdrop,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={[styles.card, { width: cardWidth }]}>
          <LinearGradient colors={['#F4EEFF', '#FFFFFF', '#FFF7FB']} style={styles.fill}>
            <View style={styles.bunting}>
              {BUNTING.map((color, index) => (
                <View
                  key={color}
                  style={[
                    styles.flag,
                    {
                      backgroundColor: color,
                      transform: [{ rotate: index % 2 ? '8deg' : '-8deg' }],
                    },
                  ]}
                />
              ))}
            </View>
            <View style={[styles.confetti, styles.confettiA]} />
            <View style={[styles.confetti, styles.confettiB]} />
            <View style={[styles.confetti, styles.confettiC]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close birthday card"
              onPress={onClose}
              hitSlop={10}
              style={styles.close}
            >
              <Text style={styles.closeLabel}>×</Text>
            </Pressable>
            <View style={styles.photoWrap}>
              <Text style={styles.crown}>👑</Text>
              <View style={styles.photoRing}>
                <StudentAvatar name={name} photoUrl={photoUrl} size={compact ? 92 : 108} />
              </View>
            </View>
            <Text style={styles.happy}>Happy</Text>
            <Text style={styles.birthday}>Birthday!</Text>
            <Text style={styles.name} numberOfLines={2}>
              {name}
            </Text>
            <Text style={styles.message}>{message}</Text>
            <View style={styles.footerRow}>
              <Text style={styles.gift}>🎁</Text>
              <View style={styles.wish}>
                <Text style={styles.with}>With best wishes,</Text>
                <Text style={styles.college}>{collegeName}</Text>
              </View>
              <Text style={styles.cake}>🎂</Text>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 75, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#4C1D95',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  fill: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
    alignItems: 'center',
  },
  bunting: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  flag: {
    width: 14,
    height: 18,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  confetti: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  confettiA: { top: 54, left: 28, backgroundColor: '#F472B6', transform: [{ rotate: '20deg' }] },
  confettiB: { top: 78, right: 36, backgroundColor: '#38BDF8', transform: [{ rotate: '-18deg' }] },
  confettiC: { top: 120, left: 22, backgroundColor: '#FACC15' },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    fontSize: 26,
    lineHeight: 28,
    color: '#334155',
    marginTop: -2,
  },
  photoWrap: {
    alignItems: 'center',
    marginTop: 4,
  },
  crown: {
    fontSize: 28,
    marginBottom: -8,
    zIndex: 1,
  },
  photoRing: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#FDE68A',
  },
  happy: {
    marginTop: 10,
    fontSize: 28,
    fontStyle: 'italic',
    color: '#3730A3',
    fontWeight: '600',
  },
  birthday: {
    marginTop: -6,
    fontSize: 40,
    fontWeight: '800',
    color: '#DB2777',
  },
  name: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
    textAlign: 'center',
  },
  footerRow: {
    marginTop: 14,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gift: { fontSize: 36 },
  cake: { fontSize: 36 },
  wish: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  with: { fontSize: 13, color: '#475569' },
  college: { marginTop: 2, fontSize: 15, fontWeight: '800', color: '#1E3A8A', textAlign: 'center' },
});
