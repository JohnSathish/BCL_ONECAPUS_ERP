import { Text, View } from 'react-native';
import { useBootstrap } from '@/hooks/useBootstrap';

export default function MaintenanceScreen() {
  const { config } = useBootstrap();
  const message =
    config?.maintenanceMessage ??
    config?.forceUpdateMessage ??
    'The app is temporarily unavailable. Please try again later.';

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>{config?.appName ?? 'OneCampus'}</Text>
      <Text>{message}</Text>
      {config?.forceUpdate ? <Text>Minimum required version: {config.minVersion}</Text> : null}
    </View>
  );
}
