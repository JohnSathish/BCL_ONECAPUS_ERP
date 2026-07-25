export const WHY_JOIN_DBC = [
  {
    title: 'Meaningful Impact',
    description:
      'Shape young minds through values-based education and the Salesian spirit of service.',
    icon: 'graduation',
  },
  {
    title: 'Growth Opportunities',
    description:
      'Faculty development, research pathways, and clear career progression across departments.',
    icon: 'trending',
  },
  {
    title: 'Supportive Community',
    description:
      'A collegial campus culture rooted in mentoring, collaboration, and pastoral care.',
    icon: 'heart',
  },
  {
    title: 'Work-Life Balance',
    description:
      'A people-first institution that respects academic rhythm, family life, and wellbeing.',
    icon: 'award',
  },
] as const;

export const RECRUITMENT_TIMELINE = [
  { id: 'apply', label: 'Apply' },
  { id: 'screening', label: 'Screening' },
  { id: 'interview', label: 'Interview' },
  { id: 'selection', label: 'Selection' },
  { id: 'appointment', label: 'Appointment Order' },
  { id: 'joining', label: 'Joining' },
] as const;

export const APPLICATION_PROCESS = [
  {
    step: 1,
    title: 'Submit Application',
    description: 'Complete the online form with personal, academic, and experience details.',
  },
  {
    step: 2,
    title: 'Upload Resume',
    description: 'Attach your CV, photograph, and supporting certificates securely.',
  },
  {
    step: 3,
    title: 'Screening',
    description: 'Applications are reviewed against eligibility and vacancy requirements.',
  },
  {
    step: 4,
    title: 'Interview',
    description: 'Shortlisted candidates receive interview call letters with date and venue.',
  },
  {
    step: 5,
    title: 'Selection',
    description: 'Selection committee evaluates performance and recommends appointment.',
  },
  {
    step: 6,
    title: 'Appointment',
    description: 'Successful candidates receive appointment orders and joining instructions.',
  },
] as const;

export const CAREERS_FAQ = [
  {
    question: 'Who can apply?',
    answer:
      'Eligible candidates with the required qualifications for teaching (Assistant/Associate Professor) or non-teaching roles may apply. Each vacancy lists specific eligibility criteria — NET/SET and PhD may be required for faculty posts.',
  },
  {
    question: 'How do I track my application?',
    answer:
      'Use Track Application with your application number and registered mobile number. You will also receive email and WhatsApp updates at key stages.',
  },
  {
    question: 'What documents are required?',
    answer:
      'Resume/CV, passport-size photograph, educational certificates, experience letters, NET/SET/PhD credentials (if applicable), and identity proof. Specific requirements are listed on each vacancy page.',
  },
  {
    question: 'What is the interview process?',
    answer:
      'Shortlisted candidates receive an interview call letter with date, time, and venue. The selection committee evaluates academic credentials, teaching experience, and interview performance before recommending appointment.',
  },
] as const;

export const HERO_CAROUSEL_SLIDES = [
  {
    id: 'campus',
    label: 'College Main Building',
    src: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1920&q=85',
    floatCard: { title: 'Campus Life', subtitle: 'Vibrant academic community' },
  },
  {
    id: 'graduation',
    label: 'Graduation Ceremony',
    src: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1920&q=85',
    floatCard: { title: 'Graduation Ceremony', subtitle: 'Celebrating student success' },
  },
  {
    id: 'faculty',
    label: 'Faculty Interaction',
    src: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1920&q=85',
    floatCard: { title: 'Faculty Excellence', subtitle: 'Mentoring & research' },
  },
  {
    id: 'classroom',
    label: 'Classroom Teaching',
    src: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1920&q=85',
    floatCard: { title: 'Modern Classrooms', subtitle: 'Student-centric learning' },
  },
  {
    id: 'library',
    label: 'Library Facilities',
    src: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1920&q=85',
    floatCard: { title: 'Research Activities', subtitle: 'Library & digital resources' },
  },
] as const;

export const INSTITUTIONAL_HIGHLIGHTS = [
  'NAAC Accredited',
  'FYUGP Compliant',
  '17 Departments',
  '3000+ Students',
  '150+ Faculty',
  "Meghalaya's Leading Institution",
] as const;

export const DEPARTMENT_HIRING_DEFAULTS = [
  { name: 'Economics', slug: 'economics' },
  { name: 'History', slug: 'history' },
  { name: 'Physics', slug: 'physics' },
  { name: 'Chemistry', slug: 'chemistry' },
  { name: 'Commerce', slug: 'commerce' },
  { name: 'Mathematics', slug: 'mathematics' },
  { name: 'English', slug: 'english' },
] as const;

export const HERO_CAMPUS_IMAGES = {
  main: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=900&q=80',
  classroom:
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=600&q=80',
  graduation:
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=600&q=80',
  faculty:
    'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80',
} as const;

export const DEFAULT_HIRING_ALERT = {
  headline: 'NOW HIRING',
  roles: ['Assistant Professors', 'Economics', 'History', 'Physics', 'Chemistry'],
  closingDate: '2026-07-30',
} as const;

export const CAREERS_WIZARD_STEPS = [
  'Personal Information',
  'Contact Details',
  'Educational Qualification',
  'Experience',
  'Research Profile',
  'Document Upload',
  'Review & Submit',
] as const;

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  TEACHING: 'Full Time',
  NON_TEACHING: 'Full Time',
  CONTRACT: 'Contractual',
  GUEST: 'Guest Faculty',
};

export function formatEmploymentType(staffType?: string | null) {
  if (!staffType) return 'Full Time';
  return EMPLOYMENT_TYPE_LABELS[staffType] ?? staffType.replace(/_/g, ' ');
}

export const CAREERS_TRUST_CHIPS = [
  'NAAC Accredited',
  'Don Bosco Mission',
  'Est. 1991',
  'Meghalaya, NE India',
] as const;

export const RECRUITMENT_CATEGORIES = [
  {
    title: 'Teaching Faculty',
    description: 'Assistant & Associate Professors, Lecturers across Arts, Science & Commerce.',
    staffType: 'TEACHING',
    icon: 'graduation',
  },
  {
    title: 'Non-Teaching Staff',
    description: 'Administrative, library, laboratory and support roles.',
    staffType: 'NON_TEACHING',
    icon: 'building',
  },
  {
    title: 'Guest Faculty',
    description: 'Semester-wise or course-wise visiting faculty appointments.',
    staffType: 'GUEST',
    icon: 'book',
  },
  {
    title: 'Contractual Roles',
    description: 'Fixed-term project and departmental contractual positions.',
    staffType: 'CONTRACT',
    icon: 'briefcase',
  },
] as const;

export const PUBLIC_STATUS_STEPS = [
  { id: 'submitted', label: 'Submitted' },
  { id: 'review', label: 'Under Review' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interview', label: 'Interview Scheduled' },
  { id: 'selected', label: 'Selected' },
  { id: 'appointed', label: 'Appointment Issued' },
] as const;
