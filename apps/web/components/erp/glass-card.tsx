import { cn } from '@/utils/cn';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  glow?: boolean;
};

export function GlassCard({ className, glow, children, ...props }: Props) {
  return (
    <div
      className={cn(
        'glass-card rounded-2xl',
        glow && 'transition-shadow hover:shadow-[var(--shadow-glow)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
