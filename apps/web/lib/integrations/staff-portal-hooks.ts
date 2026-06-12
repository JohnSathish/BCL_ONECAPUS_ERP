/**
 * Integration adapters for staff portal — replace no-op implementations
 * when external systems are connected.
 */

import { fetchMyPayslips } from '@/services/payroll';

export type BiometricPunch = {
  checkIn: string | null;
  checkOut: string | null;
  device: string;
  status: string;
};

export interface BiometricDeviceAdapter {
  fetchTodayPunch(staffProfileId: string): Promise<BiometricPunch | null>;
}

export interface GoogleCalendarAdapter {
  syncEvents(staffProfileId: string, from: Date, to: Date): Promise<unknown[]>;
}

export interface PayrollAdapter {
  fetchLatestPayslip(staffProfileId: string): Promise<{ url: string; month: string } | null>;
}

export interface NotificationChannelAdapter {
  sendSms(to: string, message: string): Promise<void>;
  sendWhatsApp(to: string, message: string): Promise<void>;
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

export interface LmsAdapter {
  openCourse(courseId: string): string;
}

export interface LibraryAdapter {
  openAccount(staffProfileId: string): string;
}

const noopBiometric: BiometricDeviceAdapter = {
  async fetchTodayPunch() {
    return null;
  },
};

const noopCalendar: GoogleCalendarAdapter = {
  async syncEvents() {
    return [];
  },
};

const payrollAdapter: PayrollAdapter = {
  async fetchLatestPayslip(staffProfileId: string) {
    void staffProfileId;
    const payslips = await fetchMyPayslips();
    const latest = payslips[0];
    if (!latest) return null;
    return {
      url: latest.pdfPath ?? `/v1/staff/me/payroll/payslips/${latest.id}/pdf`,
      month: `${latest.month}/${latest.year}`,
    };
  },
};

const noopNotifications: NotificationChannelAdapter = {
  async sendSms() {},
  async sendWhatsApp() {},
  async sendEmail() {},
};

const noopLms: LmsAdapter = {
  openCourse(courseId) {
    return `/staff/academic/subjects?course=${courseId}`;
  },
};

const noopLibrary: LibraryAdapter = {
  openAccount() {
    return '/staff/documents';
  },
};

export const staffPortalIntegrations = {
  biometric: noopBiometric,
  googleCalendar: noopCalendar,
  payroll: payrollAdapter,
  notifications: noopNotifications,
  lms: noopLms,
  library: noopLibrary,
};

export function registerStaffPortalIntegration<K extends keyof typeof staffPortalIntegrations>(
  key: K,
  adapter: (typeof staffPortalIntegrations)[K],
) {
  staffPortalIntegrations[key] = adapter;
}
