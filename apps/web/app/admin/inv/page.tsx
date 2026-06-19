import { redirect } from 'next/navigation';

/** Legacy shortcut — inventory module. */
export default function AdminInventoryRedirectPage() {
  redirect('/admin/inventory');
}
