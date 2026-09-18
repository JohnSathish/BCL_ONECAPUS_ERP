import { BrandLogo } from '@/components/brand/brand-logo';
import { EmailOtpLogin } from '@/components/auth/email-otp-login';

export default function PortalLoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#050d1c] px-4">
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandLogo size={92} />
        </div>
        <EmailOtpLogin
          purpose="CLIENT_LOGIN"
          title="Client portal"
          subtitle="Sign in with the email registered to your organisation. A one-time code is required every login."
        />
      </div>
    </div>
  );
}
