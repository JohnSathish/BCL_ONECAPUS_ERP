import {
  FEE_MODULE_NOT_ENABLED_MESSAGE,
  NO_PENDING_FEES_MESSAGE,
  studentFeePortalView,
} from './student-fee-portal-status';

describe('studentFeePortalView', () => {
  it('hides a zero balance when the student fee portal is disabled', () => {
    const view = studentFeePortalView({
      portalEnabled: false,
      demandPublished: true,
      outstanding: 1200,
      paid: 0,
    });

    expect(view.moduleEnabled).toBe(false);
    expect(view.moduleLocked).toBe(true);
    expect(view.due).toBe(0);
    expect(view.status).toBe('LOCKED');
    expect(view.statusMessage).toBe(FEE_MODULE_NOT_ENABLED_MESSAGE);
  });

  it('hides a zero balance when fee demand has not been published', () => {
    const view = studentFeePortalView({
      portalEnabled: true,
      demandPublished: false,
      outstanding: 0,
      paid: 0,
    });

    expect(view.moduleEnabled).toBe(false);
    expect(view.statusMessage).toBe(FEE_MODULE_NOT_ENABLED_MESSAGE);
    expect(view.due).toBe(0);
  });

  it('returns the real outstanding amount when the module is live', () => {
    const view = studentFeePortalView({
      portalEnabled: true,
      demandPublished: true,
      outstanding: 4500,
      paid: 500,
    });

    expect(view.moduleEnabled).toBe(true);
    expect(view.due).toBe(4500);
    expect(view.paid).toBe(500);
    expect(view.status).toBe('PENDING');
    expect(view.statusMessage).toBeNull();
  });

  it('reports no pending fees only when the live balance is zero', () => {
    const view = studentFeePortalView({
      portalEnabled: true,
      demandPublished: true,
      outstanding: 0,
      paid: 8000,
    });

    expect(view.moduleEnabled).toBe(true);
    expect(view.due).toBe(0);
    expect(view.status).toBe('PAID');
    expect(view.statusMessage).toBe(NO_PENDING_FEES_MESSAGE);
  });
});
