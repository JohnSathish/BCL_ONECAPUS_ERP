import { CommunicationSettingsForm } from '@/components/communication/settings/communication-settings-form';

export default function SettingsPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Communication Settings</h1>
      <CommunicationSettingsForm />
    </div>
  );
}
