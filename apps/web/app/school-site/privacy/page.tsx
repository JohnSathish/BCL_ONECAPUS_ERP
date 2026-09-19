import { redirect } from 'next/navigation';
import { ST_LUKES_PRIVACY_POLICY_PATH } from '@/lib/school-web/privacy-policy-content';

export default function SchoolSitePrivacyRedirect() {
  redirect(ST_LUKES_PRIVACY_POLICY_PATH);
}
