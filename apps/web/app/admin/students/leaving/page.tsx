import { redirect } from 'next/navigation';

export default function StudentLeavingRedirectPage() {
  redirect('/admin/students/transfer');
}
