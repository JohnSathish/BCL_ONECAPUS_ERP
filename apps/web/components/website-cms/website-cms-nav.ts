import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  FileText,
  FolderOpen,
  GraduationCap,
  Image as ImageIcon,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  Megaphone,
  Menu,
  Mail,
  Newspaper,
  Palette,
  PanelBottom,
  Rocket,
  Search,
  Settings2,
  Sparkles,
  Users,
  Video,
  FileStack,
  Quote,
  Zap,
  Droplets,
  Layers,
} from 'lucide-react';

export type WebsiteCmsNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: 'root' | 'content' | 'academic' | 'media' | 'appearance' | 'system';
  comingSoon?: boolean;
  /** Shown when the screen is a legacy fallback, not the primary data source. */
  legacy?: boolean;
};

export const WEBSITE_CMS_NAV: WebsiteCmsNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/admin/website',
    icon: LayoutDashboard,
    group: 'root',
  },
  { id: 'pages', label: 'Pages', href: '/admin/website/pages', icon: FileText, group: 'content' },
  { id: 'news', label: 'News', href: '/admin/website/news', icon: Newspaper, group: 'content' },
  {
    id: 'notices',
    label: 'Notice Board',
    href: '/admin/website/notices',
    icon: Megaphone,
    group: 'content',
  },
  {
    id: 'blood-donors',
    label: 'Blood Donors',
    href: '/admin/website/blood-donors',
    icon: Droplets,
    group: 'content',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    href: '/admin/website/newsletter',
    icon: Mail,
    group: 'content',
  },
  {
    id: 'fyug-interest',
    label: 'FYUG Interest',
    href: '/admin/website/fyug-interest',
    icon: GraduationCap,
    group: 'content',
  },
  {
    id: 'announcements',
    label: 'Announcements',
    href: '/admin/website/announcements',
    icon: Sparkles,
    group: 'content',
  },
  {
    id: 'popups',
    label: 'Popup Management',
    href: '/admin/website/popups',
    icon: Layers,
    group: 'content',
  },
  {
    id: 'flash-news',
    label: 'Flash News',
    href: '/admin/website/flash-news',
    icon: Zap,
    group: 'content',
  },
  {
    id: 'testimonials',
    label: 'Testimonials',
    href: '/admin/website/testimonials',
    icon: Quote,
    group: 'content',
  },
  {
    id: 'departments',
    label: 'Departments',
    href: '/admin/website/departments',
    icon: GraduationCap,
    group: 'academic',
  },
  {
    id: 'faculty',
    label: 'Faculty Profiles',
    href: '/admin/website/faculty',
    icon: Users,
    group: 'academic',
  },
  {
    id: 'programmes',
    label: 'Programmes',
    href: '/admin/website/programmes',
    icon: FileStack,
    group: 'academic',
  },
  {
    id: 'calendar',
    label: 'Event list (fallback)',
    href: '/admin/website/calendar',
    icon: CalendarDays,
    group: 'academic',
    legacy: true,
  },
  {
    id: 'year-planner',
    label: 'Handbook planner (legacy)',
    href: '/admin/website/year-planner',
    icon: CalendarDays,
    group: 'academic',
    legacy: true,
  },
  {
    id: 'media',
    label: 'Media Library',
    href: '/admin/website/media',
    icon: ImageIcon,
    group: 'media',
  },
  {
    id: 'gallery',
    label: 'Life at Campus',
    href: '/admin/website/gallery',
    icon: Images,
    group: 'media',
  },
  {
    id: 'documents',
    label: 'Documents',
    href: '/admin/website/documents',
    icon: FolderOpen,
    group: 'media',
  },
  { id: 'videos', label: 'Videos', href: '/admin/website/videos', icon: Video, group: 'media' },
  {
    id: 'navigation',
    label: 'Menus',
    href: '/admin/website/navigation',
    icon: Menu,
    group: 'appearance',
  },
  { id: 'theme', label: 'Theme', href: '/admin/website/theme', icon: Palette, group: 'appearance' },
  {
    id: 'homepage',
    label: 'Homepage Builder',
    href: '/admin/website/homepage',
    icon: LayoutTemplate,
    group: 'appearance',
  },
  {
    id: 'footer',
    label: 'Footer',
    href: '/admin/website/footer',
    icon: PanelBottom,
    group: 'appearance',
  },
  {
    id: 'hero',
    label: 'Hero Slider',
    href: '/admin/website/hero',
    icon: Images,
    group: 'appearance',
  },
  { id: 'seo', label: 'SEO', href: '/admin/website/seo', icon: Search, group: 'system' },
  {
    id: 'publishing',
    label: 'Publishing',
    href: '/admin/website/publishing',
    icon: Rocket,
    group: 'system',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/website/settings',
    icon: Settings2,
    group: 'system',
  },
];

export const WEBSITE_CMS_GROUPS: Array<{ id: WebsiteCmsNavItem['group']; label: string }> = [
  { id: 'root', label: '' },
  { id: 'content', label: 'Content' },
  { id: 'academic', label: 'Academic' },
  { id: 'media', label: 'Media' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'system', label: 'System' },
];
