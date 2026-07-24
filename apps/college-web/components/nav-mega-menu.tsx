'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  Clock3,
  Eye,
  GraduationCap,
  Landmark,
  Lightbulb,
  type LucideIcon,
  Target,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react';

const ICON_BY_LABEL: Record<string, LucideIcon> = {
  history: Clock3,
  'vision & mission': Eye,
  objectives: Target,
  philosophy: Lightbulb,
  management: Users,
  affiliation: Award,
  founder: UserRound,
  'our rector major': Landmark,
  'db higher education': GraduationCap,
  'former principals': UserRound,
  'former vice principals': UsersRound,
  "principal's desk": BookOpen,
  'principal’s desk': BookOpen,
  administration: Building2,
  departments: Building2,
  programmes: GraduationCap,
  'academic calendar': Clock3,
  library: BookOpen,
  'apply online': GraduationCap,
  'fyug 4th year interest': Target,
  prospectus: BookOpen,
  eligibility: Award,
  scholarships: Award,
  'clubs & societies': Users,
  'nss & ncc': UsersRound,
  sports: Target,
  alumni: Users,
  'research cell': Lightbulb,
  publications: BookOpen,
  journals: BookOpen,
  innovation: Lightbulb,
};

const SUBTITLE_BY_GROUP: Record<string, string> = {
  'About Us': 'Know more about our heritage and values.',
  Academics: 'Explore programmes, departments and learning resources.',
  Admission: 'Start your application and find admission guidance.',
  'Campus Life': 'Discover clubs, sports and student community life.',
  Research: 'Faculty research, journals and innovation initiatives.',
};

const CTA_BY_GROUP: Record<string, { title: string; copy: string; href: string }> = {
  'About Us': {
    title: 'Explore Our Journey',
    copy: 'Discover our legacy of excellence',
    href: '/about/history',
  },
  Academics: {
    title: 'Browse Departments',
    copy: 'Find your programme of study',
    href: '/departments',
  },
  Admission: {
    title: 'Apply Online',
    copy: 'Begin your admission journey',
    href: '/admission/apply',
  },
};

function iconFor(label: string): LucideIcon {
  return ICON_BY_LABEL[label.trim().toLowerCase()] ?? Landmark;
}

type Props = {
  label: string;
  items: ReadonlyArray<readonly [string, string]>;
};

export function NavMegaMenu({ label, items }: Props) {
  const subtitle = SUBTITLE_BY_GROUP[label] ?? 'Quick links to key pages.';
  const cta = CTA_BY_GROUP[label];

  return (
    <div className="mega" role="menu" aria-label={label}>
      <div className="mega-caret" aria-hidden />
      <header className="mega-head">
        <span className="mega-head-icon" aria-hidden>
          <Landmark />
        </span>
        <div>
          <p>{label}</p>
          <small>{subtitle}</small>
        </div>
      </header>
      <div className="mega-links">
        {items.map(([itemLabel, href]) => {
          const Icon = iconFor(itemLabel);
          return (
            <Link key={href} href={href} role="menuitem" className="mega-link">
              <span className="mega-link-icon" aria-hidden>
                <Icon />
              </span>
              <span className="mega-link-label">{itemLabel}</span>
              <span className="mega-link-arrow" aria-hidden>
                <ArrowRight />
              </span>
            </Link>
          );
        })}
      </div>
      {cta ? (
        <Link className="mega-cta" href={cta.href} role="menuitem">
          <span className="mega-cta-icon" aria-hidden>
            <BookOpen />
          </span>
          <span className="mega-cta-copy">
            <strong>{cta.title}</strong>
            <small>{cta.copy}</small>
          </span>
          <ArrowRight aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
