import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Edge-to-edge Android can report a 0 top inset on the first frame, which
 * slides the menu under the status bar. Use the larger of the safe-area inset
 * and the platform status-bar height.
 */
export function useStableTopInset() {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'android') return insets.top;
  return Math.max(insets.top, StatusBar.currentHeight ?? 0);
}
