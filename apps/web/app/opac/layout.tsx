import { OpacShell } from '@/components/opac/opac-shell';

export default function OpacLayout({ children }: { children: React.ReactNode }) {
  return <OpacShell>{children}</OpacShell>;
}
