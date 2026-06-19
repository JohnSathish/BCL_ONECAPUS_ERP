/** True only when demo login helper is explicitly enabled (local dev / demo sites). */
export function isDemoLoginWorkspaceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN === 'true';
}
