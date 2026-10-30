import { copyInventoryStatus } from './library-department-inventory.service';

describe('copyInventoryStatus', () => {
  it('shows an open loan as issued', () => {
    expect(copyInventoryStatus('AVAILABLE', true)).toBe('Issued');
    expect(copyInventoryStatus('ISSUED', true)).toBe('Issued');
  });

  it('keeps lost, damaged, and available when the copy is not on loan', () => {
    expect(copyInventoryStatus('LOST', false)).toBe('Lost');
    expect(copyInventoryStatus('DAMAGED', false)).toBe('Damaged');
    expect(copyInventoryStatus('AVAILABLE', false)).toBe('Available');
  });
});
