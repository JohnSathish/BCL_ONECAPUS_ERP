export const BASECODE_LABS_WEBSITE = 'https://basecodelabs.com/';
export const POWERED_BY_BASECODE_LABS_LABEL = 'Powered by BaseCode Labs Pvt. Ltd.';

export function PoweredByBaseCodeLabs({ className }: { className?: string }) {
  return (
    <a href={BASECODE_LABS_WEBSITE} target="_blank" rel="noopener noreferrer" className={className}>
      {POWERED_BY_BASECODE_LABS_LABEL}
    </a>
  );
}
