import { compareAttendanceRoll } from './attendance-roll-order.util';

describe('compareAttendanceRoll', () => {
  it('orders PS26 rolls by the numeric suffix', () => {
    const rows = [
      { rollNumber: 'PS26-20', fullName: 'Esha' },
      { rollNumber: 'PS26-02', fullName: 'Akhasa' },
      { rollNumber: 'PS26-09', fullName: 'Banshailang' },
      { rollNumber: 'PS26-10', fullName: 'Later' },
    ];
    const ordered = [...rows]
      .sort(compareAttendanceRoll)
      .map((row) => row.rollNumber);
    expect(ordered).toEqual(['PS26-02', 'PS26-09', 'PS26-10', 'PS26-20']);
  });

  it('puts students without a roll number after numbered rolls', () => {
    const ordered = [
      { rollNumber: null, fullName: 'Zara' },
      { rollNumber: 'PS26-01', fullName: 'Asha' },
    ]
      .sort(compareAttendanceRoll)
      .map((row) => row.fullName);
    expect(ordered).toEqual(['Asha', 'Zara']);
  });
});
