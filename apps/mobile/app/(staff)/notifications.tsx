import { Redirect, type Href } from 'expo-router';

/** Legacy stack route — keep for old push deep links; always land inside tabs. */
export default function FacultyNotificationsRedirect() {
  return <Redirect href={'/(staff)/(tabs)/notifications' as Href} />;
}
