import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  fetchMyDevices,
  fetchSessions,
  logoutAllDevices,
  revokeOtherSessions,
  revokeSession,
  signOutMyDevice,
  signOutOtherDevices,
} from '@/auth/account';
import { biometricCapability, disableBiometricLogin, enableBiometricLogin } from '@/auth/biometric';
import { confirmLogout } from '@/auth/logout';
import { isAppLockEnabled, isBiometricLoginEnabled, setAppLockEnabled } from '@/auth/session';
import { Card, Loader, Screen } from '@/ui/kit';
import { colors, space } from '@/theme/tokens';

type SessionRow = {
  id: string;
  current: boolean;
  lastActive: string;
  device: string;
};

type DeviceRow = {
  id: string;
  thisDevice?: boolean;
  deviceModel?: string | null;
  deviceLabel?: string | null;
  platform?: string;
  osVersion?: string | null;
  lastActiveAt?: string;
  deviceStatus?: string;
};

export default function SecurityScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [biometric, setBiometric] = useState(false);
  const [appLock, setAppLock] = useState(false);
  const [canBiometric, setCanBiometric] = useState(false);
  const [bioLabel, setBioLabel] = useState('fingerprint or Face ID');

  const load = useCallback(() => {
    void fetchSessions()
      .then(setRows)
      .catch(() => setRows([]));
    void fetchMyDevices()
      .then((list) => setDevices(Array.isArray(list) ? list : []))
      .catch(() => setDevices([]));
    void isBiometricLoginEnabled().then(setBiometric);
    void isAppLockEnabled().then(setAppLock);
    void biometricCapability().then((cap) => {
      setCanBiometric(cap.available);
      setBioLabel(cap.label.replace('Unlock with ', ''));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!rows) {
    return (
      <Screen title="Security" onBack>
        <Loader />
      </Screen>
    );
  }

  return (
    <Screen title="Security" onBack>
      <View style={styles.box}>
        <Card>
          <Text style={styles.rowTitle}>Biometric Login</Text>
          <Text style={styles.rowHint}>
            Use {bioLabel} for faster access. Your password is never stored.
          </Text>
          <Switch
            value={biometric}
            disabled={!canBiometric}
            onValueChange={(on) => {
              void (async () => {
                try {
                  if (on) await enableBiometricLogin();
                  else await disableBiometricLogin();
                  setBiometric(on);
                  if (!on) setAppLock(false);
                } catch (err) {
                  Alert.alert(
                    'Biometric login',
                    err instanceof Error ? err.message : 'Could not update biometric login.',
                  );
                }
              })();
            }}
          />
        </Card>
        <Card>
          <Text style={styles.rowTitle}>App Lock</Text>
          <Text style={styles.rowHint}>
            Require {bioLabel} when opening the app. You stay signed in.
          </Text>
          <Switch
            value={appLock}
            disabled={!canBiometric}
            onValueChange={(on) => {
              void (async () => {
                if (on && !biometric) {
                  try {
                    await enableBiometricLogin();
                    setBiometric(true);
                  } catch (err) {
                    Alert.alert(
                      'App lock',
                      err instanceof Error ? err.message : 'Enable biometric login first.',
                    );
                    return;
                  }
                }
                await setAppLockEnabled(on);
                setAppLock(on);
              })();
            }}
          />
        </Card>

        <Pressable onPress={() => router.push('/password')}>
          <Text style={styles.link}>Change Password</Text>
        </Pressable>
        <Text style={styles.heading}>My Devices</Text>
        {devices.map((row) => (
          <Card key={row.id}>
            <Text style={styles.device}>
              {row.thisDevice ? 'This Device' : row.deviceModel || row.deviceLabel || 'App'}
            </Text>
            <Text style={styles.meta}>
              {[row.platform, row.osVersion, row.deviceStatus].filter(Boolean).join(' · ')}
            </Text>
            {row.lastActiveAt ? (
              <Text style={styles.meta}>
                Last active {new Date(row.lastActiveAt).toLocaleString()}
              </Text>
            ) : null}
            {!row.thisDevice ? (
              <Pressable onPress={() => void signOutMyDevice(row.id).then(load)}>
                <Text style={styles.danger}>Sign Out</Text>
              </Pressable>
            ) : null}
          </Card>
        ))}
        <Pressable
          onPress={() => {
            Alert.alert('Sign out all other devices?', 'This device will stay signed in.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign Out All Other Devices',
                onPress: () => void signOutOtherDevices().then(load),
              },
            ]);
          }}
        >
          <Text style={styles.link}>Sign Out All Other Devices</Text>
        </Pressable>
        <Text style={styles.heading}>Active Sessions</Text>
        {rows.map((row) => (
          <Card key={row.id}>
            <Text style={styles.device}>
              {row.current ? 'Current Device' : row.device || 'App'}
            </Text>
            <Text style={styles.meta}>Last active {new Date(row.lastActive).toLocaleString()}</Text>
            {!row.current ? (
              <Pressable onPress={() => void revokeSession(row.id).then(load)}>
                <Text style={styles.danger}>Log out this device</Text>
              </Pressable>
            ) : null}
          </Card>
        ))}
        <Pressable
          onPress={() => {
            Alert.alert('Log out other devices?', 'This device will stay signed in.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Log Out Other Devices',
                onPress: () => void revokeOtherSessions().then(load),
              },
            ]);
          }}
        >
          <Text style={styles.link}>Log Out Other Devices</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Alert.alert(
              'Logout from all devices?',
              'Every device will need to sign in again, including this one.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Logout All Devices',
                  style: 'destructive',
                  onPress: () => {
                    void logoutAllDevices()
                      .catch(() => undefined)
                      .then(() => import('@/auth/session').then((m) => m.clearSession()))
                      .then(() => router.replace('/login'));
                  },
                },
              ],
            );
          }}
        >
          <Text style={styles.danger}>Logout All Devices</Text>
        </Pressable>
        <Pressable onPress={() => confirmLogout(() => router.replace('/login'))}>
          <Text style={styles.danger}>Logout</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.md, gap: 12 },
  heading: { fontWeight: '800', color: colors.navy, marginTop: 8 },
  rowTitle: { fontWeight: '800', color: colors.ink },
  rowHint: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  device: { fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  link: { color: colors.navy, fontWeight: '800', textAlign: 'center', padding: 8 },
  danger: { color: colors.danger, fontWeight: '800', textAlign: 'center', padding: 8 },
});
