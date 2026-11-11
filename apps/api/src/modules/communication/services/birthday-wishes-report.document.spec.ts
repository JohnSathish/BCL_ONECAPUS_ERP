jest.mock('puppeteer', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}));

import {
  buildBirthdayWishesReportHtml,
  formatReportIst,
  summarizeBirthdayReport,
  type BirthdayReportRow,
} from './birthday-wishes-report.document';

const rows: BirthdayReportRow[] = [
  {
    recipientName: 'NISILINA M SANGMA',
    category: 'Student',
    channel: 'EMAIL',
    status: 'SENT',
    sentAt: '2026-11-11T06:22:34.738Z',
    sentBy: 'Automatic',
  },
  {
    recipientName: 'NISILINA M SANGMA',
    category: 'Student',
    channel: 'PUSH',
    status: 'SENT',
    sentAt: '2026-11-11T06:22:31.762Z',
    sentBy: 'Automatic',
  },
  {
    recipientName: 'NISILINA M SANGMA',
    category: 'Student',
    channel: 'IN_APP',
    status: 'DELIVERED',
    sentAt: '2026-11-11T06:22:31.448Z',
    sentBy: 'Automatic',
  },
  {
    recipientName: 'Mrs. Rubitha A Sangma',
    category: 'Staff',
    channel: 'PUSH',
    status: 'FAILED',
    sentAt: '2026-11-11T06:22:38.508Z',
    sentBy: 'Automatic',
    failureReason: 'Device token was rejected',
  },
];

describe('birthday wishes report', () => {
  it('prints the send time in IST', () => {
    expect(formatReportIst('2026-11-11T06:22:45.945Z')).toBe(
      '11 Nov 2026, 11:52:45 AM',
    );
  });

  it('counts recipients, successes, and push failures separately', () => {
    expect(summarizeBirthdayReport(rows)).toMatchObject({
      recipients: 2,
      records: 4,
      students: 1,
      staff: 1,
      emailSent: 1,
      pushSent: 1,
      pushFailed: 1,
      inAppDelivered: 1,
      successful: 3,
      failed: 1,
      sendingMode: 'Automatic',
    });
  });

  it('splits students and staff and keeps the failure reason', () => {
    const html = buildBirthdayWishesReportHtml({
      collegeName: 'Don Bosco College, Tura',
      logoDataUri: null,
      rows,
      generatedAt: new Date('2026-11-11T06:57:00.000Z'),
    });
    expect(html).toContain('Student birthdays');
    expect(html).toContain('Staff birthdays');
    expect(html).toContain('11 Nov 2026, 11:52:34 AM');
    expect(html).not.toContain('2026-11-11T06:22');
    expect(html).toContain('Device token was rejected');
    expect(html).toContain('Birthday Wishes Delivery Report');
  });
});
