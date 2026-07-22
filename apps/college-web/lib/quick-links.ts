import {
  Award,
  BedDouble,
  BriefcaseBusiness,
  CalendarDays,
  Download,
  GraduationCap,
  Library,
  Phone,
  type LucideIcon,
} from 'lucide-react';

export const quickLinks: ReadonlyArray<{ label: string; href: string; Icon: LucideIcon }> = [
  { label: 'Online Admission', href: '/admission/apply', Icon: GraduationCap },
  { label: 'Notice Board', href: '/news', Icon: CalendarDays },
  { label: 'Academic Calendar', href: '/academics/calendar', Icon: CalendarDays },
  { label: 'Examination', href: '/examination', Icon: Award },
  { label: 'Library', href: '/facilities/library', Icon: Library },
  { label: 'Downloads', href: '/downloads', Icon: Download },
  { label: 'Hostel', href: '/facilities/hostel', Icon: BedDouble },
  { label: 'Placement', href: '/placement', Icon: BriefcaseBusiness },
  { label: 'Contact Us', href: '/contact', Icon: Phone },
];
