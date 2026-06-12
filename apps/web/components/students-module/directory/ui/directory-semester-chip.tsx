import { cn } from '@/utils/cn';

type Props = {
  semester: number | string;
  className?: string;
};

export function DirectorySemesterChip({ semester, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[1.75rem] items-center justify-center rounded-full border border-violet-500/25 bg-gradient-to-br from-violet-500/15 to-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-violet-700 dark:text-violet-300',
        className,
      )}
    >
      {semester}
    </span>
  );
}
