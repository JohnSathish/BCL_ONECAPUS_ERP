import type { ReactNode } from 'react';

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <div className="login-font-scope min-h-screen">{children}</div>;
}
