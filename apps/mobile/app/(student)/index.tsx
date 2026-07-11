import { Redirect } from 'expo-router';

/** Ensures `/(student)` resolves even if a deep link omits `(tabs)`. */
export default function StudentIndexRedirect() {
  return <Redirect href="/(student)/(tabs)" />;
}
