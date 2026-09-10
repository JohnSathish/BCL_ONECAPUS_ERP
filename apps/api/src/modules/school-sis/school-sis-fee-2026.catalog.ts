type FeeLineSeed = {
  kind: 'ANNUAL' | 'UNIFORM' | 'MONTHLY';
  code: string;
  label: string;
  amount: number | null;
  unspecified?: boolean;
  remarks?: string;
  sortOrder: number;
};

function heads(
  rows: Array<[code: string, label: string, amount: number]>,
): FeeLineSeed[] {
  return rows.map(([code, label, amount], i) => ({
    kind: 'ANNUAL' as const,
    code,
    label,
    amount,
    sortOrder: i + 1,
  }));
}

/** Official heads from St_Lukes_Fee_Structure_2026.xlsx (not the Class XI 2026–27 workbook). */
export const FEE_2026_GROUPS: Array<{
  code: string;
  name: string;
  gradeCodes: string[];
  printedTotal: number;
  notes: string[];
  lines: FeeLineSeed[];
}> = [
  {
    code: '2026-NEW',
    name: 'New Admission 2026',
    gradeCodes: ['NURSERY'],
    printedTotal: 6550,
    notes: [
      'Source: St_Lukes_Fee_Structure_2026.xlsx · New Admission · Nursery.',
      'Tuition Fees (Jan + Feb) are part of this admission total.',
    ],
    lines: heads([
      ['ADM', 'Admission', 1700],
      ['TW', "Teachers' Welfare", 300],
      ['TUI-JF', 'Tuition Fees (Jan + Feb)', 1200],
      ['EXAM', 'Examination Fees', 350],
      ['GAMES', 'Games and Sports', 400],
      ['MAINT', 'Maintenance', 700],
      ['EST', 'Establishment', 700],
      ['FUNC', 'Functions and Celebrations', 300],
      ['CARD', 'Admit & Fees Card', 200],
      ['DIARY', 'School Diary & ID', 200],
      ['FND', 'Foundation Fees', 150],
      ['LIB', 'Library', 150],
      ['MISC', 'Miscellaneous', 200],
    ]),
  },
  {
    code: '2026-NEW',
    name: 'New Admission 2026',
    gradeCodes: ['UKG', 'I', 'II', 'III', 'IV'],
    printedTotal: 6750,
    notes: [
      'Source: St_Lukes_Fee_Structure_2026.xlsx · New Admission · KG–IV.',
      'Applied independently to UKG and Classes I–IV.',
    ],
    lines: heads([
      ['ADM', 'Admission', 1700],
      ['TW', "Teachers' Welfare", 300],
      ['TUI-JF', 'Tuition Fees (Jan + Feb)', 1200],
      ['EXAM', 'Examination Fees', 350],
      ['GAMES', 'Games and Sports', 400],
      ['MAINT', 'Maintenance', 700],
      ['EST', 'Establishment', 700],
      ['FUNC', 'Functions and Celebrations', 350],
      ['CARD', 'Admit & Fees Card', 200],
      ['DIARY', 'School Diary & ID', 200],
      ['FND', 'Foundation Fees', 150],
      ['LIB', 'Library', 200],
      ['MISC', 'Miscellaneous', 300],
    ]),
  },
  {
    code: '2026-NEW',
    name: 'New Admission 2026',
    gradeCodes: ['V', 'VI', 'VII', 'VIII', 'IX'],
    printedTotal: 6950,
    notes: [
      'Source: St_Lukes_Fee_Structure_2026.xlsx · New Admission · V–IX.',
      'The workbook does not list a New Admission total for Class X.',
    ],
    lines: heads([
      ['ADM', 'Admission', 1700],
      ['TW', "Teachers' Welfare", 300],
      ['TUI-JF', 'Tuition Fees (Jan + Feb)', 1400],
      ['EXAM', 'Examination Fees', 350],
      ['GAMES', 'Games and Sports', 400],
      ['MAINT', 'Maintenance', 700],
      ['EST', 'Establishment', 700],
      ['FUNC', 'Functions and Celebrations', 350],
      ['CARD', 'Admit & Fees Card', 200],
      ['DIARY', 'School Diary & ID', 200],
      ['FND', 'Foundation Fees', 150],
      ['LIB', 'Library', 200],
      ['MISC', 'Miscellaneous', 300],
    ]),
  },
  {
    code: '2026-READMIT',
    name: 'Re-admission 2026',
    gradeCodes: ['UKG', 'I', 'II', 'III', 'IV'],
    printedTotal: 6250,
    notes: [
      'Source: St_Lukes_Fee_Structure_2026.xlsx · Re-admission · KG–IV.',
      'Nursery re-admission is not listed in this workbook.',
    ],
    lines: heads([
      ['ADM', 'Admission', 1200],
      ['TW', "Teachers' Welfare", 300],
      ['TUI-JF', 'Tuition Fees (Jan + Feb)', 1200],
      ['EXAM', 'Examination Fees', 350],
      ['GAMES', 'Games and Sports', 400],
      ['MAINT', 'Maintenance', 700],
      ['EST', 'Establishment', 700],
      ['FUNC', 'Functions and Celebrations', 350],
      ['CARD', 'Admit & Fees Card', 200],
      ['DIARY', 'School Diary & ID', 200],
      ['FND', 'Foundation Fees', 150],
      ['LIB', 'Library', 200],
      ['MISC', 'Miscellaneous', 300],
    ]),
  },
  {
    code: '2026-READMIT',
    name: 'Re-admission 2026',
    gradeCodes: ['V', 'VI', 'VII', 'VIII', 'IX', 'X'],
    printedTotal: 6450,
    notes: ['Source: St_Lukes_Fee_Structure_2026.xlsx · Re-admission · V–X.'],
    lines: heads([
      ['ADM', 'Admission', 1200],
      ['TW', "Teachers' Welfare", 300],
      ['TUI-JF', 'Tuition Fees (Jan + Feb)', 1400],
      ['EXAM', 'Examination Fees', 350],
      ['GAMES', 'Games and Sports', 400],
      ['MAINT', 'Maintenance', 700],
      ['EST', 'Establishment', 700],
      ['FUNC', 'Functions and Celebrations', 350],
      ['CARD', 'Admit & Fees Card', 200],
      ['DIARY', 'School Diary & ID', 200],
      ['FND', 'Foundation Fees', 150],
      ['LIB', 'Library', 200],
      ['MISC', 'Miscellaneous', 300],
    ]),
  },
];
