let passwordLoginAt = 0;

export function markPasswordLogin() {
  passwordLoginAt = Date.now();
}

export function justDidPasswordLogin(withinMs = 120_000) {
  return passwordLoginAt > 0 && Date.now() - passwordLoginAt < withinMs;
}
