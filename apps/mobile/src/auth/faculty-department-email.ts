/** Department token after the first name: tusumika.sociology@college */
const FACULTY_DEPARTMENT_TOKENS = new Set([
  'botany',
  'chemistry',
  'commerce',
  'computer-science',
  'computerscience',
  'cs',
  'economics',
  'education',
  'english',
  'garo',
  'geography',
  'history',
  'mathematics',
  'maths',
  'philosophy',
  'physics',
  'political-science',
  'politicalscience',
  'polsc',
  'sociology',
  'zoology',
  'eco',
  'edn',
  'edu',
  'eng',
  'gar',
  'geo',
  'his',
  'phi',
  'pol',
  'soc',
  'bot',
  'che',
  'mth',
  'phy',
  'zoo',
  'com',
]);

export function isFacultyDepartmentEmail(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  const at = email.indexOf('@');
  if (at <= 0) return false;
  const local = email.slice(0, at);
  const dot = local.indexOf('.');
  if (dot <= 0) return false;
  return FACULTY_DEPARTMENT_TOKENS.has(local.slice(dot + 1));
}
