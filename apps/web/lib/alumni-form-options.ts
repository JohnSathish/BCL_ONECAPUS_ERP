export const ALUMNI_GENDERS = ['Male', 'Female'] as const;

export const ALUMNI_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export const ALUMNI_DEPARTMENTS = [
  'Economics',
  'Education',
  'English',
  'Garo',
  'History',
  'Khasi',
  'Philosophy',
  'Political Science',
  'Commerce',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Botany',
  'Zoology',
  'Computer Science',
  'Management',
  'Other',
] as const;

export const ALUMNI_EMPLOYMENT_STATUSES = [
  'Employed',
  'Self-employed',
  'Government',
  'Student',
  'Business',
  'Retired',
  'Homemaker',
] as const;

export const ALUMNI_MEMBERSHIP_BENEFITS = [
  'Attend Alumni Meet',
  'Alumni Directory access',
  'Networking opportunities',
  'Career opportunities',
  'College updates',
  'Volunteer programs',
  'Digital membership card',
] as const;

export const ALUMNI_REGISTRATION_STEPS = [
  { key: 'personal', label: 'Personal Information', icon: 'User' },
  { key: 'contact', label: 'Contact Information', icon: 'Phone' },
  { key: 'education', label: 'Education', icon: 'GraduationCap' },
  { key: 'professional', label: 'Professional Details', icon: 'Briefcase' },
  { key: 'review', label: 'Review & Submit', icon: 'ClipboardCheck' },
] as const;

/** States and Union Territories of India */
export const INDIA_STATES_AND_UTS = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

export function alumniPassingYears(from = 1980, to = new Date().getFullYear()) {
  const years: number[] = [];
  for (let y = to; y >= from; y -= 1) years.push(y);
  return years;
}
