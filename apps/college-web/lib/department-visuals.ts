import type { LucideIcon } from 'lucide-react';
import {
  Atom,
  BookOpen,
  Building2,
  Calculator,
  Drama,
  FlaskConical,
  Globe2,
  GraduationCap,
  Landmark,
  Leaf,
  Lightbulb,
  Monitor,
  PawPrint,
  ScrollText,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';

export type DepartmentIconKey =
  | 'leaf'
  | 'flask'
  | 'cart'
  | 'monitor'
  | 'trending'
  | 'graduation'
  | 'book'
  | 'drama'
  | 'globe'
  | 'scroll'
  | 'calculator'
  | 'lightbulb'
  | 'atom'
  | 'landmark'
  | 'users'
  | 'paw'
  | 'building';

export type DepartmentVisual = {
  color: string;
  icon: DepartmentIconKey;
};

const iconComponents: Record<DepartmentIconKey, LucideIcon> = {
  leaf: Leaf,
  flask: FlaskConical,
  cart: ShoppingCart,
  monitor: Monitor,
  trending: TrendingUp,
  graduation: GraduationCap,
  book: BookOpen,
  drama: Drama,
  globe: Globe2,
  scroll: ScrollText,
  calculator: Calculator,
  lightbulb: Lightbulb,
  atom: Atom,
  landmark: Landmark,
  users: Users,
  paw: PawPrint,
  building: Building2,
};

const visualBySlug: Record<string, DepartmentVisual> = {
  botany: { color: '#5B4B8A', icon: 'leaf' },
  chemistry: { color: '#3B6EA5', icon: 'flask' },
  commerce: { color: '#3D8B4F', icon: 'cart' },
  'computer-science': { color: '#1F8A8A', icon: 'monitor' },
  economics: { color: '#E87A2E', icon: 'trending' },
  education: { color: '#C23A7A', icon: 'graduation' },
  english: { color: '#6B7FBF', icon: 'book' },
  garo: { color: '#1F6F6A', icon: 'drama' },
  geography: { color: '#2F6F8F', icon: 'globe' },
  history: { color: '#8B5E3C', icon: 'scroll' },
  mathematics: { color: '#4A6FA5', icon: 'calculator' },
  philosophy: { color: '#7A5C9E', icon: 'lightbulb' },
  physics: { color: '#2C5F8A', icon: 'atom' },
  'political-science': { color: '#3F5F8A', icon: 'landmark' },
  sociology: { color: '#5C6B8A', icon: 'users' },
  zoology: { color: '#4F7A3C', icon: 'paw' },
};

const visualByCategory: Record<string, DepartmentVisual> = {
  ARTS: { color: '#6B7FBF', icon: 'book' },
  SCIENCE: { color: '#3B6EA5', icon: 'flask' },
  COMMERCE: { color: '#3D8B4F', icon: 'cart' },
  PROFESSIONAL: { color: '#1F8A8A', icon: 'monitor' },
};

export function shortDepartmentName(name: string) {
  return name.replace(/^Department of\s+/i, '');
}

export function departmentVisual(input: { slug: string; category: string }): DepartmentVisual {
  return (
    visualBySlug[input.slug] ||
    visualByCategory[input.category.toUpperCase()] ||
    visualByCategory.ARTS
  );
}

export function departmentIcon(key: DepartmentIconKey): LucideIcon {
  return iconComponents[key] || Building2;
}
