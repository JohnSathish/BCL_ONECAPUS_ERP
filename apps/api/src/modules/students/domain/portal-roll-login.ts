function sameText(left: string, right: string) {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

/** After a roll change, the portal login and admission number follow the new roll. */
export function portalLoginAfterRollChange(input: {
  oldRoll: string | null;
  newRoll: string;
  username: string | null;
  enrollmentNumber: string;
}): { username: string | null; enrollmentNumber: string | null } {
  const next = input.newRoll.trim();
  const previous = (input.oldRoll ?? '').trim();
  if (!next || sameText(next, previous)) {
    return { username: null, enrollmentNumber: null };
  }

  const username = (input.username ?? '').trim();
  const enrollment = input.enrollmentNumber.trim();
  const loginWasThisRoll =
    !username || sameText(username, previous) || sameText(username, enrollment);

  return {
    username: loginWasThisRoll && !sameText(username, next) ? next : null,
    enrollmentNumber:
      sameText(enrollment, previous) && !sameText(enrollment, next)
        ? next
        : null,
  };
}
