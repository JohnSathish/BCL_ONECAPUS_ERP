export const COMPANY = {
  legalName: 'BaseCode Labs Pvt. Ltd.',
  shortName: 'BaseCode Labs',
  tagline: 'Your Technology Growth Partner',
  headline: 'Building Digital Solutions That Power Institutions & Businesses',
  subheading:
    'BaseCode Labs builds modern software, ERP platforms, websites, mobile applications and digital infrastructure for organisations ready to grow.',
  aboutTitle: 'Technology. Innovation. Partnership.',
  aboutBody:
    'At BaseCode Labs, we are a full-service technology and IT solutions company helping brands and institutions build a strong digital presence. With expertise in web development, SaaS, ERP, and digital solutions, we empower schools, colleges, dioceses, startups, SMEs, and enterprises to grow with software they can actually run.',
  mission:
    'To provide result-driven digital strategies that enhance brand visibility, generate qualified leads, and maximize ROI for businesses across industries.',
  howWeWork:
    'We work with a strategy-first approach, starting with research and planning. Our team creates customized solutions, ensures transparent reporting, and delivers sustainable growth and measurable results.',
  email: 'contact@basecodelabs.com',
  phoneDisplay: '+91 95663 63655',
  phones: ['9566363655', '8778463459'],
  whatsapp: 'https://wa.me/919566363655',
  website: 'https://basecodelabs.com',
  gstBilling: {
    name: 'BCL GST Billing',
    url: 'https://finance.basecodelabs.com/',
    subtitle: 'Smart GST billing and business management for growing businesses.',
  },
  registeredOffice: {
    name: 'Registered Office',
    line1: 'Thurinjikollai, Bhuvanagiri',
    line2: 'Tamil Nadu, India',
  },
  operationalOffice: {
    name: 'Operational Office',
    line1: 'DBC Road, Sampalgre, Tura',
    line2: 'Meghalaya – 794002, India',
  },
  /** Figures published on the live BaseCode Labs homepage hero — not inflated. */
  stats: [
    { value: '8+', label: 'Years of experience' },
    { value: '46+', label: 'Satisfied clients' },
    { value: '6', label: 'Published client stories' },
    { value: '24/7', label: 'Support availability' },
  ],
} as const;

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/products', label: 'Products' },
  { href: '/services', label: 'Services' },
  { href: '/industries', label: 'Industries' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/testimonials', label: 'Clients' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
] as const;
