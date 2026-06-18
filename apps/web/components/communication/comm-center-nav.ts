export const COMM_CENTER_NAV = [
  { label: 'Dashboard', href: '/admin/communication', icon: 'LayoutDashboard' },
  { label: 'Compose', href: '/admin/communication/compose', icon: 'Send' },
  { label: 'Campaigns', href: '/admin/communication/campaigns', icon: 'Megaphone' },
  { label: 'Templates', href: '/admin/communication/templates', icon: 'Mail' },
  { label: 'Audience Builder', href: '/admin/communication/audience', icon: 'Users' },
  { label: 'Scheduled', href: '/admin/communication/scheduled', icon: 'Calendar' },
  { label: 'Bulk Messaging', href: '/admin/communication/bulk', icon: 'Layers' },
  { label: 'Notifications', href: '/admin/communication/notifications', icon: 'Bell' },
  { label: 'Email Center', href: '/admin/communication/email', icon: 'AtSign' },
  { label: 'SMS Center', href: '/admin/communication/sms', icon: 'MessageSquare' },
  { label: 'WhatsApp', href: '/admin/communication/whatsapp', icon: 'Phone' },
  { label: 'Push Center', href: '/admin/communication/push', icon: 'Smartphone' },
  { label: 'Logs', href: '/admin/communication/logs', icon: 'ScrollText' },
  { label: 'Reports', href: '/admin/communication/reports', icon: 'FileBarChart' },
  { label: 'Failed', href: '/admin/communication/failed', icon: 'AlertTriangle' },
  { label: 'Analytics', href: '/admin/communication/analytics', icon: 'BarChart3' },
  { label: 'Approvals', href: '/admin/communication/approvals', icon: 'ShieldCheck' },
  { label: 'Settings', href: '/admin/communication/settings', icon: 'Settings' },
  { label: 'AI Assistant', href: '/admin/communication/ai', icon: 'Sparkles', soon: true },
] as const;

export const MESSAGE_VARIABLES = [
  { key: 'StudentName', label: 'Student Name' },
  { key: 'Department', label: 'Department' },
  { key: 'Semester', label: 'Semester' },
  { key: 'RollNumber', label: 'Roll Number' },
  { key: 'OutstandingFee', label: 'Outstanding Fee' },
  { key: 'Attendance', label: 'Attendance %' },
  { key: 'DueDate', label: 'Due Date' },
  { key: 'LibraryFine', label: 'Library Fine' },
  { key: 'ParentName', label: 'Parent Name' },
] as const;

export const CHANNEL_OPTIONS = [
  { value: 'IN_APP', label: 'In-App Notification' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'PUSH', label: 'Push Notification' },
] as const;

export const AUDIENCE_OPTIONS = [
  { value: 'STUDENTS', label: 'Students' },
  { value: 'PARENTS', label: 'Parents / Guardians' },
  { value: 'FACULTY', label: 'Faculty & Staff' },
  { value: 'DEPARTMENTS', label: 'Departments' },
  { value: 'COMMITTEE', label: 'Committee Members' },
  { value: 'INDIVIDUAL', label: 'Individual Users' },
] as const;
