export type OpacCopyTone = 'available' | 'borrowed' | 'reference' | 'closed';

export function opacCopyAvailability(input: {
  status: string;
  onLoan: boolean;
  issueAllowed: boolean;
  copyType?: string | null;
}): { label: string; tone: OpacCopyTone } {
  if (input.onLoan || input.status === 'ISSUED') {
    return { label: 'Borrowed', tone: 'borrowed' };
  }
  if (!input.issueAllowed) {
    if (input.copyType === 'REFERENCE') {
      return { label: 'Reference only', tone: 'reference' };
    }
    if (input.copyType === 'RARE') {
      return { label: 'Rare — not for issue', tone: 'reference' };
    }
    if (input.copyType === 'RESTRICTED') {
      return { label: 'Restricted — not for issue', tone: 'reference' };
    }
    return { label: 'Not for issue', tone: 'reference' };
  }
  if (input.status === 'AVAILABLE') {
    return { label: 'Available for issue', tone: 'available' };
  }
  if (input.status === 'LOST') return { label: 'Lost', tone: 'closed' };
  if (input.status === 'DAMAGED') return { label: 'Damaged', tone: 'closed' };
  if (input.status === 'WITHDRAWN')
    return { label: 'Withdrawn', tone: 'closed' };
  if (input.status === 'PROCESSING')
    return { label: 'In processing', tone: 'closed' };
  return { label: input.status.replaceAll('_', ' '), tone: 'closed' };
}
