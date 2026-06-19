import { redirect } from 'next/navigation';

/** Legacy shortcut — dashboard quick actions used this path before organization settings. */
export default function AdminSettingsRedirectPage() {
  redirect('/admin/organization');
}
