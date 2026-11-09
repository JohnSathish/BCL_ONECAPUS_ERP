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

  it('rotates only notices that have a jpg, png, or webp', () => {
    const payload = buildNoticeboardPayload({
      notices,
      announcements: [],
      events: [],
      now,
    });

    expect(payload.banners.map((row) => row.imageUrl)).toEqual([
      '/uploads/admit-card.png',
      '/uploads/career.WEBP?v=1',
    ]);
    expect(payload.banners[0]).toMatchObject({
      title: 'Semester examination admit cards',
      priority: 'URGENT',
      durationMs: 20_000,
    });
    expect(payload.notices.map((row) => row.id)).toEqual([
      'urgent',
      'photo',
      'normal',
    ]);
    expect(payload.notices.find((row) => row.id === 'normal')?.hasImage).toBe(
      false,
    );
  });

  it('ignores inline data images and keeps each uploaded image once', () => {
    const payload = buildNoticeboardPayload({
      notices: [
        {
          id: 'dup',
          title: 'Two photos',
          slug: 'two-photos',
          priority: 'NORMAL',
          publishAt: '2026-11-08T00:00:00.000Z',
          bodyHtml:
            '<img src="data:image/png;base64,abc"><img src="/uploads/a.jpg"><img src="/uploads/a.jpg"><img src="/uploads/b.jpeg">',
        },
      ],
      announcements: [],
      events: [],
      now,
    });

    expect(payload.banners.map((row) => row.id)).toEqual(['dup-1', 'dup-2']);
    expect(payload.banners.map((row) => row.imageUrl)).toEqual([
      '/uploads/a.jpg',
      '/uploads/b.jpeg',
    ]);
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
