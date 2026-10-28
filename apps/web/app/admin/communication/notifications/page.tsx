import { NotificationHistoryAdmin } from '@/components/communication/notifications/notification-history-admin';
import { NotificationsInbox } from '@/components/communication/notifications/notifications-inbox';

export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">In-App Notifications</h1>
      <NotificationHistoryAdmin />
      <NotificationsInbox />
    </div>
  );
}
