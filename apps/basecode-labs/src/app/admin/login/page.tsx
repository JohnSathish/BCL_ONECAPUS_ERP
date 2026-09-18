import { BrandLogo } from '@/components/brand/brand-logo';
import { EmailOtpLogin } from '@/components/auth/email-otp-login';

export default function AdminLoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#050d1c] px-4">
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="absolute inset-0 grid-glow opacity-60" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandLogo size={92} />
        </div>
        <EmailOtpLogin
          purpose="ADMIN_LOGIN"
          title="BaseCode Central"
          subtitle="Every admin login is verified with a one-time code sent to your email. Passwords are not used."
        />
      </div>
    </div>
  );
}
