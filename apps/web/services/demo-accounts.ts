import { api } from '@/services/api';

export type DemoKind = 'STUDENT' | 'STAFF';

export type DemoAccount = {
  userId: string;
  kind: DemoKind;
  displayName: string;
  loginId: string;
  email: string;
  active: boolean;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
};

export type DemoDevice = {
  id: string;
  appType: string;
  platform: string;
  deviceModel: string | null;
  appVersion: string | null;
  status: string;
  hasPushToken: boolean;
  lastSeenAt: string;
};

export type DemoNotification = {
  id: string;
  title: string;
  body: string;
  pushStatus: string;
  pushDetail: string | null;
  createdAt: string;
  readAt: string | null;
};

const base = '/v1/admin/demo-accounts';

export function fetchDemoAccounts() {
  return api
    .get<{
      created: Array<{ kind: DemoKind; loginId: string; password: string }>;
      accounts: DemoAccount[];
    }>(base)
    .then((res) => res.data);
}

export function createDemoAccount(body: {
  kind: DemoKind;
  loginId?: string;
  displayName?: string;
  password?: string;
}) {
  return api
    .post<{
      userId: string;
      kind: DemoKind;
      loginId: string;
      displayName: string;
      password: string;
    }>(base, body)
    .then((res) => res.data);
}

export function resetDemoPassword(userId: string, password?: string) {
  return api
    .post<{ userId: string; password: string }>(`${base}/${userId}/password`, { password })
    .then((res) => res.data);
}

export function setDemoActive(userId: string, active: boolean) {
  return api
    .patch<{ userId: string; active: boolean }>(`${base}/${userId}/status`, { active })
    .then((res) => res.data);
}

export function fetchDemoDevices(userId: string) {
  return api.get<DemoDevice[]>(`${base}/${userId}/devices`).then((res) => res.data);
}

export function fetchDemoNotifications(userId: string) {
  return api.get<DemoNotification[]>(`${base}/${userId}/notifications`).then((res) => res.data);
}

export function sendDemoNotification(userId: string, title: string, body: string) {
  return api
    .post<{
      id: string;
      pushStatus: string;
      pushDetail: string | null;
      inApp: boolean;
    }>(`${base}/${userId}/notifications`, { title, body })
    .then((res) => res.data);
}
