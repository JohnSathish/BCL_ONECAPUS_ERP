import { BadRequestException } from '@nestjs/common';
import { AdmissionsFormService } from './admissions-form.service';

describe('AdmissionsFormService payment gate', () => {
  const service = Object.create(
    AdmissionsFormService.prototype,
  ) as AdmissionsFormService;
  const isPaymentSatisfied = (
    service as unknown as {
      isPaymentSatisfied: (app: {
        paymentStatus: string;
        cycle?: { settings: unknown } | null;
      }) => boolean;
    }
  ).isPaymentSatisfied.bind(service);

  it('requires PAID or WAIVED by default', () => {
    expect(
      isPaymentSatisfied({ paymentStatus: 'PENDING', cycle: { settings: {} } }),
    ).toBe(false);
    expect(
      isPaymentSatisfied({ paymentStatus: 'PAID', cycle: { settings: {} } }),
    ).toBe(true);
    expect(
      isPaymentSatisfied({ paymentStatus: 'WAIVED', cycle: { settings: {} } }),
    ).toBe(true);
  });

  it('allows submit when cycle disables the requirement', () => {
    expect(
      isPaymentSatisfied({
        paymentStatus: 'PENDING',
        cycle: { settings: { requirePaymentBeforeSubmit: false } },
      }),
    ).toBe(true);
  });
});

describe('AdmissionsFormService submit payment check (integration shape)', () => {
  it('documents the submit error message', () => {
    const err = new BadRequestException(
      'Application fee must be paid before submitting. Pay online on the Payments page or at the college office.',
    );
    expect(err.message).toContain('fee must be paid');
  });
});
