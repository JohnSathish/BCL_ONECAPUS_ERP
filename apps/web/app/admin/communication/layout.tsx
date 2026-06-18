import { CommCenterShell } from '@/components/communication/comm-center-shell';

export default function CommunicationLayout({ children }: { children: React.ReactNode }) {
  return <CommCenterShell>{children}</CommCenterShell>;
}
