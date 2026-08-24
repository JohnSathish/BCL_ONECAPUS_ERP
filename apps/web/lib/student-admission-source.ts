/** Excel import does not capture Class XII subject marks. */

export function isExcelImportedStudent(input?: {
  importSource?: string | null;
  admissionSource?: string | null;
}): boolean {
  const tokens = `${input?.importSource ?? ''} ${input?.admissionSource ?? ''}`
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  return tokens.includes('IMPORT') || tokens.includes('EXCEL');
}
