import { preload } from 'react-dom';
import {
  HomepageCoatOfArms,
  HomepageResearchAndLinks,
  HomepageSectionRenderer,
} from '@/components/homepage/section-registry';
import { FlashNewsTickerSection } from '@/components/flash-news-ticker-section';
import { WebsitePopupManagerLazy } from '@/components/homepage/website-popup-manager-lazy';
import { getCollegeContent } from '@/lib/content';
import { listAcademicDepartments } from '@/lib/academic-departments';
import { getHeroSlides } from '@/lib/hero-slides';
import { getHomepage, getUpcomingEvents } from '@/lib/homepage';
import { getActiveHomePopups } from '@/lib/popups';
import { isRecord } from '@/lib/cms-client';
import { normalizeEventCategory, type HubEvent } from '@/lib/information-hub';

export default async function HomePage() {
  const [content, academicDepartments, heroSlides, homepage, upcoming, activePopups] =
    await Promise.all([
      getCollegeContent(),
      listAcademicDepartments(),
      getHeroSlides(),
      getHomepage(),
      getUpcomingEvents(),
      getActiveHomePopups(),
    ]);

  const firstSlide = heroSlides[0];
  if (firstSlide) {
    const desktop = firstSlide.desktopSrc;
    const mobile = firstSlide.mobileSrc || firstSlide.desktopSrc;
    if (mobile !== desktop) {
      preload(mobile, { as: 'image', fetchPriority: 'high', media: '(max-width: 760px)' });
      preload(desktop, { as: 'image', fetchPriority: 'high', media: '(min-width: 761px)' });
    } else {
      preload(desktop, { as: 'image', fetchPriority: 'high' });
    }
  }

  const cmsEvents: HubEvent[] = [];
  for (const row of upcoming) {
    if (!isRecord(row) || typeof row.title !== 'string' || typeof row.id !== 'string') continue;
    cmsEvents.push({
      id: row.id,
      title: row.title,
      date:
        typeof row.date === 'string'
          ? row.date.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      category: normalizeEventCategory(typeof row.category === 'string' ? row.category : undefined),
      href: typeof row.href === 'string' ? row.href : undefined,
      registrationHref: typeof row.registrationUrl === 'string' ? row.registrationUrl : undefined,
    });
  }

  const hub = {
    ...content.informationHub,
    upcomingEvents: cmsEvents.length ? cmsEvents : content.informationHub.upcomingEvents,
    notices: content.informationHub.notices,
    noticesHref: '/notices',
  };

  const sections = (homepage?.sections ?? [])
    .filter((section) => section.enabled)
    .filter((section) => section.sectionKey !== 'upcomingEvents');

  if (!sections.length) {
    // Fallback composition when homepage layout API is unavailable
    return (
      <>
        <main id="main">
          <HomepageSectionRenderer
            section={{
              id: 'hero',
              sectionKey: 'hero',
              label: 'Hero',
              enabled: true,
              position: 0,
              settings: {},
              payload: {},
            }}
            content={content}
            academicDepartments={academicDepartments}
            heroSlides={heroSlides}
            hub={hub}
          />
          <FlashNewsTickerSection />
          <HomepageSectionRenderer
            section={{
              id: 'aboutCollege',
              sectionKey: 'aboutCollege',
              label: 'About',
              enabled: true,
              position: 1,
              settings: {},
              payload: {},
            }}
            content={content}
            academicDepartments={academicDepartments}
            heroSlides={heroSlides}
            hub={hub}
          />
          <HomepageSectionRenderer
            section={{
              id: 'principalMessage',
              sectionKey: 'principalMessage',
              label: 'Principal',
              enabled: true,
              position: 2,
              settings: {},
              payload: {},
            }}
            content={content}
            academicDepartments={academicDepartments}
            heroSlides={heroSlides}
            hub={hub}
          />
          <HomepageSectionRenderer
            section={{
              id: 'noticeBoard',
              sectionKey: 'noticeBoard',
              label: 'Notices',
              enabled: true,
              position: 3,
              settings: {},
              payload: {},
            }}
            content={content}
            academicDepartments={academicDepartments}
            heroSlides={heroSlides}
            hub={hub}
          />
          <HomepageCoatOfArms content={content.homepageCms.coatOfArms} />
          <HomepageSectionRenderer
            section={{
              id: 'departments',
              sectionKey: 'departments',
              label: 'Departments',
              enabled: true,
              position: 4,
              settings: {},
              payload: {},
            }}
            content={content}
            academicDepartments={academicDepartments}
            heroSlides={heroSlides}
            hub={hub}
          />
          <HomepageSectionRenderer
            section={{
              id: 'campusLife',
              sectionKey: 'campusLife',
              label: 'Why Choose Us',
              enabled: true,
              position: 5,
              settings: {},
              payload: {},
            }}
            content={content}
            academicDepartments={academicDepartments}
            heroSlides={heroSlides}
            hub={hub}
          />
          <HomepageSectionRenderer
            section={{
              id: 'studentSupport',
              sectionKey: 'studentSupport',
              label: 'Student Support & Activities',
              enabled: true,
              position: 6,
              settings: {},
              payload: {},
            }}
            content={content}
            academicDepartments={academicDepartments}
            heroSlides={heroSlides}
            hub={hub}
          />
          <HomepageSectionRenderer
            section={{
              id: 'shortTermCourses',
              sectionKey: 'shortTermCourses',
              label: 'Short Term Courses',
              enabled: true,
              position: 7,
              settings: {},
              payload: {},
            }}
            content={content}
            academicDepartments={academicDepartments}
            heroSlides={heroSlides}
            hub={hub}
          />
          <HomepageSectionRenderer
            section={{
              id: 'news',
              sectionKey: 'news',
              label: 'News',
              enabled: true,
              position: 8,
              settings: {},
              payload: {},
            }}
            content={content}
            academicDepartments={academicDepartments}
            heroSlides={heroSlides}
            hub={hub}
          />
          <HomepageSectionRenderer
            section={{
              id: 'gallery',
              sectionKey: 'gallery',
              label: 'Gallery',
              enabled: true,
              position: 9,
              settings: {},
              payload: {},
            }}
            content={content}
            academicDepartments={academicDepartments}
            heroSlides={heroSlides}
            hub={hub}
          />
          <HomepageResearchAndLinks content={content.homepageCms.researchLinks} />
          <HomepageSectionRenderer
            section={{
              id: 'testimonials',
              sectionKey: 'testimonials',
              label: 'Testimonials',
              enabled: true,
              position: 10,
              settings: {},
              payload: {},
            }}
            content={content}
            academicDepartments={academicDepartments}
            heroSlides={heroSlides}
            hub={hub}
          />
          <HomepageSectionRenderer
            section={{
              id: 'placement',
              sectionKey: 'placement',
              label: 'Placement',
              enabled: true,
              position: 11,
              settings: {},
              payload: {},
            }}
            content={content}
            academicDepartments={academicDepartments}
            heroSlides={heroSlides}
            hub={hub}
          />
        </main>
        <WebsitePopupManagerLazy popups={activePopups} />
      </>
    );
  }

  return (
    <>
      <main id="main">
        {sections
          .map((section) => (
            <HomepageSectionRenderer
              key={section.id}
              section={section}
              content={content}
              academicDepartments={academicDepartments}
              heroSlides={heroSlides}
              hub={hub}
            />
          ))
          .flatMap((node, index) => {
            const section = sections[index];
            // Place announcements ticker immediately after the hero.
            if (section?.sectionKey === 'hero') {
              return [node, <FlashNewsTickerSection key="flash-announcements" />];
            }
            return [node];
          })}
      </main>
      <WebsitePopupManagerLazy popups={activePopups} />
    </>
  );
}
