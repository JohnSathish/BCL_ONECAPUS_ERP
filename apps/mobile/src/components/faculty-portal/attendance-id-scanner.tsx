import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { facultyTheme } from '@/components/faculty-portal/theme';

const SCAN_COOLDOWN_MS = 1500;

const BARCODE_TYPES = ['qr', 'code128', 'code39', 'code93', 'codabar', 'ean13', 'ean8'] as const;

export type AttendanceScanFeedback = {
  kind: 'hit' | 'miss';
  message: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Return feedback for banner; called for each accepted scan after cooldown. */
  onScan: (raw: string) => AttendanceScanFeedback;
};

export function AttendanceIdScanner({ visible, onClose, onScan }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [feedback, setFeedback] = useState<AttendanceScanFeedback | null>(null);
  const lockedUntil = useRef(0);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  useEffect(() => {
    if (!visible) {
      setFeedback(null);
      lockedUntil.current = 0;
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    }
  }, [visible]);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );

  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      const now = Date.now();
      if (now < lockedUntil.current) return;
      lockedUntil.current = now + SCAN_COOLDOWN_MS;

      const result = onScan(data);
      setFeedback(result);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setFeedback(null), 2200);
    },
    [onScan],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Scan student ID</Text>
          <Text style={styles.subtitle}>
            Point at the QR or barcode on the ID card. Keep scanning for the next student.
          </Text>
        </View>

        <View style={styles.cameraWrap}>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              onBarcodeScanned={handleBarcode}
            />
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionText}>
                Camera permission is required to scan student ID cards.
              </Text>
              <Pressable style={styles.allowBtn} onPress={() => void requestPermission()}>
                <Text style={styles.allowBtnText}>Allow camera</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.scanFrame} pointerEvents="none" />
        </View>

        {feedback ? (
          <View
            style={[
              styles.banner,
              feedback.kind === 'hit' ? styles.bannerHit : styles.bannerMiss,
              { marginBottom: insets.bottom + 16 },
            ]}
          >
            <Text style={styles.bannerText}>{feedback.message}</Text>
          </View>
        ) : (
          <Text style={[styles.hint, { marginBottom: insets.bottom + 16 }]}>
            Matched students are marked Present. Tap Submit on the attendance screen when done.
          </Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 6,
  },
  close: {
    color: '#93C5FD',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 20,
  },
  cameraWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#020617',
  },
  scanFrame: {
    position: 'absolute',
    top: '22%',
    left: '12%',
    right: '12%',
    bottom: '22%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
    borderRadius: 12,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  permissionText: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  allowBtn: {
    backgroundColor: facultyTheme.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  allowBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  banner: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bannerHit: { backgroundColor: '#166534' },
  bannerMiss: { backgroundColor: '#991B1B' },
  bannerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  hint: {
    marginHorizontal: 20,
    marginTop: 14,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
