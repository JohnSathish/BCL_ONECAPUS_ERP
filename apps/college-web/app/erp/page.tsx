import { redirect } from 'next/navigation';
import { getErpLoginUrl } from '@/lib/erp-login';

export default function ErpLoginRedirectPage() {
  redirect(getErpLoginUrl());
}
