import { PoweredByBaseCodeLabs } from '@/components/branding/powered-by-basecode-labs';

export function LandingFooter() {
  return (
    <footer className="border-t border-white/10 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-sm text-white/45">
          © {new Date().getFullYear()} BaseCode Labs Pvt. Ltd. · BCL OneCampus ERP
        </p>
        <PoweredByBaseCodeLabs className="text-xs text-white/35 underline-offset-2 hover:underline" />
      </div>
    </footer>
  );
}
