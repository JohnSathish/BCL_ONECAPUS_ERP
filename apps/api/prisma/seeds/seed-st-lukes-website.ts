import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  SCHOOL_WEB_PERMISSION_ENQUIRIES,
  SCHOOL_WEB_PERMISSION_MANAGE,
  SCHOOL_WEB_PERMISSION_MEDIA,
  SCHOOL_WEB_PERMISSION_PUBLISH,
  SCHOOL_WEB_PERMISSION_READ,
} from '../../src/modules/school-web/school-web.constants';

const MOTTO = 'Knowledge · Service · Light';

function blocks(paragraphs: string[]) {
  return {
    version: 1,
    blocks: paragraphs.map((text) => ({ type: 'paragraph', text })),
  };
}

export const SCHOOL_WEB_PERMISSIONS = [
  {
    slug: SCHOOL_WEB_PERMISSION_READ,
    resource: 'website',
    action: 'read',
    description: 'View St. Luke’s school website CMS',
  },
  {
    slug: SCHOOL_WEB_PERMISSION_MANAGE,
    resource: 'website',
    action: 'manage',
    description: 'Manage St. Luke’s school website CMS',
  },
  {
    slug: SCHOOL_WEB_PERMISSION_PUBLISH,
    resource: 'website',
    action: 'publish',
    description: 'Publish St. Luke’s website pages and notices',
  },
  {
    slug: SCHOOL_WEB_PERMISSION_MEDIA,
    resource: 'website',
    action: 'media',
    description: 'Upload St. Luke’s website media',
  },
  {
    slug: SCHOOL_WEB_PERMISSION_ENQUIRIES,
    resource: 'website',
    action: 'enquiries',
    description: 'Read St. Luke’s website contact inbox',
  },
] as const;

const SITE_IDENTITY = {
  displayName: "St. Luke's Secondary School, Tura",
  shortName: 'SLS Tura',
  motto: MOTTO,
  addressLine: 'Walbakgre, P.O. Dakopgre, Tura – 794101',
  city: 'Tura',
  district: 'West Garo Hills',
  state: 'Meghalaya',
  pin: '794101',
  email: 'admin@stlukestura.in' as string | null,
  phone: null as string | null,
  primaryColor: '#163a6b',
  accentColor: '#e6b325',
  seoTitle: "St. Luke's Secondary School, Tura | Official Website",
  seoDescription:
    "Official website of St. Luke's Secondary School, Walbakgre, P.O. Dakopgre, Tura – 794101, West Garo Hills, Meghalaya. Academic information, admissions, notices, events and contact for the school office.",
  applyCtaUrl: '/apply',
  studentPortalUrl: 'https://erp.stlukestura.in',
  extrasJson: {
    source: 'School handbook and official identity',
    contactNote: 'Phone will be published when the school confirms it.',
    logoUrl: '/school-sis/st-lukes-logo.png',
    campusImage: '/school-sis/campus-hero.jpg',
    innerHero: {
      enabled: true,
      backgroundImage: '/school-sis/campus-hero.jpg',
      decorativeText: 'Education for a Better Tomorrow',
      overlay: 0.58,
    },
    principal: {
      name: 'Fr. Bromith Bernard G. Sangma',
      title: 'Principal',
      school: 'St. Luke’s Higher Secondary School, Walbakgre',
      photoUrl: '/school-sis/principal-fr-bromith.jpg',
      photoAlt: 'Fr. Bromith Bernard G. Sangma, Principal',
      photoPosition: '50% 18%',
      kicker: 'MESSAGE FROM THE PRINCIPAL',
      heading: 'Message of the Principal',
      ctaLabel: "Read the Principal's Message",
      ctaHref: '/principal',
      greeting: 'Dear Students, Parents, and Well-Wishers,',
      excerpt:
        'Established in 2009, St. Luke’s has grown to nearly 800 students. In 2026 we opened Class XI and launched the St. Luke’s Taekwondo Academy, now among the strongest in Garo Hills.',
    },
    establishedYear: '2009',
    establishedLabel: 'ESTABLISHED',
    establishedCaption: 'Knowledge · Service · Light',
    officeHours: '9:00 a.m. to 2:30 p.m.',
    schoolHours:
      'Nursery & K.G.: 9:00 a.m. to 12:10 noon. Class I to Class X: 9:00 a.m. to 2:30 p.m. Office: 9:00 a.m. to 2:30 p.m.',
    scriptureQuote: 'Let your light shine before others.',
    scriptureAttribution: 'Matthew 5:16',
    footerBlurb:
      'A Catholic school of St. Luke’s Parish, Diocese of Tura, forming pupils who are open and committed to God and to one another — Knowledge · Service · Light.',
    newsletterIntro:
      'Subscribe to receive the latest news, updates and event information from St. Luke’s.',
    seo: {
      publicBaseUrl: 'https://stlukestura.in',
      country: 'India',
      defaultOgImage: '/school-sis/st-lukes-logo.png',
      googleMapsUrl: 'https://maps.app.goo.gl/Qw4TGRgL1CpX76tw7',
      latitude: '25.5179091',
      longitude: '90.1719162',
    },
    secondaryColor: '#6aa84f',
    ribbonColor: '#163a6b',
  },
};

export async function seedStLukesWebsite(
  prisma: PrismaClient,
  tenantId: string,
) {
  await prisma.schoolWebSite.upsert({
    where: { tenantId },
    update: SITE_IDENTITY,
    create: { tenantId, ...SITE_IDENTITY },
  });

  type MenuItemSeed = {
    label: string;
    href: string;
    children?: { label: string; href: string }[];
  };
  const menus: { location: string; items: MenuItemSeed[] }[] = [
    {
      location: 'MAIN',
      items: [
        { label: 'Home', href: '/' },
        {
          label: 'About',
          href: '/about',
          children: [
            { label: 'About the School', href: '/about' },
            { label: 'History', href: '/history' },
            { label: 'Vision & Mission', href: '/vision-mission' },
            { label: 'Principal', href: '/principal' },
            { label: 'Administration', href: '/administration' },
            { label: 'Faculty & Staff', href: '/faculty' },
            { label: 'Rules & Conduct', href: '/rules' },
          ],
        },
        {
          label: 'Academics',
          href: '/academics',
          children: [
            { label: 'Classes', href: '/academics' },
            { label: 'Curriculum', href: '/curriculum' },
            { label: 'Examinations', href: '/examinations' },
            { label: 'Timetable', href: '/timetable' },
          ],
        },
        { label: 'Admissions', href: '/admissions' },
        {
          label: 'Student Life',
          href: '/student-life',
          children: [
            { label: 'Activities', href: '/student-life' },
            { label: 'Sports', href: '/sports' },
            { label: 'Facilities', href: '/facilities' },
          ],
        },
        { label: 'Gallery', href: '/gallery' },
        { label: 'Notices', href: '/notices' },
        { label: 'Events', href: '/events' },
        { label: 'Contact', href: '/contact' },
      ],
    },
    {
      location: 'FOOTER',
      items: [
        { label: 'About St. Luke’s', href: '/about' },
        { label: 'Academics', href: '/academics' },
        { label: 'Admissions', href: '/admissions' },
        { label: 'Fee structure', href: '/fees' },
        { label: 'Notice Board', href: '/notices' },
        { label: 'Events', href: '/events' },
        { label: 'Parent Corner', href: '/parent-corner' },
        { label: 'Gallery', href: '/gallery' },
        { label: 'School ERP', href: 'https://erp.stlukestura.in' },
        { label: 'Contact', href: '/contact' },
      ],
    },
    {
      location: 'QUICK',
      items: [
        { label: 'Apply Now', href: '/apply' },
        { label: 'Discover Our School', href: '/about' },
      ],
    },
  ];

  for (const menu of menus) {
    const row = await prisma.schoolWebMenu.upsert({
      where: { tenantId_location: { tenantId, location: menu.location } },
      update: {},
      create: { tenantId, location: menu.location },
    });
    await prisma.schoolWebMenuItem.deleteMany({ where: { menuId: row.id } });
    let order = 0;
    for (const item of menu.items) {
      const parentId = randomUUID();
      await prisma.schoolWebMenuItem.create({
        data: {
          id: parentId,
          menuId: row.id,
          label: item.label,
          href: item.href,
          sortOrder: order++,
          visible: true,
        },
      });
      for (const child of item.children ?? []) {
        await prisma.schoolWebMenuItem.create({
          data: {
            id: randomUUID(),
            menuId: row.id,
            parentId,
            label: child.label,
            href: child.href,
            sortOrder: order++,
            visible: true,
          },
        });
      }
    }
  }

  const homepage: {
    key: string;
    sortOrder: number;
    payload: Record<string, unknown>;
  }[] = [
    {
      key: 'hero',
      sortOrder: 10,
      payload: {
        kicker: "WELCOME TO ST. LUKE'S",
        title: 'Knowledge · Service · Light',
        lede: 'St. Luke’s Secondary School, Walbakgre, P.O. Dakopgre, Tura – 794101.',
        primaryCta: { label: 'Apply Now', href: '/apply' },
        secondaryCta: { label: 'About the School', href: '/about' },
        location: 'Walbakgre, P.O. Dakopgre, Tura · West Garo Hills, Meghalaya',
        slides: [
          {
            enabled: true,
            kicker: 'PARENTS’ DAY & SCHOOL DAY',
            title: 'A school family, gathered.',
            text: 'Photographs from Parents’ Day cum School Day at St. Luke’s Secondary School, Walbakgre.',
            image: '/school-sis/slider/sl1.jpg',
            ctaLabel: 'Student life',
            ctaHref: '/student-life',
          },
          {
            enabled: true,
            kicker: 'ST. LUKE’S, TURA',
            title: 'Knowledge · Service · Light',
            text: 'A Catholic school of St. Luke’s Parish, Diocese of Tura, educating children at Walbakgre since 2009.',
            image: '/school-sis/slider/sl2.jpg',
            ctaLabel: 'About the School',
            ctaHref: '/about',
          },
          {
            enabled: true,
            kicker: 'HIGHER SECONDARY',
            title: 'Class XI opened in 2026.',
            text: 'The school now offers the Higher Secondary section, with nearly 800 students from Nursery through Class XI.',
            image: '/school-sis/slider/sl3.jpg',
            ctaLabel: 'Academics',
            ctaHref: '/academics',
          },
          {
            enabled: true,
            kicker: 'ADMISSIONS',
            title: 'Begin the journey at St. Luke’s.',
            text: 'New admissions are made mainly to Nursery. Other classes depend on vacant seats. Visit the office during school hours.',
            image: '/school-sis/slider/sl4.jpg',
            ctaLabel: 'Admission information',
            ctaHref: '/admissions',
          },
          {
            enabled: true,
            kicker: 'OUR CAMPUS',
            title: 'St. Luke’s Secondary School, Walbakgre.',
            text: 'The school family gathered at the campus entrance, Walbakgre, Tura.',
            image: '/school-sis/slider/sl5.jpg',
            ctaLabel: 'About the School',
            ctaHref: '/about',
          },
        ],
      },
    },
    {
      key: 'flashNews',
      sortOrder: 15,
      payload: {
        label: 'FLASH NEWS',
        items: [
          {
            id: 'flash-xi',
            title: 'Admissions for Class XI are now open!',
            href: '/admissions',
            icon: 'admissions',
            isNew: true,
            enabled: true,
          },
          {
            id: 'flash-ptm',
            title: 'PTM on 16 September 2026',
            href: '/notices',
            icon: 'calendar',
            enabled: true,
          },
          {
            id: 'flash-exam',
            title: 'Half-Yearly Examination Schedule Released',
            href: '/examinations',
            icon: 'exam',
            enabled: true,
          },
          {
            id: 'flash-reopen',
            title: 'School Re-opens on 5 October 2026',
            href: '/notices',
            icon: 'people',
            enabled: true,
          },
        ],
      },
    },
    {
      key: 'pillars',
      sortOrder: 20,
      payload: {
        items: [
          { n: '2009', title: 'Parish at Walbakgre' },
          { n: '800', title: 'Students in the school family' },
          { n: 'XI', title: 'Higher Secondary from 2026' },
          { n: '500+', title: 'Taekwondo Academy enrolment' },
        ],
        footer:
          'Knowledge · Service · Light — St. Luke’s Parish, Diocese of Tura',
      },
    },
    {
      key: 'about',
      sortOrder: 30,
      payload: {
        kicker: 'ABOUT OUR SCHOOL',
        title: 'Education that shapes the whole person.',
        body: [
          'St. Luke’s Secondary School is a Catholic institution managed by St. Luke’s Parish under the Diocese of Tura. The school stands at Walbakgre, P.O. Dakopgre, Tura – 794101.',
          'The handbook states our aim: to develop the individual personality of each pupil and bring out the best and noblest qualities, so that they grow into mature persons open and committed both to God and to one another.',
        ],
        cta: { label: 'Discover Our School', href: '/about' },
        bandLine: 'A brighter future',
        highlights: [
          { n: '01', title: 'Knowledge', text: 'Quality classroom learning' },
          {
            n: '02',
            title: 'Service',
            text: 'Love and service, as in our anthem',
          },
          { n: '03', title: 'Light', text: 'Faith, character and discipline' },
          {
            n: '04',
            title: 'Parish',
            text: 'St. Luke’s Parish, Diocese of Tura',
          },
        ],
      },
    },
    {
      key: 'explore',
      sortOrder: 40,
      payload: {
        kicker: "EXPLORE ST. LUKE'S",
        title: "Discover Life at St. Luke's",
        intro:
          'Classes from Nursery to Class XI, sports, academics, facilities on campus, and official notices for families.',
        cards: [
          {
            enabled: true,
            icon: 'cap',
            imageUrl: '/school-sis/explore/academics.jpg',
            kicker: 'LEARNING',
            title: 'Academics',
            body: 'Curriculum, examinations, academic resources and important updates for students and parents.',
            href: '/academics',
            cta: 'Explore Academics',
          },
          {
            enabled: true,
            icon: 'bell',
            imageUrl: '/school-sis/explore/notices.jpg',
            kicker: 'STAY INFORMED',
            title: 'Notice Board',
            body: 'School announcements, circulars, events, holidays and other important information.',
            href: '/notices',
            cta: 'View Notices',
          },
          {
            enabled: true,
            icon: 'people',
            imageUrl: '/school-sis/explore/campus.jpg',
            kicker: 'BEYOND CLASSROOMS',
            title: 'Campus Life',
            body: 'Taekwondo, football, basketball and dance academies, plus compulsory football coaching for every child.',
            href: '/student-life',
            cta: 'Explore Campus Life',
          },
          {
            enabled: true,
            icon: 'building',
            imageUrl: '/school-sis/explore/facilities-campus.jpg',
            kicker: 'ON CAMPUS',
            title: 'Facilities',
            body: 'Taekwondo, football, basketball and dance academies, plus library, class rooms, grounds, auditorium, digital classroom and computer facilities.',
            href: '/facilities',
            cta: 'View Facilities',
          },
          {
            enabled: true,
            featured: true,
            icon: 'apply',
            imageUrl: '/school-sis/explore/admissions.jpg',
            kicker: 'JOIN OUR COMMUNITY',
            title: 'Admissions',
            body: 'For admissions, eligibility, dates, documents and fee details, families may contact the school office or apply online when a cycle is open.',
            href: '/apply',
            cta: 'Apply Now',
          },
        ],
        footerItems: [
          {
            icon: 'book',
            title: 'Nursery to Class XI',
            text: 'Higher Secondary from 2026',
          },
          {
            icon: 'people',
            title: 'Sports academies',
            text: 'Taekwondo · Football · Basketball · Dance',
          },
          {
            icon: 'sprout',
            title: 'Knowledge · Service · Light',
            text: 'Motto on the official emblem',
          },
        ],
      },
    },
    {
      key: 'campus',
      sortOrder: 50,
      payload: {
        kicker: 'OUR CAMPUS',
        title: 'A place where every day is an opportunity.',
        body: 'From the classroom to the playground and stage, our students learn to collaborate, express themselves and grow in confidence.',
        points: [
          'Learning beyond textbooks',
          'Sports & student activities',
          'Community & service',
        ],
        cta: { label: 'View Campus Life', href: '/campus-life' },
      },
    },
    {
      key: 'gallery',
      sortOrder: 60,
      payload: {
        kicker: 'FROM OUR SCHOOL',
        title: 'Moments that matter.',
        cta: { label: 'View Gallery', href: '/gallery' },
        captions: [
          'Learning together — student life at St. Luke’s',
          'Active & confident — sports and teamwork',
        ],
      },
    },
    {
      key: 'notices',
      sortOrder: 70,
      payload: {
        kicker: 'NEWS & NOTICES',
        title: 'Latest Announcements',
        intro:
          'Stay updated with the latest news, notices and important information from St. Luke’s Secondary School.',
        noticesCta: 'View All Notices',
        noticesHref: '/notices',
        noticeLimit: 3,
        eventsKicker: 'UPCOMING EVENTS',
        eventsTitle: 'Upcoming',
        eventsIntro:
          'Discover important dates, activities and events happening at St. Luke’s.',
        eventsEmpty:
          'No upcoming events. Upcoming events will appear here when the school publishes them.',
        eventsCta: 'View All Events',
        eventsHref: '/events',
        eventLimit: 3,
      },
    },
    {
      key: 'contact',
      sortOrder: 80,
      payload: {
        kicker: 'VISIT',
        title: 'Contact & location',
        intro:
          'School office hours are 9:00 a.m. to 2:30 p.m. The Principal may be met during school hours only. Admissions and school business are discussed in the school office, not on holidays or after hours.',
        officeHours: '9:00 a.m. to 2:30 p.m.',
        mapQuery: "St. Luke's Secondary School, Walbakgre, Tura",
        mapsUrl: 'https://maps.app.goo.gl/Qw4TGRgL1CpX76tw7',
        mapLat: '25.5179091',
        mapLng: '90.1719162',
        locationLabel: 'Our Location',
        directionsLabel: 'Get Directions',
        applyLabel: 'Apply Now',
        applyHref: '/apply',
        contactLabel: 'Contact the office',
        contactHref: '/contact',
        campusHref: '/gallery',
      },
    },
  ];

  for (const section of homepage) {
    await prisma.schoolWebHomepageSection.upsert({
      where: { tenantId_key: { tenantId, key: section.key } },
      update: {
        payload: section.payload,
        sortOrder: section.sortOrder,
        enabled: true,
      },
      create: {
        tenantId,
        key: section.key,
        enabled: true,
        sortOrder: section.sortOrder,
        payload: section.payload,
      },
    });
  }

  const pages: { slug: string; title: string; paragraphs: string[] }[] = [
    {
      slug: 'about',
      title: 'About the School',
      paragraphs: [
        'St. Luke’s Secondary School stands at Walbakgre, P.O. Dakopgre, Tura – 794101, West Garo Hills, Meghalaya. It is a Catholic institution managed by St. Luke’s Parish under the Diocese of Tura.',
        'The school motto, shown on the official emblem, is Knowledge · Service · Light. The crest carries an open book, a lamp and the Cross, with the banner Walbakgre – Tura.',
        'The Holy Cross Sisters began a pre-nursery at Walbakgre in 2006. St. Luke’s Parish was formed in 2009, and the school was named and inaugurated as St. Luke’s School in 2010. In 2026 the Higher Secondary section opened with Class XI, and the school now serves a family of nearly 800 students.',
        'Our aim, as written in the student handbook, is to develop the individual personality of the pupils and bring out the best and the noblest qualities in them, so that they become mature persons open and committed both to God and to one another.',
        'School anthem: “St. Luke’s our beloved school, Thine we will forever be, with happiness our hearts are full as praises loud we sing to thee. To life of love and service through, Thou lured us, lure us still. More of this work help us to do. Help us to do God’s Holy Will.”',
      ],
    },
    {
      slug: 'history',
      title: 'History',
      paragraphs: [
        'The Holy Cross Sisters, seeing the poor children in and around Walbakgre, decided to give free education to the smaller children. They started a pre-nursery school at Walbakgre in 2006 and continued it for two years. In the beginning, the school at Walbakgre was run by the Holy Cross Sisters.',
        'Fr. Victor Gorla was appointed the first Parish Priest of Walbakgre when it was bifurcated from Our Lady of the Rosary Parish, Araimile, in 2009. In 2010, under his care and guidance, Fr. Victor took up the same school. The school was established in 2010 and named St. Luke’s School. Fr. Victor was the first Principal. The basement of the present campus was approved in 2009, and the institution was formally inaugurated in 2010.',
        'Following the Diocese’s extension proposal in 2011, funds were secured in 2012 for construction of the first and second floors, which were completed by March 2014. The campus has grown through the generous contributions of donors, to whom the school remains grateful.',
        'Fr. Victor was transferred to St. Sebastian’s Church, Danakgre, in 2019. By then the school had reached Class 10.',
        'Rev. Fr. C.J. Jose (now Bishop Jose) took up the school as the second Principal in July 2019. Sisters of Mary Immaculate (SMI) also came to work in the school in the same year. In 2020 the first batch of Matriculation students appeared for the examination: five students, all of whom came out with a good result. When Pope Francis appointed Fr. C.J. Jose Auxiliary Bishop of Tura in February 2020, he vacated the post.',
        'Fr. Lyndoh T. Sangma came as the third Principal in 2020. The second batch of 14 students appeared for the Matriculation examination in 2021 and all were successful. In 2022, 19 students appeared; two did not succeed.',
        'Enrolment grew strongly, and the surrounding community asked for Higher Secondary classes, especially where families could not easily afford other institutions. The Diocese obtained approval from the Education Board to open Class XI. In 2026 the Higher Secondary section began. With pressure on existing classrooms, Class XI was first housed in the parish auditorium, and admissions were opened at accessible fees so that more local children could continue at St. Luke’s.',
        'Today St. Luke’s serves a school family of nearly 800 students from Nursery through Class XI. Further expansion of classrooms and sections remains necessary so the school can serve the growing demand of Walbakgre and the wider community.',
      ],
    },
    {
      slug: 'vision-mission',
      title: 'Vision & Mission',
      paragraphs: [
        'Motto: Knowledge · Service · Light.',
        'Aim of the institution (student handbook): St. Luke’s is a Catholic institution managed by the Diocese of Tura through St. Luke’s Parish. We exist to develop the individual personality of each pupil and to bring out the best and noblest qualities, forming mature persons open and committed both to God and to one another.',
        'Daily school life is framed by morning prayer, grace before meals, and prayer before leaving the campus, as printed in the handbook.',
      ],
    },
    {
      slug: 'principal',
      title: 'Message of the Principal',
      paragraphs: [
        'Dear Students, Parents, and Well-Wishers,',
        'It gives me immense pleasure to share the progress of St. Luke’s Higher Secondary School, Walbakgre. Established in 2009, the school has steadily risen to new heights with each passing year. Our consistent good results in the Matriculation examinations reflect the dedication of our teachers and the hard work of our students. The steady increase in admissions has brought our total strength close to 800 students today.',
        'This year, 2026, marks a proud milestone as we have opened the Higher Secondary Section with Class XI. The overwhelming response and number of admissions have filled me with great pride. We have also launched the St. Luke’s Taekwondo Academy, which now has the highest enrolment in the entire Garo Hills with over 500 students. Within just a few months of training, our students participated in district-level competitions and brought home many medals. In addition, we have introduced compulsory Football Coaching for all students, which has been received with great enthusiasm.',
        'Through these initiatives, the school is committed to providing holistic development and all-round growth opportunities to every child. As Principal, I am truly proud of our collective achievements and look forward to even greater progress in the years ahead. May St. Luke’s continue to grow and shine brighter.',
        'With best wishes,',
        'Fr. Bromith Bernard G. Sangma',
        'Principal',
        'St. Luke’s Higher Secondary School, Walbakgre',
      ],
    },
    {
      slug: 'administration',
      title: 'School Administration',
      paragraphs: [
        'School administration profiles are managed in the Website CMS and linked, where available, to the school staff register.',
      ],
    },
    {
      slug: 'faculty',
      title: 'Faculty & Staff',
      paragraphs: [
        'Teaching and non-teaching staff listed on this website are published from the Website CMS.',
        'Public biographies appear only when the office marks a staff profile as published.',
      ],
    },
    {
      slug: 'rules',
      title: 'School Rules & Code of Conduct',
      paragraphs: [
        'The following points are taken from the official student handbook. Families should read the printed handbook for the full text.',
        'Admission forms must be filled with utmost accuracy. Particulars, including the date of birth, cannot be changed later. An original Birth Certificate of the Child and a photocopy are required at admission.',
        'English is to be spoken as much as possible on the school premises. Mobile phones are strictly prohibited; violation attracts a fine of Rs. 300/- and confiscation of the device, which is not returned to the student.',
        'Smoking, chewing betel nut and tobacco in any form are forbidden on or near the campus. Damage to building or furniture is charged to the pupil responsible.',
        'Jewellery, decorative items, nail polish and long nails are not allowed. Boys must keep a proper haircut. A complete, clean uniform and black shoes are required on school days and whenever a student visits the campus.',
        'Boys: white shirt, grey half or full pants, black shoes. Girls: white shirt, grey skirt, black shoes.',
        'New admissions are made mainly to Nursery. Other classes depend on vacant seats and the child’s competence. The Principal may be met during school hours only. School business is not transacted on holidays or after school hours.',
        'Irregular attendance, habitual idleness, insubordination, disrespect to staff, or wilful damage of property may lead to withdrawal. The Principal’s decision is final in cases of dismissal.',
      ],
    },
    {
      slug: 'academics',
      title: 'Academics',
      paragraphs: [
        'St. Luke’s offers Nursery and K.G., Classes I to X, and from 2026 the Higher Secondary section beginning with Class XI.',
        'Nursery and K.G. attend from 9:00 a.m. to 12:10 noon. Classes I to X attend from 9:00 a.m. to 2:30 p.m.',
        'Subjects, curriculum notes, the academic calendar and examination information are published by the office through the Website CMS and the school ERP.',
      ],
    },
    {
      slug: 'curriculum',
      title: 'Curriculum',
      paragraphs: [
        'Curriculum details are maintained in the school ERP and may be summarised here by the office.',
      ],
    },
    {
      slug: 'examinations',
      title: 'Examinations',
      paragraphs: [
        'No examination or unit test is held for absentees before or after the scheduled time.',
        'Answer papers of the Final Examination are not shown to parents.',
        'A pupil who fails twice in the same class, or twice in three consecutive years, may be asked to withdraw.',
        'Students with outstanding dues are not permitted to sit examinations or receive results unless the Principal grants permission.',
        'Dates and notices are published on the notice board and, when entered, on this page.',
      ],
    },
    {
      slug: 'timetable',
      title: 'Timetable',
      paragraphs: [
        'Class and teacher timetables are maintained in the St. Luke’s School ERP.',
        'The public website does not replace the official class timetable. Families may view published information when the office releases it.',
      ],
    },
    {
      slug: 'admissions',
      title: 'Admissions',
      paragraphs: [
        'New admissions are made mainly to the Nursery class. Admission to other classes depends on vacant seats and the competence of the child.',
        'Parents must fill the admission form with utmost accuracy. An original Birth Certificate of the Child and a photocopy must be produced. The date of birth, once registered, cannot be changed.',
        'Fees for January and February are paid at admission. Monthly fees are due before the 10th of every month. A late fee of Rs. 20/- per month is charged after the due date. Fees once paid are not refundable. Fees are revised from time to time.',
        'School matters and admissions are discussed only in the school office, during office hours (9:00 a.m. to 2:30 p.m.). The Principal can be met during school hours only.',
        'Class XI fee heads for 2026–27 are recorded in the school ERP from the official fee workbook. Contact the office at Walbakgre, P.O. Dakopgre, Tura – 794101 for other classes.',
      ],
    },
    {
      slug: 'student-life',
      title: 'Student Life',
      paragraphs: [
        'St. Luke’s aims at the all-round growth of every child. Along with classroom learning, the school runs sports and cultural academies.',
        'St. Luke’s Taekwondo Academy has more than 500 students and the highest enrolment in Garo Hills. Pupils have already won medals at district competitions.',
        'Compulsory football coaching is given to all students through St. Luke’s Football Academy. Basketball coaching and dance classes are also offered.',
        'Activities, results and photographs are published as notices, events and gallery albums.',
      ],
    },
    {
      slug: 'sports',
      title: 'Sports',
      paragraphs: [
        'St. Luke’s Football Academy provides compulsory football coaching for every student.',
        'St. Luke’s Basketball Academy offers basketball coaching, with a basketball court on campus.',
        'St. Luke’s Taekwondo Academy trains more than 500 students and has recorded district-level medals.',
        'Sports items and a dedicated taekwondo coaching room are available on campus.',
      ],
    },
    {
      slug: 'facilities',
      title: 'Facilities Available at School',
      paragraphs: [
        'Taekwondo Coaching (St. Luke’s Taekwondo Academy). Football Coaching (St. Luke’s Football Academy). Basketball Coaching (St. Luke’s Basketball Academy). Dance Class (St. Luke’s Dance Academy).',
        'Library, Class Rooms, Football Field, Basket Ball Court, Childrens’ Park, Playroom for Kindergarten, Drinking water facilities, Auditorium, Taekwondo coaching room, Sports items, Digital classroom, and Computer facilities.',
      ],
    },
    {
      slug: 'campus-life',
      title: 'Campus Life',
      paragraphs: [
        'Campus photographs and events are published through the gallery and news systems.',
      ],
    },
    {
      slug: 'parent-corner',
      title: 'Parent Corner',
      paragraphs: [
        'Ordinary communication with parents is through the school handbook. Parents are asked to read the diary daily and to sign remarks made by the Principal or teachers.',
        'Please help your child to be regular and punctual; to take part in school activities; to complete homework; and to keep books and appearance neat.',
        'Seek an interview with the Principal or the class teacher from time to time, and attend Parent–Teacher Meetings organised by the school.',
        'Collect children immediately after school hours. The school is responsible for pupils on campus during school hours, not after they leave.',
        'Office hours: 9:00 a.m. to 2:30 p.m. The Principal can be met during school hours only. No school business is transacted on holidays or after school hours.',
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      paragraphs: [
        'St. Luke’s Secondary School',
        'Walbakgre, P.O. Dakopgre, Tura – 794101',
        'West Garo Hills, Meghalaya',
        'Office hours: 9:00 a.m. to 2:30 p.m. The Principal can be met during school hours only.',
        'School matters, admissions and other business are discussed only in the school office — not on holidays or after school hours.',
        'Office email and phone will be shown when the school confirms them in the Website CMS.',
      ],
    },
    {
      slug: 'fees',
      title: 'Fee structure',
      paragraphs: [
        'Fee information for St. Luke’s Secondary School is maintained by the school office and, for Class XI 2026–27, in the school ERP from the official fee workbook.',
        'This page will list academic year, class, fee components, totals and payment instructions when the office publishes them here so families can read the structure without opening a PDF.',
        'Until those figures are entered in the Website CMS, please contact the school office at Walbakgre, P.O. Dakopgre, Tura – 794101, or use Admissions and Apply Now.',
      ],
    },
    {
      slug: 'faq',
      title: 'Questions parents ask',
      paragraphs: [
        'Where is St. Luke’s Secondary School located? Walbakgre, P.O. Dakopgre, Tura – 794101, West Garo Hills, Meghalaya, India.',
        'What are the school hours? Nursery and K.G.: 9:00 a.m. to 12:10 noon. Class I to Class X: 9:00 a.m. to 2:30 p.m. Office: 9:00 a.m. to 2:30 p.m.',
        'How can I meet the Principal? During school hours only, through the school office.',
        'How can I apply for admission? New admissions are mainly to Nursery. Bring the original Birth Certificate of the Child. Contact the office during office hours.',
        'Where can I find the fee structure? See the Fee structure page. Class XI 2026–27 heads are recorded in the school ERP; other classes will be listed here when the office publishes them.',
        'Where are notices and events? The notice board and events pages publish official updates from the office.',
      ],
    },
  ];

  const pageSeo: Record<string, { title: string; description: string }> = {
    about: {
      title: 'About St. Luke’s Secondary School, Tura',
      description:
        'About St. Luke’s Secondary School at Walbakgre, P.O. Dakopgre, Tura – 794101, West Garo Hills, Meghalaya. Motto: Knowledge · Service · Light.',
    },
    history: {
      title: 'History of St. Luke’s Secondary School, Tura',
      description:
        'How St. Luke’s grew from a Holy Cross pre-nursery at Walbakgre in 2006 to a named school in 2010, Matriculation from 2020, and Class XI in 2026.',
    },
    'vision-mission': {
      title: 'Vision & mission | St. Luke’s Secondary School, Tura',
      description:
        'A Catholic school of St. Luke’s Parish, Diocese of Tura. Motto: Knowledge · Service · Light. Aim: to form mature pupils open to God and to one another.',
    },
    principal: {
      title: 'Message of the Principal | St. Luke’s Secondary School, Tura',
      description:
        'Message of the Principal, Fr. Bromith Bernard G. Sangma, St. Luke’s Higher Secondary School, Walbakgre.',
    },
    admissions: {
      title: 'St. Luke’s Secondary School Tura Admissions',
      description:
        'Admission information for St. Luke’s Secondary School, Walbakgre, Tura. Contact the office for eligibility, documents and dates, or apply online when a cycle is open.',
    },
    fees: {
      title: 'St. Luke’s School Tura Fee Structure',
      description:
        'Fee structure for St. Luke’s Secondary School, Tura. Published class-wise figures will appear here; until then contact the school office or see Admissions.',
    },
    academics: {
      title: 'Academics | St. Luke’s Secondary School, Tura',
      description:
        'Academic programmes at St. Luke’s Secondary School, Tura, including curriculum, examinations and timetable information published by the office.',
    },
    contact: {
      title: 'Contact St. Luke’s Secondary School, Tura',
      description:
        'Contact St. Luke’s Secondary School at Walbakgre, P.O. Dakopgre, Tura – 794101, West Garo Hills, Meghalaya. Send an enquiry to the school office.',
    },
    faq: {
      title: 'Questions parents ask | St. Luke’s Secondary School, Tura',
      description:
        'Answers about location, contact, admissions, fees and notices at St. Luke’s Secondary School, Tura, based on information published by the school.',
    },
    faculty: {
      title: 'Faculty | St. Luke’s Secondary School, Tura',
      description:
        'Faculty and staff at St. Luke’s Secondary School, Tura. Public profiles appear only when the office publishes them.',
    },
    gallery: {
      title: 'Gallery | St. Luke’s Secondary School, Tura',
      description:
        'Photographs from St. Luke’s Secondary School, Walbakgre, Tura.',
    },
  };

  const publishedAt = new Date();
  for (const page of pages) {
    const seo = pageSeo[page.slug];
    await prisma.schoolWebPage.upsert({
      where: { tenantId_slug: { tenantId, slug: page.slug } },
      update: {
        title: page.title,
        status: 'PUBLISHED',
        publishedAt,
        blockDocument: blocks(page.paragraphs),
        seoTitle:
          seo?.title || `${page.title} | St. Luke’s Secondary School, Tura`,
        seoDescription: seo?.description || null,
        seoJson: {
          title: seo?.title,
          description: seo?.description,
          canonicalPath: `/${page.slug}`,
          robotsIndex: true,
          robotsFollow: true,
          schemaType: 'WebPage',
          breadcrumbTitle: page.title,
          focusKeyword: seo?.title,
          ...(page.slug === 'principal'
            ? {
                hero: {
                  enabled: true,
                  eyebrow: 'OUR LEADERSHIP',
                  subtitle: 'Guiding today, for a brighter tomorrow.',
                  decorativeText: 'Education for a Better Tomorrow',
                },
              }
            : page.slug === 'about'
              ? {
                  hero: {
                    enabled: true,
                    eyebrow: 'ABOUT OUR SCHOOL',
                    subtitle: 'Discover our history, values and vision.',
                  },
                }
              : {}),
        },
      },
      create: {
        tenantId,
        slug: page.slug,
        title: page.title,
        status: 'PUBLISHED',
        publishedAt,
        blockDocument: blocks(page.paragraphs),
        seoTitle:
          seo?.title || `${page.title} | St. Luke’s Secondary School, Tura`,
        seoDescription: seo?.description || null,
        seoJson: {
          title: seo?.title,
          description: seo?.description,
          canonicalPath: `/${page.slug}`,
          robotsIndex: true,
          robotsFollow: true,
          schemaType: 'WebPage',
          breadcrumbTitle: page.title,
          ...(page.slug === 'principal'
            ? {
                hero: {
                  enabled: true,
                  eyebrow: 'OUR LEADERSHIP',
                  subtitle: 'Guiding today, for a brighter tomorrow.',
                  decorativeText: 'Education for a Better Tomorrow',
                },
              }
            : page.slug === 'about'
              ? {
                  hero: {
                    enabled: true,
                    eyebrow: 'ABOUT OUR SCHOOL',
                    subtitle: 'Discover our history, values and vision.',
                  },
                }
              : {}),
        },
      },
    });
  }

  const notices = [
    {
      slug: 'welcome-new-website',
      title: 'Welcome to the new St. Luke’s website',
      category: 'GENERAL',
      publishedAt: new Date('2025-09-01T00:00:00.000Z'),
      body: 'Our new online platform is currently being prepared.',
    },
    {
      slug: 'academic-information-updates',
      title: 'Academic information and school updates',
      category: 'ACADEMIC',
      publishedAt: new Date('2025-06-15T00:00:00.000Z'),
      body: 'Important academic information will appear here.',
    },
    {
      slug: 'school-activities-and-events',
      title: 'School activities and events',
      category: 'EVENT',
      publishedAt: new Date('2025-05-10T00:00:00.000Z'),
      body: 'Follow this section for upcoming programmes.',
    },
  ];

  for (const notice of notices) {
    await prisma.schoolWebNotice.upsert({
      where: { tenantId_slug: { tenantId, slug: notice.slug } },
      update: {
        title: notice.title,
        category: notice.category,
        body: notice.body,
        status: 'PUBLISHED',
        publishedAt: notice.publishedAt,
        featured: notice.slug === 'welcome-new-website',
      },
      create: {
        tenantId,
        slug: notice.slug,
        title: notice.title,
        category: notice.category,
        body: notice.body,
        status: 'PUBLISHED',
        publishedAt: notice.publishedAt,
        featured: notice.slug === 'welcome-new-website',
      },
    });
  }

  await prisma.schoolWebGalleryAlbum.upsert({
    where: { tenantId_slug: { tenantId, slug: 'moments-that-matter' } },
    update: {
      title: 'Moments that matter',
      published: true,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      publishedAt,
    },
    create: {
      tenantId,
      slug: 'moments-that-matter',
      title: 'Moments that matter',
      published: true,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      publishedAt,
      sortOrder: 1,
    },
  });

  const categories = [
    ['school-events', 'School Events'],
    ['college-events', 'College Events'],
    ['sports', 'Sports'],
    ['cultural-programs', 'Cultural Programs'],
    ['annual-day', 'Annual Day'],
    ['independence-day', 'Independence Day'],
    ['republic-day', 'Republic Day'],
    ['academic-activities', 'Academic Activities'],
    ['staff-activities', 'Staff Activities'],
    ['field-trips', 'Field Trips'],
    ['other-events', 'Other Events'],
  ];
  let catOrder = 0;
  for (const [slug, name] of categories) {
    await prisma.schoolWebGalleryCategory.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: { name, sortOrder: catOrder },
      create: { tenantId, slug, name, sortOrder: catOrder },
    });
    catOrder += 1;
  }
}
