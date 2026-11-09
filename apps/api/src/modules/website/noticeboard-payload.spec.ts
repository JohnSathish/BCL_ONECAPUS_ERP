import { buildNoticeboardPayload } from './noticeboard-payload';

const now = new Date('2026-11-09T05:00:00.000Z');

describe('buildNoticeboardPayload', () => {
  const notices = [
    {
      id: 'normal',
      title: 'Library clearance',
      slug: 'library-clearance',
      category: 'ACADEMIC',
      priority: 'NORMAL',
      publishAt: '2026-11-04T00:00:00.000Z',
      bodyHtml: '<p>Collect the admit card after clearance.</p>',
      attachments: [{ url: '/uploads/library.pdf', name: 'library.pdf' }],
    },
    {
      id: 'urgent',
      title: 'Semester examination admit cards',
      slug: 'admit-cards',
      category: 'EXAMINATION',
      priority: 'URGENT',
      publishAt: '2026-11-06T00:00:00.000Z',
      bodyHtml:
        '<p>Collect admit cards from the college office.</p><img src="/uploads/admit-card.png" alt="Admit card">',
      attachments: [{ url: '/uploads/notice.pdf', name: 'notice.pdf' }],
    },
    {
      id: 'photo',
      title: 'Career guidance',
      slug: 'career-guidance',
      category: 'GENERAL',
      priority: 'IMPORTANT',
      publishAt: '2026-11-01T00:00:00.000Z',
      bodyHtml: '<p>Session for final-year students.</p>',
      attachmentUrl: '/uploads/career.WEBP?v=1',
    },
  ];

  it('keeps PDF notices in the text list and does not use them as banners', () => {
    const payload = buildNoticeboardPayload({
      notices,
      announcements: [],
      events: [],
      now,
    });

    expect(payload.banners).toEqual([]);
    expect(payload.notices.map((row) => row.id)).toEqual([
      'urgent',
      'photo',
      'normal',
    ]);
    expect(payload.notices.every((row) => row.hasImage === false)).toBe(true);
  });

  it('rotates only images uploaded in Image Notices', () => {
    const payload = buildNoticeboardPayload({
      notices,
      imageNotices: [
        {
          id: 'slide-pdf',
          title: 'Not an image',
          imageUrl: '/uploads/notice.pdf',
        },
        {
          id: 'slide-1',
          title: 'College week',
          caption: '10–15 August',
          imageUrl: '/uploads/college-week.png',
          createdAt: '2026-11-08T00:00:00.000Z',
        },
        {
          id: 'slide-2',
          title: 'Admissions',
          imageUrl: '/uploads/admissions.WEBP?v=1',
        },
      ],
      announcements: [],
      events: [],
      now,
    });

    expect(payload.banners.map((row) => row.imageUrl)).toEqual([
      '/uploads/college-week.png',
      '/uploads/admissions.WEBP?v=1',
    ]);
    expect(payload.banners[0]).toMatchObject({
      title: 'College week',
      excerpt: '10–15 August',
      durationMs: 15_000,
    });
  });

  it('uses ticker announcements, then important notice titles', () => {
    const withTicker = buildNoticeboardPayload({
      notices,
      announcements: [{ id: 'ann-1', title: 'Fee payment reminder' }],
      events: [],
      now,
    });
    expect(withTicker.ticker).toEqual([
      { id: 'ann-1', text: 'Fee payment reminder' },
    ]);

    const fallback = buildNoticeboardPayload({
      notices,
      announcements: [{ id: 'blank', title: '   ' }],
      events: [],
      now,
    });
    expect(fallback.ticker.map((row) => row.text)).toEqual([
      'Semester examination admit cards',
      'Career guidance',
    ]);
  });

  it('keeps calendar time and venue and drops events past the display cap', () => {
    const events = Array.from({ length: 8 }, (_, index) => ({
      id: `event-${index}`,
      title: `Event ${index}`,
      date: `2026-11-${String(10 + index).padStart(2, '0')}`,
      category: 'SEMINAR',
      startTime: '10:00',
      endTime: '12:00',
      venue: 'Conference hall',
      isAllDay: false,
    }));
    const payload = buildNoticeboardPayload({
      notices: [],
      announcements: [],
      events,
      now,
    });
    expect(payload.events).toHaveLength(6);
    expect(payload.events[0]).toMatchObject({
      startTime: '10:00',
      venue: 'Conference hall',
      isAllDay: false,
    });
  });
});
