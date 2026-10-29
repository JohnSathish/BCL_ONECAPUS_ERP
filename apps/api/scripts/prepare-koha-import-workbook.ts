import { writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { readKohaCatalogueFile } from '../src/modules/library/koha/koha-catalogue.reader';
import {
  buildPreparedWorkbook,
  validationSummary,
} from '../src/modules/library/koha/koha-import-workbook';

const source = resolve(
  process.argv[2] ??
    'C:\\Users\\johnm\\OneDrive\\Desktop\\KOHA BOOKS\\koha_catalogue_export (1).xlsx',
);
const output = resolve(
  process.argv[3] ?? `${dirname(source)}\\koha_catalogue_erp_import.xlsx`,
);

if (source === output) {
  throw new Error(
    'The prepared workbook must be a new file. The original Koha export is left unchanged.',
  );
}

async function main() {
  const catalogue = await readKohaCatalogueFile(source, source);
  const buffer = await buildPreparedWorkbook(catalogue);
  await writeFile(output, buffer);
  const summary = validationSummary(catalogue);
  console.log(`Wrote ${output}`);
  for (const [label, count] of summary) console.log(`${label}: ${count}`);
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'The workbook could not be prepared.',
  );
  process.exitCode = 1;
});
