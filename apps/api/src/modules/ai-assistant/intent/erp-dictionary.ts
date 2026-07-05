/**
 * Institution terminology for OneCampus Intelligence.
 * Expands local language into ERP-grounded phrases before intent routing.
 */

export type ActiveStudentContext = {
  id: string;
  rollNumber: string;
  enrollmentNumber?: string;
  name: string;
};

/** Normalize institution slang / abbreviations in the user question. */
export function applyErpDictionary(question: string): string {
  let q = question;
  const replacements: Array<[RegExp, string]> = [
    [/\bfyugp\b/gi, 'FYUP'],
    [/\bfyup\b/gi, 'FYUP'],
    [/\bcbcs\b/gi, 'CBCS'],
    [/\bnehu\b/gi, 'NEHU'],
    [/\bdbct\b/gi, 'Don Bosco College Tura'],
    [/\bodd\s*sem(ester)?\b/gi, 'odd semester'],
    [/\beven\s*sem(ester)?\b/gi, 'even semester'],
    [/\bmorning\s*shift\b/gi, 'Morning Shift'],
    [/\bday\s*shift\b/gi, 'Day Shift'],
    [/\bevening\s*shift\b/gi, 'Evening Shift'],
    [/\bbonafide\b/gi, 'bonafide certificate'],
    [/\btransfer\s*certificate\b/gi, 'transfer certificate'],
    [/\btc\b(?!\w)/gi, 'transfer certificate'],
  ];
  for (const [pattern, replacement] of replacements) {
    q = q.replace(pattern, replacement);
  }
  return q;
}

/** Follow-ups that refer to the student already in conversation memory. */
export function isActiveStudentFollowUp(lower: string): boolean {
  // General knowledge / drafting — do not bind to active student.
  if (
    /\bnep\b|\bsgpa\b|\bcgpa\b|\bregulation\b|\bpolicy\b|\bexplain\b|\bdifference between\b|\bdraft\b|\bwrite\b|\bcircular\b|\bappointment letter\b|\bhow is\b|\bwhat is the\b/.test(
      lower,
    )
  ) {
    return false;
  }
  return (
    /\bfee\b|\bpending\b|\boutstanding\b|\bdue\b|\bdefaulter\b|\bpaid\b/.test(
      lower,
    ) ||
    /\battendance\b|\babsent\b|\bpresent\b/.test(lower) ||
    /\bsemester\b|\bsem\b/.test(lower) ||
    /\bshift\b|\bmorning or day\b|\bevening\b/.test(lower) ||
    /\bprogramme\b|\bprogram\b|\bmajor\b|\bstud(y|ies|ying)\b/.test(lower) ||
    /\bprofile\b|\bdetails?\b|\bmobile\b|\bphone\b|\bcontact\b|\bfather\b|\bmother\b/.test(
      lower,
    ) ||
    /\bid\s*card\b|\breceipt\b|\bbonafide\b/.test(lower) ||
    /^(how much|which shift|which programme|what semester|show profile|give details)\b/.test(
      lower.trim(),
    )
  );
}
