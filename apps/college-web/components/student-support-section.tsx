import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Check,
  Handshake,
  Heart,
  LifeBuoy,
  MessageCircle,
  Ribbon,
  Scale,
  Shield,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

type SupportTone = 'blue' | 'green' | 'amber' | 'rose' | 'navy' | 'forest';

type SupportCard = {
  id: string;
  title: string;
  description: string;
  points: string[];
  href: string;
  Icon: LucideIcon;
  Watermark: LucideIcon;
  tone: SupportTone;
};

const CARDS: SupportCard[] = [
  {
    id: 'grievance',
    title: 'Grievance Cell',
    description: 'A trusted space for students to raise concerns with care and confidentiality.',
    points: ['Confidential support system', 'Timely resolution', 'Student-friendly approach'],
    href: '/students',
    Icon: Users,
    Watermark: MessageCircle,
    tone: 'blue',
  },
  {
    id: 'anti-ragging',
    title: 'Anti-Ragging',
    description: 'Ensuring a safe and respectful campus environment for every student.',
    points: ['Zero tolerance policy', 'Awareness & prevention', '24×7 reporting support'],
    href: '/students',
    Icon: ShieldCheck,
    Watermark: Shield,
    tone: 'green',
  },
  {
    id: 'icc',
    title: 'Internal Complaints Committee',
    description: 'Promoting dignity, equality, and justice within the institution.',
    points: ['Gender sensitive environment', 'Fair & impartial inquiry', 'Support & guidance'],
    href: '/students',
    Icon: Scale,
    Watermark: ShieldCheck,
    tone: 'amber',
  },
  {
    id: 'red-ribbon',
    title: 'Red Ribbon Club',
    description: 'Creating awareness and promoting healthy lifestyles among youth.',
    points: ['HIV/AIDS awareness', 'Health & wellness drives', 'Community outreach'],
    href: '/campus-life/clubs',
    Icon: Activity,
    Watermark: Ribbon,
    tone: 'rose',
  },
  {
    id: 'nss',
    title: 'NSS',
    description: 'Inspiring students to serve society with compassion and responsibility.',
    points: ['Social service initiatives', 'Community development', 'Leadership & teamwork'],
    href: '/campus-life/nss-ncc',
    Icon: BookOpen,
    Watermark: Users,
    tone: 'navy',
  },
  {
    id: 'ncc',
    title: 'NCC',
    description: 'Building disciplined, confident, and responsible young citizens.',
    points: ['Personality development', 'National integration', 'Adventure & skill training'],
    href: '/campus-life/nss-ncc',
    Icon: Shield,
    Watermark: Star,
    tone: 'forest',
  },
];

const VALUES = [
  { label: 'Student Centric', Icon: Users },
  { label: 'Safe & Inclusive', Icon: Shield },
  { label: 'Empathy & Respect', Icon: Handshake },
  { label: 'Growth & Excellence', Icon: TrendingUp },
] as const;

export function StudentSupportSection() {
  return (
    <section className="student-support" aria-labelledby="student-support-heading">
      <div className="student-support-inner">
        <header className="student-support-head">
          <h2 id="student-support-heading">Student Support &amp; Activities</h2>
          <span className="student-support-emblem" aria-hidden>
            <Shield />
            <Star />
          </span>
          <p>Dedicated cells and clubs that nurture wellbeing, safety, and holistic growth.</p>
        </header>

        <div className="student-support-grid">
          {CARDS.map(({ id, title, description, points, href, Icon, Watermark, tone }) => (
            <article key={id} className={`student-support-card tone-${tone}`}>
              <Watermark className="student-support-watermark" aria-hidden />
              <span className="student-support-icon" aria-hidden>
                <Icon />
              </span>
              <h3>{title}</h3>
              <p className="student-support-desc">{description}</p>
              <ul className="student-support-points">
                {points.map((point) => (
                  <li key={point}>
                    <Check aria-hidden />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Link href={href} className="student-support-cta">
                Learn More <ArrowUpRight aria-hidden />
              </Link>
            </article>
          ))}
        </div>

        <aside className="student-support-banner" aria-label="Student support values">
          <div className="student-support-banner-lead">
            <span className="student-support-banner-icon" aria-hidden>
              <Heart />
              <Star />
            </span>
            <div>
              <p className="student-support-banner-title">Together, We Build a Better Tomorrow</p>
              <p className="student-support-banner-copy">
                Empowering students through care, integrity, and opportunities.
              </p>
            </div>
          </div>
          <ul className="student-support-values">
            {VALUES.map(({ label, Icon }) => (
              <li key={label}>
                <span aria-hidden>
                  <Icon />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
