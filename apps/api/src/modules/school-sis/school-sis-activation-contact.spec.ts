import {
  isSchoolPlaceholderEmail,
  pickSchoolActivationContact,
  realSchoolEmail,
} from './school-sis-activation-contact';

describe('school activation contact', () => {
  it('treats generated login emails as placeholders', () => {
    expect(isSchoolPlaceholderEmail('student.sls20260008@stlukestura.in')).toBe(
      true,
    );
    expect(
      isSchoolPlaceholderEmail('student.sls20260008@portal.stlukestura.in'),
    ).toBe(true);
    expect(realSchoolEmail('JOHNSATHISH16@GMAIL.COM')).toBe(
      'johnsathish16@gmail.com',
    );
  });

  it('sends OTP to the student master phone, not a stale login mobile', () => {
    const contact = pickSchoolActivationContact({
      studentPhone: '9568383655',
      studentEmail: 'johnsathish16@gmail.com',
      userPhone: '9863017265',
      userEmail: 'student.sls20260008@stlukestura.in',
    });
    expect(contact?.kind).toBe('SMS');
    expect(contact?.mobile).toBe('919568383655');
    expect(contact?.masked?.endsWith('3655')).toBe(true);
  });

  it('falls back to the real student email, never the generated login email', () => {
    const contact = pickSchoolActivationContact({
      studentPhone: '',
      studentEmail: 'johnsathish16@gmail.com',
      userPhone: '',
      userEmail: 'student.sls20260008@stlukestura.in',
    });
    expect(contact).toEqual({
      kind: 'EMAIL',
      email: 'johnsathish16@gmail.com',
      masked: 'j*****@gmail.com',
    });
  });
});
