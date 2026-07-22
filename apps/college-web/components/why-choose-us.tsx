import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BriefcaseBusiness,
  GraduationCap,
  HeartHandshake,
  Landmark,
  Leaf,
  Library,
  MonitorUp,
  Trophy,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { HomepageWhyChooseUs } from '@/lib/homepage-cms-content';

const iconMap: Record<string, LucideIcon> = {
  Users,
  MonitorUp,
  BriefcaseBusiness,
  Library,
  Trophy,
  HeartHandshake,
  Award,
  Leaf,
  GraduationCap,
  Landmark,
  UserCog,
};

const defaultFeatures = [
  {
    id: 'faculty',
    icon: 'Users',
    title: 'Experienced Faculty',
    copy: 'Mentorship that shapes minds and careers.',
    tone: 'violet',
  },
  {
    id: 'smart',
    icon: 'MonitorUp',
    title: 'Smart Classrooms',
    copy: 'Technology-enabled spaces for modern learning.',
    tone: 'blue',
  },
  {
    id: 'placement',
    icon: 'BriefcaseBusiness',
    title: 'Placement Support',
    copy: 'Guidance that opens doors to opportunity.',
    tone: 'orange',
  },
  {
    id: 'library',
    icon: 'Library',
    title: 'Library',
    copy: 'Resources that fuel inquiry and discovery.',
    tone: 'indigo',
  },
  {
    id: 'sports',
    icon: 'Trophy',
    title: 'Sports',
    copy: 'Strength of body, discipline of mind.',
    tone: 'rose',
  },
  {
    id: 'character',
    icon: 'HeartHandshake',
    title: 'Character Formation',
    copy: 'Values that last well beyond campus life.',
    tone: 'amber',
  },
  {
    id: 'campus',
    icon: 'Award',
    title: 'Campus Life',
    copy: 'A vibrant community of friendship and growth.',
    tone: 'sky',
  },
  {
    id: 'green',
    icon: 'Leaf',
    title: 'Green Audit',
    copy: 'Sustainability woven into everyday practice.',
    tone: 'teal',
  },
];

const defaultHighlights = [
  {
    id: 'holistic',
    icon: 'GraduationCap',
    title: 'Holistic Education',
    copy: 'Mind, Body & Soul',
    tone: 'blue',
  },
  {
    id: 'infra',
    icon: 'Landmark',
    title: 'Quality Infrastructure',
    copy: 'For Better Learning',
    tone: 'teal',
  },
  {
    id: 'student',
    icon: 'UserCog',
    title: 'Student-Centered',
    copy: 'Personalized Support',
    tone: 'violet',
  },
  {
    id: 'excellence',
    icon: 'Award',
    title: 'Excellence in Action',
    copy: 'Today & Tomorrow',
    tone: 'orange',
  },
];

type Props = {
  content?: HomepageWhyChooseUs;
};

export function WhyChooseUs({ content }: Props) {
  const eyebrow = content?.eyebrow ?? 'The Bosco Difference';
  const title = content?.title ?? 'Why choose us?';
  const subtitle =
    content?.subtitle ??
    'Education here goes beyond the classroom. It is a shared journey of discovery, responsibility and joyful growth.';
  const features = content?.features?.length ? content.features : defaultFeatures;
  const highlights = content?.highlights?.length ? content.highlights : defaultHighlights;

  return (
    <section className="why-choose" aria-labelledby="why-choose-heading">
      <div className="shell why-choose-shell">
        <div className="why-choose-layout">
          <div className="why-choose-intro">
            <span className="why-choose-eyebrow">{eyebrow}</span>
            <h2 id="why-choose-heading">{title}</h2>
            <p>{subtitle}</p>
            <Link className="why-choose-cta" href="/about/history">
              Discover More <ArrowRight aria-hidden />
            </Link>
            <div className="why-choose-watermark" aria-hidden>
              <Landmark />
            </div>
          </div>

          <div className="why-choose-grid">
            {features.map((feature, index) => {
              const Icon = iconMap[feature.icon] ?? Award;
              const number = String(index + 1).padStart(2, '0');
              const tone = feature.tone ?? 'blue';
              return (
                <article key={feature.id || feature.title} className="why-choose-card">
                  <span className="why-choose-num">{number}</span>
                  <span className={`feature-icon feature-icon-${tone} why-choose-icon`}>
                    <Icon aria-hidden />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.copy}</p>
                </article>
              );
            })}
          </div>
        </div>

        <div className="why-choose-bar" aria-label="College highlights">
          {highlights.map((item) => {
            const Icon = iconMap[item.icon] ?? Award;
            return (
              <div key={item.id || item.title} className="why-choose-bar-item">
                <span className={`feature-icon feature-icon-${item.tone ?? 'blue'}`}>
                  <Icon aria-hidden />
                </span>
                <p>
                  <strong>{item.title}</strong>
                  <small>{item.copy}</small>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
