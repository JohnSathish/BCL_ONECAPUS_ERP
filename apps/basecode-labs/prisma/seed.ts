import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const testimonials = [
  {
    name: 'Fr. Bivan Rodriques Mukhim',
    designation: 'Vice Provincial',
    organisation: 'Salesian Province of Guwahati',
    quote:
      'BaseCode Labs has redesigned the website of the Salesian Province of Guwahati and developed a dedicated mobile application for the platform. The new website features improved functionality, a well-structured design, and a user-friendly interface that enhances accessibility and navigation. The team demonstrated professionalism, technical expertise, and responsive communication throughout the project. I am very pleased with their work and dedication. Kudos to the team at BaseCode Labs for their excellent service.',
    photo: '/images/testimonials/fr-bivan-salesian.png',
    project: 'Province website and mobile app',
    industry: 'Diocese / Religious',
    website: 'https://donboscoguwahati.org/',
    displayOrder: 1,
  },
  {
    name: '(Dr.) Fr. Pius Varghese',
    designation: 'Principal',
    organisation: 'Don Bosco College of Teacher Education Tura',
    quote:
      'I have only great appreciation for BaseCode Labs company for their quick delivery of software products. Their outputs like website creation and updation are of global standards and purely professional. They are customer friendly and they deliver products on time. They are able to meet client satisfaction.',
    photo: '/images/testimonials/fr-pius.png',
    project: 'College website',
    industry: 'College',
    website: 'https://dbctetura.com/',
    displayOrder: 2,
  },
  {
    name: 'P. Bhowmik',
    designation: 'Principal',
    organisation: 'Tura Public School',
    quote:
      'BaseCode Labs delivered our website on time and exceeded our expectations. Professional, responsive and great to work with. Highly recommended for anyone looking for quality web development services.',
    photo: '/images/testimonials/p-bhowmik-tps.png',
    project: 'School website',
    industry: 'School',
    website: 'https://turapublicschool.com/',
    displayOrder: 3,
  },
  {
    name: 'Dr. Fr. Jogesh B. Sangma, SDB',
    designation: 'Principal',
    organisation: 'Don Bosco College Higher Sec. Section Tura',
    quote:
      'BaseCode Labs supported us with timely updates and a well-structured, user-friendly website experience. Their team was professional, responsive, and attentive to our requirements, ensuring smooth navigation and improved accessibility for our users. We appreciate their dedication and quality of service.',
    photo: '/images/testimonials/dr-fr-jogesh-sangma.png',
    project: 'Institution website',
    industry: 'Higher Secondary',
    website: 'https://dbchsstura.in/',
    displayOrder: 4,
  },
  {
    name: 'Tiana Tarin D. Arengh',
    designation: 'Principal',
    organisation: 'PASF - Abong Noga College',
    quote:
      'BaseCode Labs delivered a clear, modern website that reflects our institution and serves students and parents well. The team was professional, listened to our needs, and completed the work on schedule. Communication was smooth throughout, and we are pleased with the result. We would gladly recommend their web development services.',
    photo: '/images/testimonials/tiana-tarin-arengh-pasf.png',
    project: 'College website',
    industry: 'College',
    website: 'https://pasfanc.ac.in/',
    displayOrder: 5,
  },
  {
    name: 'Principal',
    designation: 'Anita Vidyalaya Higher Secondary School',
    organisation: 'Anita Vidyalaya Higher Secondary School, Thannipuzha, Kerala',
    quote:
      'BaseCode Labs delivered our school website with care, clarity, and professionalism. The design is easy to navigate for parents and students, updates are handled promptly, and the team was responsive at every step. We are grateful for their support and happily recommend them for quality web development.',
    photo: '/images/testimonials/anita-vidyalaya-principal.png',
    project: 'School website',
    industry: 'School',
    website: 'https://anitavidyalayahss.com/',
    displayOrder: 6,
  },
];

async function main() {
  const adminEmail =
    (process.env.ADMIN_EMAIL ?? '').toLowerCase().trim() || 'contact@basecodelabs.com';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
    create: {
      email: adminEmail,
      name: process.env.ADMIN_NAME ?? 'BaseCode Labs Admin',
      role: 'SUPER_ADMIN',
    },
  });

  await prisma.product.deleteMany();
  await prisma.product.createMany({
    data: [
      {
        name: 'BCL OneCampus ERP',
        slug: 'bcl-onecampus-erp',
        code: 'ONC',
        version: '2.0',
        category: 'ERP',
        platform: 'Web + Android + iOS',
        pricingModel: 'Per institution / per student',
        licenseType: 'Annual',
        description:
          'Complete institution management platform for schools and colleges — students, staff, admissions, academics, attendance, fees, examinations, library, accounts, HR, SMS, portals and mobile apps.',
        featuresJson: JSON.stringify([
          'Student Management',
          'Staff Management',
          'Admissions',
          'Academics',
          'Attendance',
          'Fees',
          'Examination',
          'Library',
          'Accounts',
          'HR',
          'SMS',
          'Notifications',
          'Certificates',
          'Reports',
          'Parent Portal',
          'Student Portal',
          'Staff Portal',
          'Mobile Applications',
        ]),
        displayOrder: 1,
      },
      {
        name: 'Web Solutions',
        slug: 'web-solutions',
        code: 'WEB',
        category: 'Website',
        platform: 'Web',
        description:
          'Corporate, school and college websites plus web applications — designed, hosted and maintained for institutions that need a lasting digital presence.',
        featuresJson: JSON.stringify([
          'Corporate websites',
          'School websites',
          'College websites',
          'E-commerce',
          'Web applications',
        ]),
        displayOrder: 2,
      },
      {
        name: 'Mobile Applications',
        slug: 'mobile-applications',
        code: 'MOB',
        category: 'Mobile App',
        platform: 'Android + iOS',
        description:
          'Android, iOS and cross-platform applications for campuses, dioceses and businesses — including parent and staff apps connected to BCL products.',
        featuresJson: JSON.stringify([
          'Android',
          'iOS',
          'Cross-platform',
          'Push notifications',
          'Store publishing',
        ]),
        displayOrder: 3,
      },
      {
        name: 'BCL GST Billing',
        slug: 'gst-billing',
        code: 'GST',
        version: '1.0',
        category: 'Business Software',
        platform: 'Web (SaaS)',
        pricingModel: 'Subscription',
        licenseType: 'SaaS',
        supportPlan: 'Email and phone',
        description:
          'A simple and powerful GST billing and business management solution for small businesses, shops, service providers and growing enterprises. Create professional GST invoices, manage customers and products, track payments, and generate useful business reports from one place.',
        featuresJson: JSON.stringify([
          'GST-compliant invoice generation',
          'Customer management',
          'Product & service management',
          'HSN/SAC codes',
          'GST rates and tax calculations',
          'CGST / SGST / IGST',
          'Invoice numbering',
          'Quotations & estimates',
          'Purchase management',
          'Sales management',
          'Payment tracking',
          'Outstanding / receivables',
          'Credit & debit notes',
          'Stock / inventory management',
          'Expense tracking',
          'GST reports',
          'Sales reports',
          'Customer statements',
          'Printable & PDF invoices',
          'Business dashboard',
          'User roles & permissions',
          'Backup & data security',
        ]),
        displayOrder: 4,
      },
      {
        name: 'Business Solutions',
        slug: 'custom-software',
        code: 'CUS',
        category: 'Custom Software',
        platform: 'Custom',
        description:
          'SaaS, CRM, APIs and purpose-built software for organisations that need more than a template product.',
        featuresJson: JSON.stringify(['SaaS', 'CRM', 'APIs', 'Integrations']),
        displayOrder: 5,
      },
    ],
  });

  await prisma.testimonial.deleteMany();
  await prisma.testimonial.createMany({ data: testimonials });

  await prisma.clientLogo.deleteMany();
  await prisma.clientLogo.createMany({
    data: testimonials.map((t, i) => ({
      name: t.organisation.split(',')[0],
      website: t.website,
      industry: t.industry,
      displayOrder: i,
    })),
  });

  await prisma.portfolioProject.deleteMany();
  await prisma.portfolioProject.createMany({
    data: [
      {
        name: 'Salesian Province of Guwahati website & app',
        slug: 'salesian-province-guwahati',
        clientName: 'Salesian Province of Guwahati',
        industry: 'Religious / Diocese',
        services: 'Website redesign, Android application',
        technologies: 'Web, Android',
        description:
          'Redesigned province website with improved structure and a dedicated mobile application, as described by Vice Provincial Fr. Bivan Rodriques Mukhim.',
        websiteUrl: 'https://donboscoguwahati.org/',
        status: 'PUBLISHED',
        displayOrder: 1,
      },
      {
        name: 'Don Bosco College of Teacher Education Tura',
        slug: 'dbcte-tura',
        clientName: 'Don Bosco College of Teacher Education Tura',
        industry: 'College',
        services: 'Website',
        description: 'Institution website delivered for DBCTE Tura.',
        websiteUrl: 'https://dbctetura.com/',
        displayOrder: 2,
      },
      {
        name: 'Tura Public School website',
        slug: 'tura-public-school',
        clientName: 'Tura Public School',
        industry: 'School',
        services: 'Website',
        description: 'School website for Tura Public School.',
        websiteUrl: 'https://turapublicschool.com/',
        displayOrder: 3,
      },
      {
        name: 'Don Bosco College Higher Secondary Section Tura',
        slug: 'dbc-hss-tura',
        clientName: 'Don Bosco College Higher Sec. Section Tura',
        industry: 'Higher Secondary',
        services: 'Website, ongoing updates',
        description: 'Institution website with structured navigation and ongoing updates.',
        websiteUrl: 'https://dbchsstura.in/',
        displayOrder: 4,
      },
      {
        name: 'PASF Abong Noga College',
        slug: 'pasf-abong-noga-college',
        clientName: 'PASF - Abong Noga College',
        industry: 'College',
        services: 'Website',
        description: 'College website serving students and parents.',
        websiteUrl: 'https://pasfanc.ac.in/',
        displayOrder: 5,
      },
      {
        name: 'Anita Vidyalaya Higher Secondary School',
        slug: 'anita-vidyalaya-hss',
        clientName: 'Anita Vidyalaya Higher Secondary School',
        industry: 'School',
        services: 'Website',
        description: 'School website for parents and students, Thannipuzha, Kerala.',
        websiteUrl: 'https://anitavidyalayahss.com/',
        displayOrder: 6,
      },
    ],
  });

  await prisma.caseStudy.deleteMany();
  await prisma.caseStudy.create({
    data: {
      slug: 'salesian-province-guwahati',
      title: 'Province website and mobile app for Salesian Province of Guwahati',
      clientName: 'Salesian Province of Guwahati',
      challenge:
        'The province needed a clearer public website and a dedicated mobile application so communities could find information and navigate more easily.',
      solution:
        'BaseCode Labs redesigned the province website and developed a dedicated mobile application with improved functionality and a structured, user-friendly interface.',
      technology: 'Web platform and Android application',
      implementation:
        'Collaborative delivery with the province office, covering website structure, navigation and the companion app.',
      result:
        'Vice Provincial Fr. Bivan Rodriques Mukhim recorded improved accessibility and navigation, professional communication, and satisfaction with the delivered service. No additional numerical KPIs were published.',
    },
  });

  await prisma.serviceItem.deleteMany();
  await prisma.serviceItem.createMany({
    data: [
      {
        slug: 'erp',
        category: 'Software Development',
        title: 'ERP',
        description: 'Institution and business ERP platforms including BCL OneCampus.',
        featuresJson: JSON.stringify(['Admissions', 'Academics', 'Fees', 'HR', 'Reports']),
        technologies: 'TypeScript, PostgreSQL, mobile apps',
        industries: 'Schools, colleges, dioceses',
        displayOrder: 1,
      },
      {
        slug: 'crm',
        category: 'Software Development',
        title: 'CRM',
        description:
          'Lead-to-client workflows for offices that need a single record of every enquiry.',
        featuresJson: JSON.stringify(['Leads', 'Pipeline', 'Follow-ups']),
        displayOrder: 2,
      },
      {
        slug: 'custom-software-svc',
        category: 'Software Development',
        title: 'Custom Software',
        description: 'Purpose-built applications when a packaged product is not enough.',
        featuresJson: JSON.stringify(['Discovery', 'Build', 'Support']),
        displayOrder: 3,
      },
      {
        slug: 'saas',
        category: 'Software Development',
        title: 'SaaS Applications',
        description: 'Multi-tenant products with licensing, subscriptions and central control.',
        featuresJson: JSON.stringify(['Tenancy', 'Billing-ready', 'License API']),
        displayOrder: 4,
      },
      {
        slug: 'corporate-websites',
        category: 'Web',
        title: 'Corporate Websites',
        description: 'Premium public sites for companies and institutions.',
        featuresJson: JSON.stringify(['CMS', 'SEO', 'Hosting']),
        displayOrder: 10,
      },
      {
        slug: 'school-websites',
        category: 'Web',
        title: 'School Websites',
        description: 'Parent-friendly school sites with notices, galleries and admissions.',
        industries: 'Schools',
        displayOrder: 11,
      },
      {
        slug: 'college-websites',
        category: 'Web',
        title: 'College Websites',
        description: 'College and higher-secondary sites with programmes, faculty and circulars.',
        industries: 'Colleges',
        displayOrder: 12,
      },
      {
        slug: 'ecommerce',
        category: 'Web',
        title: 'E-commerce',
        description: 'Catalogue and checkout experiences for retail and campus stores.',
        displayOrder: 13,
      },
      {
        slug: 'web-apps',
        category: 'Web',
        title: 'Web Applications',
        description: 'Authenticated portals and operational web software.',
        displayOrder: 14,
      },
      {
        slug: 'android',
        category: 'Mobile',
        title: 'Android',
        description: 'Play Store applications for parents, staff and field teams.',
        displayOrder: 20,
      },
      {
        slug: 'ios',
        category: 'Mobile',
        title: 'iOS',
        description: 'App Store applications when the institution needs iPhone coverage.',
        displayOrder: 21,
      },
      {
        slug: 'cross-platform',
        category: 'Mobile',
        title: 'Cross-platform apps',
        description: 'Shared Android and iOS codebases for faster campus rollouts.',
        displayOrder: 22,
      },
      {
        slug: 'hosting',
        category: 'Infrastructure',
        title: 'Hosting',
        description: 'Website and application hosting with renewal tracking in BaseCode Central.',
        displayOrder: 30,
      },
      {
        slug: 'cloud',
        category: 'Infrastructure',
        title: 'Cloud',
        description: 'Cloud server planning and management for ERP and public sites.',
        displayOrder: 31,
      },
      {
        slug: 'server-management',
        category: 'Infrastructure',
        title: 'Server Management',
        description: 'OS, backups, SSL and uptime operations.',
        displayOrder: 32,
      },
      {
        slug: 'networking',
        category: 'Infrastructure',
        title: 'Networking',
        description: 'Campus networking alongside ID card and hardware programmes.',
        displayOrder: 33,
      },
      {
        slug: 'security',
        category: 'Infrastructure',
        title: 'Security',
        description: 'Hardening, access control and license-aware product security.',
        displayOrder: 34,
      },
      {
        slug: 'seo',
        category: 'Digital',
        title: 'SEO',
        description:
          'On-page SEO, sitemaps and local visibility for Tamil Nadu and Meghalaya searches.',
        displayOrder: 40,
      },
      {
        slug: 'maintenance',
        category: 'Digital',
        title: 'Website Maintenance',
        description: 'Content updates, backups and support retainers.',
        displayOrder: 41,
      },
      {
        slug: 'digital-transformation',
        category: 'Digital',
        title: 'Digital Transformation',
        description: 'From paper processes to licensed software, portals and mobile apps.',
        displayOrder: 42,
      },
    ],
  });

  await prisma.blogPost.deleteMany();
  await prisma.blogPost.create({
    data: {
      slug: 'school-college-erp-tamil-nadu-meghalaya',
      title: 'School and college software for Tamil Nadu and Meghalaya institutions',
      excerpt:
        'How BaseCode Labs supports schools, colleges and dioceses from Bhuvanagiri, Tamil Nadu and Tura, Meghalaya with websites, ERP and mobile apps.',
      category: 'Education Technology',
      tags: 'Tamil Nadu,Meghalaya,Tura,school ERP,college website',
      body: `BaseCode Labs Pvt. Ltd. is a technology company with a registered office in Thurinjikollai, Bhuvanagiri, Tamil Nadu and an operational office on DBC Road, Sampalgre, Tura, Meghalaya.

We build websites, BCL OneCampus ERP, Android applications and digital infrastructure for schools, colleges and organisations. This article exists so institutions searching for software companies in Tamil Nadu and Meghalaya can find accurate company information, contact details and client references already published on basecodelabs.com.`,
    },
  });

  for (const t of testimonials) {
    const existing = await prisma.client.findFirst({ where: { organisation: t.organisation } });
    if (!existing) {
      const year = new Date().getFullYear();
      const count = await prisma.client.count();
      await prisma.client.create({
        data: {
          clientCode: `BCL-CLI-${year}-${String(count + 1).padStart(4, '0')}`,
          organisation: t.organisation,
          contactPerson: t.name,
          website: t.website,
          institutionType: t.industry,
          status: 'ACTIVE',
        },
      });
    }
  }

  await prisma.sequence.upsert({
    where: { key: `CLI-${new Date().getFullYear()}` },
    update: { next: (await prisma.client.count()) + 1 },
    create: {
      key: `CLI-${new Date().getFullYear()}`,
      year: new Date().getFullYear(),
      next: (await prisma.client.count()) + 1,
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'company.tagline' },
    update: {},
    create: { key: 'company.tagline', value: 'Your Technology Growth Partner' },
  });

  const { LEGAL_SEEDS } = await import('./legal-content');
  const publishedAt = new Date('2026-09-18T00:00:00.000Z');
  for (const policy of LEGAL_SEEDS) {
    const existing = await prisma.legalDocument.findUnique({ where: { slug: policy.slug } });
    if (existing) continue;
    const doc = await prisma.legalDocument.create({
      data: {
        slug: policy.slug,
        title: policy.title,
        shortDescription: policy.shortDescription,
        icon: policy.icon,
        version: '1.0',
        status: 'PUBLISHED',
        effectiveDate: publishedAt,
        lastUpdated: publishedAt,
        contentHtml: policy.contentHtml,
        displayOrder: policy.displayOrder,
      },
    });
    await prisma.legalDocumentVersion.create({
      data: {
        documentId: doc.id,
        version: '1.0',
        contentHtml: policy.contentHtml,
        changeSummary: policy.changeSummary,
        publishedBy: 'BaseCode Labs Pvt. Ltd.',
        publishedAt,
      },
    });
  }

  console.log('Seeded BaseCode Central with live-site testimonials and CMS content.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
