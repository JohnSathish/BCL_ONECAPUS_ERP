/** Public ERP login URL for college-web CTAs and /erp redirect. */
export const DEFAULT_ERP_LOGIN_URL = 'https://erp.donboscocollege.ac.in';

export function getErpLoginUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ERP_LOGIN_URL?.trim();
  return fromEnv || DEFAULT_ERP_LOGIN_URL;
}
