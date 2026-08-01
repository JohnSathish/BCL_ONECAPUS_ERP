/**
 * Parse official NAAC affiliated QnM Excel into seed catalog JSON.
 *
 *   npx tsx scripts/parse-naac-excel-templates.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';

const ROOT = path.resolve(__dirname, '..');
const XLSX_PATH = path.join(
  ROOT,
  'prisma/seeds/data/naac-affiliated-qnms-2023.xlsx',
);
const OUT_PATH = path.join(ROOT, 'prisma/seeds/naac-metric-tables.json');

function slugKey(label: string, idx: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base || `col_${idx + 1}`;
}

function extractMetricCodes(sheetName: string, titleCell: string): string[] {
  const hay = `${sheetName} ${titleCell}`;
  const found = new Set<string>();
  const re = /\b(\d\.\d(?:\.\d+)?)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(hay))) found.add(m[1]);
  // Combined sheets like "2.1, 2.2 &2.4.2"
  if (found.size === 0) {
    const parts = sheetName.split(/[,&]/).map((s) => s.trim());
    for (const p of parts) {
      const mm = p.match(/^(\d\.\d(?:\.\d+)?)/);
      if (mm) found.add(mm[1]);
    }
  }
  return [...found];
}

/** Map Extended Profile / short sheet codes onto seeded QnM metric codes. */
const METRIC_CODE_ALIASES: Record<string, string[]> = {
  '1.1': ['1.1', '1.1.1', '1.1.2', '1.1.3'],
  '3.1': ['3.1', '3.1.1', '3.1.2'],
  '2.1_2.2_2.4.2': ['2.1', '2.2', '2.4.1', '2.4.2', '2.4.3'],
  '2.6.2': ['2.6.2', '2.6.1', '2.6.3'],
};

function expandMetricCodes(tableCode: string, codes: string[]): string[] {
  const aliases = METRIC_CODE_ALIASES[tableCode];
  if (!aliases?.length) return codes;
  return [...new Set([...codes, ...aliases])];
}

function inferType(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('date') || l.includes('joining')) return 'date';
  if (
    l.includes('amount') ||
    l.includes('number of') ||
    l.includes('seats') ||
    l.includes('percentage') ||
    l.includes('year')
  )
    return 'number';
  if (l.includes('email') || l.includes('link') || l.includes('url'))
    return 'url';
  return 'string';
}

async function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`Missing workbook: ${XLSX_PATH}`);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  const tables: Array<{
    code: string;
    sheetName: string;
    title: string;
    metricCodes: string[];
    columns: Array<{
      key: string;
      label: string;
      dataType: string;
      yearScoped?: boolean;
    }>;
    layoutHints: Record<string, unknown>;
    sortOrder: number;
  }> = [];

  let sortOrder = 0;
  for (const ws of wb.worksheets) {
    const sheetName = ws.name;
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 20) return;
      const vals: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        while (vals.length < colNumber - 1) vals.push('');
        let v = '';
        try {
          const raw = cell.value;
          if (raw == null) v = '';
          else if (
            typeof raw === 'object' &&
            raw !== null &&
            'richText' in (raw as object)
          ) {
            v = String(
              (raw as { richText?: Array<{ text?: string }> }).richText
                ?.map((t) => t.text)
                .join('') ?? '',
            );
          } else if (
            typeof raw === 'object' &&
            raw !== null &&
            'result' in (raw as object)
          ) {
            v = String((raw as { result?: unknown }).result ?? '');
          } else if (
            typeof raw === 'object' &&
            raw !== null &&
            'text' in (raw as object)
          ) {
            v = String((raw as { text?: string }).text ?? '');
          } else {
            v = String(raw);
          }
        } catch {
          v = '';
        }
        vals.push(v.trim());
      });
      if (vals.some((v) => v)) rows.push(vals);
    });

    const title = rows[0]?.find((c) => c)?.trim() || sheetName;
    const metricCodes = extractMetricCodes(sheetName, title);

    // Find header row: first row after title with >= 2 non-empty cells that look like labels
    let headerRowIdx = 1;
    for (let i = 1; i < Math.min(rows.length, 8); i++) {
      const nonEmpty = rows[i].filter((c) => c).length;
      if (nonEmpty >= 2) {
        headerRowIdx = i;
        break;
      }
    }
    // Prefer row that doesn't start with "Year -"
    for (let i = 1; i < Math.min(rows.length, 10); i++) {
      const joined = rows[i].join(' ');
      if (/year\s*-\s*\d/i.test(joined)) continue;
      const nonEmpty = rows[i].filter((c) => c).length;
      if (nonEmpty >= 2 && !/^total$/i.test(rows[i][0] || '')) {
        headerRowIdx = i;
        break;
      }
    }

    const header = rows[headerRowIdx] || [];
    // Merge subcategory header row if next row has SC/ST etc under empty parents
    const sub = rows[headerRowIdx + 1] || [];
    const columns: Array<{
      key: string;
      label: string;
      dataType: string;
      yearScoped?: boolean;
    }> = [];
    const usedKeys = new Set<string>();

    for (let i = 0; i < Math.max(header.length, sub.length); i++) {
      let label = (header[i] || '').trim();
      const subLabel = (sub[i] || '').trim();
      if (!label && subLabel && /^(SC|ST|OBC|Gen|Others)$/i.test(subLabel)) {
        // find last non-empty parent
        let parent = '';
        for (let j = i - 1; j >= 0; j--) {
          if (header[j]) {
            parent = header[j];
            break;
          }
        }
        label = parent ? `${parent} — ${subLabel}` : subLabel;
      }
      if (!label) continue;
      if (/^year\s*-\s*\d/i.test(label)) continue;

      let key = slugKey(label, i);
      let n = 2;
      while (usedKeys.has(key)) {
        key = `${slugKey(label, i)}_${n++}`;
      }
      usedKeys.add(key);
      columns.push({
        key,
        label,
        dataType: inferType(label),
        yearScoped: /year/i.test(label),
      });
    }

    if (!columns.length) {
      columns.push(
        { key: 'col_1', label: 'Field 1', dataType: 'string' },
        { key: 'col_2', label: 'Field 2', dataType: 'string' },
        { key: 'col_3', label: 'Field 3', dataType: 'string' },
      );
    }

    const yearScoped = rows.some((r) =>
      r.some((c) => /year\s*-\s*\d/i.test(c)),
    );

    const code = sheetName
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);

    tables.push({
      code,
      sheetName,
      title: title.slice(0, 500),
      metricCodes: expandMetricCodes(
        code,
        metricCodes.length ? metricCodes : [sheetName],
      ),
      columns,
      layoutHints: {
        headerRowIndex: headerRowIdx,
        yearScoped,
        officialSheetName: sheetName,
      },
      sortOrder: sortOrder++,
    });
  }

  const payload = {
    source: 'Revised_Compressed_Affiliated_Templates_20-07-2023.xlsx',
    generatedAt: new Date().toISOString(),
    tableCount: tables.length,
    tables,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Wrote ${tables.length} tables → ${OUT_PATH}`);
  for (const t of tables) {
    console.log(
      `  ${t.code} → metrics [${t.metricCodes.join(', ')}] cols=${t.columns.length}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
