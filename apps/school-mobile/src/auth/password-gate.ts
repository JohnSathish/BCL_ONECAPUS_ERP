let passwordLoginAt = 0;
let passwordPreferredAt = 0;

export function markPasswordLogin() {
  passwordLoginAt = Date.now();
  passwordPreferredAt = 0;
}

export function preferPasswordLogin() {
  passwordPreferredAt = Date.now();
}

export function justDidPasswordLogin(withinMs = 120_000) {
  return passwordLoginAt > 0 && Date.now() - passwordLoginAt < withinMs;
}

export function wantsPasswordLogin(withinMs = 10 * 60_000) {
  return passwordPreferredAt > 0 && Date.now() - passwordPreferredAt < withinMs;
}
