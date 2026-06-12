import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-login',
  display: 'swap',
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <div className={`${plusJakarta.variable} login-font-scope min-h-screen`}>{children}</div>;
}
