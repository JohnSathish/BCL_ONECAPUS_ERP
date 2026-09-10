import { headers } from 'next/headers';
import { LoginForm } from '@/components/auth/login-form';
import { isSecondarySchoolSisSession } from '@/lib/school-erp/product';

export default async function LoginPage() {
  const h = await headers();
  const host = (h.get('x-forwarded-host') || h.get('host') || '').split(':')[0];
  const schoolSis = isSecondarySchoolSisSession({ hostname: host });
  return <LoginForm schoolSis={schoolSis} />;
}
