/**
 * Read college / NEHU identity columns from office Excel registers.
 * Header text varies (NEHU ROLL NO., NEHU ROLL, NEHU\\n ROLL NO, duplicate
 * "Roll No." used as NEHU roll on B.Com/B.Sc sheets).
 */
export function normalizeOfficeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function pickNumericNehuFromDuplicateRoll(
  collegeRoll: string,
  lastRollNo: string,
): string {
  const last = lastRollNo.replace(/\s+/g, '').replace(/\.0$/, '');
  if (!last || last.toUpperCase() === collegeRoll.trim().toUpperCase()) {
    return '';
  }
  return /^\d{6,}$/.test(last) ? last : '';
}

function digitsKeep(value: string): string {
  return value.replace(/\s+/g, '').replace(/\.0$/, '').trim();
}

export function readOfficeIdentity(
  row: { getCell: (col: number) => { value: unknown } },
  headers: Map<string, number[]>,
  cellText: (value: unknown) => string,
  collegeRoll: string,
): { nehuRoll: string; nehuReg: string } {
  const byNorm = new Map<string, number[]>();
  for (const [header, cols] of headers) {
    const key = normalizeOfficeHeader(header);
    const list = byNorm.get(key) ?? [];
    list.push(...cols);
    byNorm.set(key, list);
  }

  const read = (names: string[], which: 'first' | 'last' = 'first'): string => {
    for (const name of names) {
      const cols = byNorm.get(normalizeOfficeHeader(name));
      if (!cols?.length) continue;
      const col = which === 'last' ? cols[cols.length - 1]! : cols[0]!;
      const text = cellText(row.getCell(col).value).trim();
      if (text) return text;
    }
    return '';
  };

  let nehuRoll = digitsKeep(
    read(['nehu roll no', 'nehu roll number', 'nehu roll']),
  );
  if (!nehuRoll) {
    nehuRoll = pickNumericNehuFromDuplicateRoll(
      collegeRoll,
      read(['roll no', 'roll number'], 'last'),
    );
  }

  const nehuReg = digitsKeep(
    read([
      'nehu regd no',
      'nehu registration number',
      'regd no',
      'regn no',
      'reg no',
    ]),
  );

  return { nehuRoll, nehuReg };
}
