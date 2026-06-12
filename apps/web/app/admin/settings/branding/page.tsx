import { redirect } from 'next/navigation';

export default function LegacyBrandingRedirect() {
  redirect('/admin/administration/theme-branding');
}
