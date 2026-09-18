import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin/admin-nav';
import { AdminHeader } from '@/components/admin/admin-header';
import { readSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session || session.user.role.startsWith('CLIENT')) redirect('/admin/login');
  return (
    <div className="min-h-screen bg-[#e8eef8]">
      <AdminNav name={session.user.name} />
      <div className="lg:pl-[268px]">
        <AdminHeader name={session.user.name} email={session.user.email} />
        <div className="p-4 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
