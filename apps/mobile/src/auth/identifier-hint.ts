export type IdentifierHint = {
  label: string;
  tone: string;
  icon: string;
};

export function detectIdentifierHint(raw: string): IdentifierHint | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^BS\d|^BA\d|^BSC|^BCOM|^BBA/i.test(value)) {
    return { label: 'Student', tone: '#2563eb', icon: '👨‍🎓' };
  }
  if (/^REG\d|^ENR\d|^UNI\d/i.test(value)) {
    return { label: 'Student', tone: '#2563eb', icon: '👨‍🎓' };
  }
  if (/^EMP\d|^DBC\d|^STF/i.test(value)) {
    return { label: 'Faculty / Staff', tone: '#0d9488', icon: '👩‍🏫' };
  }
  if (/^ABC/i.test(value)) {
    return { label: 'Student (ABC ID)', tone: '#2563eb', icon: '🪪' };
  }
  if (/^\d{10}$/.test(value)) {
    return { label: 'Registered Mobile', tone: '#7c3aed', icon: '📱' };
  }
  if (value.includes('@')) {
    const lower = value.toLowerCase();
    if (/principal|administrator|admin@|erp-admin/.test(lower)) {
      return { label: 'Administrator', tone: '#be185d', icon: '🏛' };
    }
    if (/hod\.|head\.|dean\./.test(lower)) {
      return { label: 'HOD / Academic Head', tone: '#d97706', icon: '📚' };
    }
    if (/accountant|finance|fees/.test(lower)) {
      return { label: 'Finance / Accounts', tone: '#d97706', icon: '💰' };
    }
    if (/library|librarian/.test(lower)) {
      return { label: 'Librarian', tone: '#7c3aed', icon: '📖' };
    }
    if (/faculty|staff|teacher|prof/.test(lower)) {
      return { label: 'Faculty / Staff', tone: '#0d9488', icon: '👩‍🏫' };
    }
    if (/student|\.edu|\.ac\./.test(lower)) {
      return { label: 'Student', tone: '#2563eb', icon: '👨‍🎓' };
    }
    return { label: 'College Account', tone: '#1e40af', icon: '🔐' };
  }

  return { label: 'College Account', tone: '#64748b', icon: '🔐' };
}

export function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good Morning', icon: '☀️' };
  if (hour < 17) return { text: 'Good Afternoon', icon: '🌤️' };
  return { text: 'Good Evening', icon: '🌙' };
}

export function getSemesterLabel(date = new Date()) {
  const month = date.getMonth() + 1;
  return month >= 7 && month <= 12 ? 'Odd Semester' : 'Even Semester';
}

export function looksLikeCapsLock(password: string) {
  if (password.length < 4) return false;
  const letters = password.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 3) return false;
  return letters === letters.toUpperCase();
}
