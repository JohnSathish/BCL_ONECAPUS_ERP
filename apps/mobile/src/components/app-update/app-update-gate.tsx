import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type AppStateStatus,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authTheme } from '@/components/auth/auth-theme';
import { getSchoolConfig } from '@/auth/school-config';
import { isSchoolSisConfig } from '@/auth/school-product';
import { onUpdateRequired } from '@/services/app-update-events';
import {
  evaluateUpdate,
  loadAppVersionPolicy,
  shouldPromptOptional,
  snoozeOptional,
  startAppUpdate,
  UPDATE_RECHECK_INTERVAL_MS,
  type UpdateDecision,
} from '@/services/app-update';
import { getInstalledAppVersion } from '@/utils/app-version';
import {
  addPlayInstallStatusListener,
  checkPlayUpdate,
  completePlayUpdate,
  type PlayInstallStatus,
} from '../../../modules/play-in-app-updates';

type ActiveDecision = Exclude<UpdateDecision, { kind: 'none' }>;

const LAUNCH_DELAY_MS = 1200;
const FORCED_RECHECK_MS = 30_000;

function formatReleaseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Global store-update prompt. Checks the backend policy on launch and when the app returns
 * to the foreground (throttled), and forces a re-check when the API answers 426.
 */
export function AppUpdateGate() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = authTheme[scheme];
  const insets = useSafeAreaInsets();

  const [decision, setDecision] = useState<ActiveDecision | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<PlayInstallStatus | null>(null);

  const lastCheckAt = useRef(0);
  const lastForcedAt = useRef(0);
  const checking = useRef(false);
  const promptedThisSession = useRef<string | null>(null);
  const enabled = useRef<boolean | null>(null);

  const isEnabled = useCallback(async () => {
    if (enabled.current == null) {
      try {
        enabled.current = !isSchoolSisConfig(await getSchoolConfig());
      } catch {
        enabled.current = true;
      }
    }
    return enabled.current;
  }, []);

  const runCheck = useCallback(
    async (reason: 'launch' | 'resume' | 'forced') => {
      if (checking.current) return;
      if (reason === 'resume' && Date.now() - lastCheckAt.current < UPDATE_RECHECK_INTERVAL_MS) {
        return;
      }
      checking.current = true;
      try {
        if (!(await isEnabled())) return;
        const payload = await loadAppVersionPolicy();
        lastCheckAt.current = Date.now();
        const next = evaluateUpdate(payload);

        if (next.kind === 'required') {
          setDecision(next);
          setVisible(true);
        } else if (next.kind === 'optional') {
          setDecision(next);
          if (
            promptedThisSession.current !== next.latestVersion &&
            (await shouldPromptOptional(next.latestVersion))
          ) {
            promptedThisSession.current = next.latestVersion;
            setVisible(true);
          }
        } else if (reason !== 'forced') {
          setDecision(null);
          setVisible(false);
        }

        const play = await checkPlayUpdate();
        if (play?.installStatus === 'DOWNLOADED') setInstallStatus('DOWNLOADED');
      } finally {
        checking.current = false;
      }
    },
    [isEnabled],
  );

  useEffect(() => {
    const launchTimer = setTimeout(() => void runCheck('launch'), LAUNCH_DELAY_MS);
    let appState: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.match(/inactive|background/) && next === 'active') {
        void runCheck('resume');
      }
      appState = next;
    });
    const offRequired = onUpdateRequired((signal) => {
      void (async () => {
        if (!(await isEnabled())) return;
        if (Date.now() - lastForcedAt.current > FORCED_RECHECK_MS) {
          lastForcedAt.current = Date.now();
          await runCheck('forced');
        }
        setDecision((current) => {
          if (current?.kind === 'required') return current;
          return {
            kind: 'required',
            currentVersion: getInstalledAppVersion(),
            latestVersion: signal.minVersion ?? current?.latestVersion ?? '',
            minimumVersion: signal.minVersion ?? null,
            storeUrl: signal.storeUrl ?? current?.storeUrl ?? null,
            releaseTitle: current?.releaseTitle ?? null,
            releaseNotes: current?.releaseNotes ?? [],
            releaseDate: current?.releaseDate ?? null,
            message: signal.message ?? null,
          };
        });
        setVisible(true);
      })();
    });
    const playSub = addPlayInstallStatusListener((status) => {
      setInstallStatus(status);
      if (status === 'FAILED') setNotice('The update could not be downloaded. Please try again.');
    });
    return () => {
      clearTimeout(launchTimer);
      sub.remove();
      offRequired();
      playSub?.remove();
    };
  }, [isEnabled, runCheck]);

  const onUpdateNow = useCallback(async () => {
    if (!decision) return;
    setBusy(true);
    setNotice(null);
    try {
      const required = decision.kind === 'required';
      const result = await startAppUpdate({ required, storeUrl: decision.storeUrl });
      if (result === 'failed') {
        setNotice('Could not open the store. Please update OneCampus from the store manually.');
      } else if (!required) {
        setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  }, [decision]);

  const onLater = useCallback(() => {
    if (!decision || decision.kind === 'required') return;
    void snoozeOptional(decision.latestVersion);
    setVisible(false);
  }, [decision]);

  const required = decision?.kind === 'required';
  const showDownloadBanner =
    !visible && (installStatus === 'DOWNLOADING' || installStatus === 'DOWNLOADED');
  const releaseDate = formatReleaseDate(decision?.releaseDate ?? null);

  return (
    <>
      <Modal
        visible={visible && Boolean(decision)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={required ? () => undefined : onLater}
      >
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: palette.surface }]}>
            <LinearGradient
              colors={required ? ['#7f1d1d', '#b91c1c', '#dc2626'] : [...authTheme.gradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <View style={styles.iconBubble}>
                <Text style={styles.iconText}>{required ? '!' : '↑'}</Text>
              </View>
              <Text style={styles.title}>
                {required ? 'Update Required' : 'New Update Available'}
              </Text>
              <Text style={styles.subtitle}>
                {required
                  ? 'This version of OneCampus is no longer supported. Please update to continue.'
                  : 'A new version of OneCampus is available.'}
              </Text>
            </LinearGradient>

            <View style={styles.body}>
              <View style={[styles.versionRow, { borderColor: palette.border }]}>
                <View style={styles.versionCell}>
                  <Text style={[styles.versionLabel, { color: palette.textMuted }]}>Current</Text>
                  <Text style={[styles.versionValue, { color: palette.text }]}>
                    {decision?.currentVersion ?? getInstalledAppVersion()}
                  </Text>
                </View>
                <Text style={[styles.versionArrow, { color: palette.textMuted }]}>→</Text>
                <View style={styles.versionCell}>
                  <Text style={[styles.versionLabel, { color: palette.textMuted }]}>New</Text>
                  <Text
                    style={[
                      styles.versionValue,
                      { color: required ? '#dc2626' : authTheme.primaryLight },
                    ]}
                  >
                    {decision?.latestVersion || '—'}
                  </Text>
                </View>
              </View>

              {decision?.releaseTitle ? (
                <Text style={[styles.releaseTitle, { color: palette.text }]}>
                  {decision.releaseTitle}
                </Text>
              ) : null}
              {releaseDate ? (
                <Text style={[styles.releaseDate, { color: palette.textMuted }]}>
                  Released {releaseDate}
                </Text>
              ) : null}

              {decision?.releaseNotes?.length ? (
                <ScrollView style={styles.notes} contentContainerStyle={styles.notesContent}>
                  {decision.releaseNotes.map((note, index) => (
                    <View key={`${index}-${note}`} style={styles.noteRow}>
                      <View
                        style={[
                          styles.noteDot,
                          { backgroundColor: required ? '#dc2626' : authTheme.primaryLight },
                        ]}
                      />
                      <Text style={[styles.noteText, { color: palette.textMuted }]}>{note}</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : decision?.message ? (
                <Text style={[styles.noteText, { color: palette.textMuted }]}>
                  {decision.message}
                </Text>
              ) : null}

              {notice ? <Text style={styles.notice}>{notice}</Text> : null}

              <Pressable
                onPress={() => void onUpdateNow()}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={required ? ['#b91c1c', '#dc2626'] : ['#1E40AF', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtn}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>Update Now</Text>
                  )}
                </LinearGradient>
              </Pressable>

              {!required ? (
                <Pressable
                  onPress={onLater}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.laterBtn, pressed && styles.pressed]}
                >
                  <Text style={[styles.laterText, { color: palette.textMuted }]}>Later</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {showDownloadBanner ? (
        <View
          pointerEvents="box-none"
          style={[styles.bannerWrap, { bottom: Math.max(insets.bottom, 12) + 64 }]}
        >
          <View style={styles.banner}>
            {installStatus === 'DOWNLOADED' ? (
              <>
                <Text style={styles.bannerText}>Update downloaded</Text>
                <Pressable onPress={() => void completePlayUpdate()} style={styles.bannerBtn}>
                  <Text style={styles.bannerBtnText}>Restart</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.bannerText}>Downloading update…</Text>
              </>
            )}
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  header: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 22, alignItems: 'center' },
  iconBubble: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  title: { color: '#fff', fontSize: 21, fontWeight: '800', textAlign: 'center' },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  body: { padding: 20, gap: 10 },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  versionCell: { flex: 1, alignItems: 'center' },
  versionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  versionValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  versionArrow: { fontSize: 20, fontWeight: '700', paddingHorizontal: 8 },
  releaseTitle: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  releaseDate: { fontSize: 12, marginTop: -6 },
  notes: { maxHeight: 180 },
  notesContent: { gap: 8, paddingVertical: 2 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noteDot: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20 },
  notice: { color: '#dc2626', fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  laterBtn: { alignItems: 'center', paddingVertical: 10 },
  laterText: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  bannerWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  bannerText: { color: '#fff', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  bannerBtn: {
    backgroundColor: authTheme.primaryLight,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  bannerBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
