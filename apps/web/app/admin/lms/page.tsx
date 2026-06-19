import { redirect } from 'next/navigation';

/** Legacy shortcut — LMS lives under academics. */
export default function AdminLmsRedirectPage() {
  redirect('/admin/academics/lms');
}
