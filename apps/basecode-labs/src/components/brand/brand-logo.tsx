import { cn } from '@/lib/cn';

export function BrandLogo({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/brand/bcl-logo-official.jpg"
      alt="BaseCode Labs Pvt. Ltd."
      width={size}
      height={size}
      className={cn(
        'rounded-full bg-white object-cover ring-2 ring-white/70 shadow-[0_8px_30px_rgba(15,76,168,0.35)]',
        className,
      )}
    />
  );
}
