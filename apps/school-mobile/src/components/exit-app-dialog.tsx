import { useEffect, useState } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Listener = (open: boolean) => void;

let visible = false;
let listener: Listener | null = null;

function publish(next: boolean) {
  visible = next;
  listener?.(next);
}

export function requestAppExitConfirm() {
  if (visible) return;
  publish(true);
}

export function isAppExitConfirmOpen() {
  return visible;
}

export function dismissAppExitConfirm() {
  if (!visible) return;
  publish(false);
}

function DoorExitIcon() {
  return (
    <View style={styles.iconCircle}>
      <View style={styles.iconRow}>
        <View style={styles.door}>
          <View style={styles.doorPanel} />
          <View style={styles.knob} />
        </View>
        <View style={styles.arrow}>
          <View style={styles.arrowStem} />
          <View style={styles.arrowHead} />
        </View>
      </View>
    </View>
  );
}

export function ExitAppDialog() {
  const [open, setOpen] = useState(visible);

  useEffect(() => {
    listener = (next) => setOpen(next);
    return () => {
      listener = null;
    };
  }, []);

  const stay = () => publish(false);
  const exit = () => {
    publish(false);
    BackHandler.exitApp();
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={stay}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={stay} />
        <View style={styles.card}>
          <DoorExitIcon />
          <Text style={styles.title}>Exit St. Luke's App?</Text>
          <Text style={styles.body}>
            Are you sure you want to close the app?{'\n'}You can come back anytime.
          </Text>
          <View style={styles.actions}>
            <Pressable onPress={stay} style={styles.stay}>
              <Text style={styles.stayText}>Stay in App</Text>
            </Pressable>
            <Pressable onPress={exit} style={styles.exit}>
              <Text style={styles.exitIcon}>⎋</Text>
              <Text style={styles.exitText}>Exit App</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const BLUE = '#2563eb';
const RED = '#ef4444';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  door: {
    width: 22,
    height: 30,
    borderRadius: 3,
    backgroundColor: RED,
    justifyContent: 'center',
  },
  doorPanel: {
    position: 'absolute',
    left: 3,
    top: 4,
    right: 8,
    bottom: 4,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  knob: {
    position: 'absolute',
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  arrow: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowStem: {
    width: 12,
    height: 3,
    backgroundColor: RED,
    borderRadius: 2,
  },
  arrowHead: {
    position: 'absolute',
    right: -1,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: RED,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  stay: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: BLUE,
    backgroundColor: '#fff',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stayText: {
    color: BLUE,
    fontWeight: '800',
    fontSize: 14,
  },
  exit: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: RED,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  exitIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  exitText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
