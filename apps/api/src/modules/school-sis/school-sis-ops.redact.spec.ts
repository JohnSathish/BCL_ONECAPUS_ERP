import { redactDeep, redactText } from './school-sis-ops.redact';

describe('school-sis-ops redact', () => {
  it('redacts nested secrets and bearer tokens', () => {
    const out = redactDeep({
      password: 'secret',
      nested: { apiKey: 'abc', ok: 'yes' },
    }) as Record<string, unknown>;
    expect(out.password).toBe('[REDACTED]');
    expect((out.nested as { apiKey: string }).apiKey).toBe('[REDACTED]');
    expect((out.nested as { ok: string }).ok).toBe('yes');
    expect(redactText('Authorization: Bearer abc.def')).toContain('[REDACTED]');
  });
});
