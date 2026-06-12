import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { StudentNotificationPrefs, StudentPrivacyPrefs } from '@/types/student-portal-profile';

type StudentPortalSettingsState = {
  notifications: StudentNotificationPrefs;
  privacy: StudentPrivacyPrefs;
  language: string;
  setNotification: (key: keyof StudentNotificationPrefs, value: boolean) => void;
  setPrivacy: (key: keyof StudentPrivacyPrefs, value: boolean) => void;
  setLanguage: (language: string) => void;
  resetSettings: () => void;
};

const DEFAULT_NOTIFICATIONS: StudentNotificationPrefs = {
  examNotifications: true,
  attendanceAlerts: true,
  feeReminders: true,
  timetableUpdates: true,
  lmsNotifications: true,
  certificateUpdates: true,
};

const DEFAULT_PRIVACY: StudentPrivacyPrefs = {
  showMobileToFaculty: false,
  showEmailToFaculty: true,
  hidePersonalInfo: false,
};

export const useStudentPortalSettingsStore = create<StudentPortalSettingsState>()(
  persist(
    (set) => ({
      notifications: DEFAULT_NOTIFICATIONS,
      privacy: DEFAULT_PRIVACY,
      language: 'en',
      setNotification: (key, value) =>
        set((s) => ({
          notifications: { ...s.notifications, [key]: value },
        })),
      setPrivacy: (key, value) =>
        set((s) => ({
          privacy: { ...s.privacy, [key]: value },
        })),
      setLanguage: (language) => set({ language }),
      resetSettings: () =>
        set({
          notifications: DEFAULT_NOTIFICATIONS,
          privacy: DEFAULT_PRIVACY,
          language: 'en',
        }),
    }),
    { name: 'onecampus-student-settings' },
  ),
);
