import { SCHOOL_DEFAULT_ROLES } from './school-sis-iam.catalog';

function perms(slug: string) {
  return SCHOOL_DEFAULT_ROLES.find((r) => r.slug === slug)?.permissions ?? [];
}

describe('school IAM default roles', () => {
  it('does not let a teacher collect fees or publish results', () => {
    const p = perms('teacher');
    expect(p).toContain('students.view');
    expect(p).toContain('exams.marks.enter');
    expect(p).not.toContain('fees.collection.collect');
    expect(p).not.toContain('exams.results.publish');
    expect(p).not.toContain('users.impersonate');
  });

  it('does not let an accountant enter exam marks', () => {
    const p = perms('accountant');
    expect(p).toContain('fees.collection.collect');
    expect(p).not.toContain('exams.marks.enter');
    expect(p).not.toContain('exams.view');
  });

  it('does not let a receptionist change roles', () => {
    const p = perms('receptionist');
    expect(p).not.toContain('roles.update');
    expect(p).not.toContain('users.impersonate');
  });

  it('does not let a fee collector change fee configuration slugs', () => {
    const p = perms('fee-collector');
    expect(p).toContain('fees.collection.collect');
    expect(p).not.toContain('school-sis:manage');
  });

  it('reserves impersonation for Super Administrator', () => {
    expect(perms('college-admin')).toContain('users.impersonate');
    expect(perms('school-admin')).not.toContain('users.impersonate');
    expect(perms('principal')).not.toContain('users:impersonate');
    expect(perms('school-admin')).not.toContain('system.backup.restore');
    expect(perms('college-admin')).toContain('system.backup.restore');
  });

  it('does not grant a student admin pages', () => {
    const p = perms('school-student');
    expect(p).not.toContain('school-sis:manage');
    expect(p).not.toContain('users.view');
    expect(p).toContain('school-mobile:student');
  });
});
