import type { SchoolPersona } from '@/api/school-mobile';
import type { SchoolFeatures } from '@/store/school-session';

export function can(perms: string[], slug: string) {
  return perms.includes('*') || perms.includes(slug) || perms.includes('school-sis:manage');
}

export function tabsForPersona(persona: SchoolPersona | null, features: SchoolFeatures) {
  const fees = features.onlineFees !== false;
  const library = features.library !== false;
  const transport = features.transport !== false;
  switch (persona) {
    case 'parent':
      return [
        { name: 'index', title: 'Home', icon: '🏠' },
        { name: 'academics', title: 'Children', icon: '👨‍👩‍👧' },
        ...(fees ? [{ name: 'fees', title: 'Fees', icon: '₹' }] : []),
        { name: 'notifications', title: 'Alerts', icon: '🔔' },
        { name: 'profile', title: 'Profile', icon: '👤' },
      ];
    case 'teacher':
      return [
        { name: 'index', title: 'Home', icon: '🏠' },
        { name: 'academics', title: 'Classes', icon: '📚' },
        { name: 'notifications', title: 'Alerts', icon: '🔔' },
        { name: 'profile', title: 'Profile', icon: '👤' },
      ];
    case 'accountant':
      return [
        { name: 'index', title: 'Home', icon: '🏠' },
        { name: 'fees', title: 'Fees', icon: '₹' },
        { name: 'notifications', title: 'Alerts', icon: '🔔' },
        { name: 'profile', title: 'Profile', icon: '👤' },
      ];
    case 'librarian':
      return [
        { name: 'index', title: 'Home', icon: '🏠' },
        ...(library ? [{ name: 'academics', title: 'Library', icon: '📖' }] : []),
        { name: 'notifications', title: 'Alerts', icon: '🔔' },
        { name: 'profile', title: 'Profile', icon: '👤' },
      ];
    case 'transport':
      return [
        { name: 'index', title: 'Home', icon: '🏠' },
        ...(transport ? [{ name: 'academics', title: 'Routes', icon: '🚌' }] : []),
        { name: 'notifications', title: 'Alerts', icon: '🔔' },
        { name: 'profile', title: 'Profile', icon: '👤' },
      ];
    case 'admin':
      return [
        { name: 'index', title: 'Home', icon: '🏠' },
        { name: 'academics', title: 'School', icon: '🏫' },
        ...(fees ? [{ name: 'fees', title: 'Fees', icon: '₹' }] : []),
        { name: 'notifications', title: 'Alerts', icon: '🔔' },
        { name: 'profile', title: 'Profile', icon: '👤' },
      ];
    default:
      return [
        { name: 'index', title: 'Home', icon: '🏠' },
        { name: 'academics', title: 'Academics', icon: '📚' },
        ...(fees ? [{ name: 'fees', title: 'Fees', icon: '₹' }] : []),
        { name: 'notifications', title: 'Alerts', icon: '🔔' },
        { name: 'profile', title: 'Profile', icon: '👤' },
      ];
  }
}

export function hideStaffAdminModules(persona: SchoolPersona | null) {
  return persona === 'student' || persona === 'parent';
}
