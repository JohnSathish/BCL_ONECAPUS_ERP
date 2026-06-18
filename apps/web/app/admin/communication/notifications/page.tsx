import { NotificationsInbox } from '@/components/communication/notifications/notifications-inbox';

export default function NotificationsPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">In-App Notifications</h1>
      <NotificationsInbox />
    </div>
  );
}
