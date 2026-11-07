import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import vm from 'node:vm';
import {
  BACK_LOGOUT_BOOT_SCRIPT,
  BACK_LOGOUT_DONE,
  BACK_LOGOUT_GUARD,
  BACK_LOGOUT_HREF,
  BACK_LOGOUT_SHOW,
  BACK_LOGOUT_STORE,
  clearBackLogoutTrap,
  isPublicAuthPath,
  markBackLogoutConfirmed,
  markCollegeBackLogoutPending,
  shouldArmBackLogout,
} from './back-logout-history';

type Entry = {
  pathname: string;
  search: string;
  hash: string;
  state: Record<string, unknown> | null;
};

function createHarness(options?: {
  pathname?: string;
  stack?: Entry[];
  index?: number;
  navType?: string;
}) {
  const listeners: Record<
    string,
    Array<
      (event: { type?: string; persisted?: boolean; stopImmediatePropagation?: () => void }) => void
    >
  > = {};
  const timers: Array<() => void> = [];
  const start = options?.pathname ?? '/admin';
  const stack: Entry[] = options?.stack ?? [{ pathname: start, search: '', hash: '', state: null }];
  let index = options?.index ?? stack.length - 1;
  const location = {
    pathname: stack[index]?.pathname ?? start,
    search: stack[index]?.search ?? '',
    hash: stack[index]?.hash ?? '',
    get href() {
      return `http://localhost${this.pathname}${this.search}${this.hash}`;
    },
    replace(url: string) {
      applyUrl(this, url);
      stack[index] = {
        pathname: this.pathname,
        search: this.search,
        hash: this.hash,
        state: stack[index]?.state ?? null,
      };
    },
  };
  const history = {
    get state() {
      return stack[index]?.state ?? null;
    },
    pushState(state: Record<string, unknown> | null, _title: string, url?: string) {
      if (typeof url === 'string') applyUrl(location, url);
      stack.splice(index + 1);
      stack.push({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        state,
      });
      index = stack.length - 1;
    },
    replaceState(state: Record<string, unknown> | null, _title: string, url?: string) {
      if (typeof url === 'string') applyUrl(location, url);
      stack[index] = {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        state,
      };
    },
    back() {
      if (index === 0) return;
      index -= 1;
      restore();
      emit('popstate');
    },
    forward() {
      if (index >= stack.length - 1) return;
      index += 1;
      restore();
      emit('popstate');
    },
  };
  function restore() {
    const entry = stack[index];
    if (!entry) return;
    location.pathname = entry.pathname;
    location.search = entry.search;
    location.hash = entry.hash;
  }
  function emit(type: string) {
    const event = {
      type,
      persisted: false,
      stopped: false,
      stopImmediatePropagation() {
        this.stopped = true;
      },
    };
    for (const fn of [...(listeners[type] ?? [])]) {
      fn(event);
      if (event.stopped) break;
    }
    return event;
  }
  const browserWindow = {
    __bcHasSession: undefined as boolean | undefined,
    __bcBackLogoutBound: undefined as boolean | undefined,
    __bcHistoryWrapped: undefined as boolean | undefined,
    __bcIgnorePop: undefined as boolean | undefined,
    addEventListener(type: string, fn: (event: { stopImmediatePropagation?: () => void }) => void) {
      (listeners[type] ??= []).push(fn);
    },
    dispatchEvent(event: { type: string }) {
      for (const fn of listeners[event.type] ?? []) fn(event);
      return true;
    },
  };
  const storage = memoryStorage();
  const sandbox = {
    Object,
    Array,
    Boolean,
    Error,
    setTimeout(fn: () => void) {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout() {
      return undefined;
    },
    CustomEvent: class CustomEvent {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
    performance: {
      getEntriesByType(kind: string) {
        return kind === 'navigation' ? [{ type: options?.navType ?? 'navigate' }] : [];
      },
    },
    window: browserWindow,
    history,
    location,
    sessionStorage: storage,
  };
  vm.createContext(sandbox);
  return {
    sandbox,
    location,
    history,
    storage,
    stack,
    listeners,
    window: browserWindow,
    flushTimers() {
      const pending = timers.splice(0);
      for (const fn of pending) fn();
    },
    install() {
      vm.runInContext(BACK_LOGOUT_BOOT_SCRIPT, sandbox);
    },
  };
}

function applyUrl(location: { pathname: string; search: string; hash: string }, url: string) {
  let path = url;
  if (path.startsWith('http')) {
    const parsed = new URL(path);
    location.pathname = parsed.pathname;
    location.search = parsed.search;
    location.hash = parsed.hash;
    return;
  }
  const hashAt = path.indexOf('#');
  const hash = hashAt >= 0 ? path.slice(hashAt) : '';
  if (hashAt >= 0) path = path.slice(0, hashAt);
  const queryAt = path.indexOf('?');
  location.hash = hash;
  location.search = queryAt >= 0 ? path.slice(queryAt) : '';
  const pathname = queryAt >= 0 ? path.slice(0, queryAt) : path;
  if (pathname) location.pathname = pathname;
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

describe('back logout arming', () => {
  it('arms only the college ERP', () => {
    assert.equal(shouldArmBackLogout({ schoolSession: false, destination: '/admin' }), true);
    assert.equal(
      shouldArmBackLogout({ schoolSession: false, destination: '/admin/students?page=2' }),
      true,
    );
    assert.equal(
      shouldArmBackLogout({ schoolSession: false, destination: '/staff/dashboard' }),
      true,
    );
    assert.equal(shouldArmBackLogout({ schoolSession: false, destination: '/student' }), true);
    assert.equal(shouldArmBackLogout({ schoolSession: true, destination: '/admin' }), false);
    assert.equal(
      shouldArmBackLogout({ schoolSession: false, destination: '/library-desk' }),
      false,
    );
    assert.equal(
      shouldArmBackLogout({
        schoolSession: false,
        destination: '/school-admissions-portal/dashboard',
      }),
      false,
    );
    assert.equal(
      shouldArmBackLogout({ schoolSession: false, destination: '/school-sis-portal/student' }),
      false,
    );
    assert.equal(shouldArmBackLogout({ schoolSession: false, destination: '/opac' }), false);
    assert.equal(
      shouldArmBackLogout({ schoolSession: false, destination: '/admissions-portal/dashboard' }),
      false,
    );
    assert.equal(
      shouldArmBackLogout({ schoolSession: false, destination: '/change-password' }),
      false,
    );
    assert.equal(shouldArmBackLogout({ schoolSession: false, destination: '/login' }), false);
  });

  it('treats auth screens as public', () => {
    assert.equal(isPublicAuthPath('/login'), true);
    assert.equal(isPublicAuthPath('/login/admin-verify'), true);
    assert.equal(isPublicAuthPath('/school-admissions-portal/login'), true);
    assert.equal(isPublicAuthPath('/admin'), false);
  });
});

describe('back logout history script', () => {
  it('adds one sentinel after login and keeps sidebar Back inside the app', () => {
    const harness = createHarness({ pathname: '/admin' });
    harness.storage.setItem(BACK_LOGOUT_STORE, 'pending');
    harness.install();

    assert.equal(harness.storage.getItem(BACK_LOGOUT_STORE), 'armed');
    assert.equal(harness.stack.length, 2);
    assert.equal(harness.history.state?.[BACK_LOGOUT_GUARD], 1);
    assert.equal(harness.listeners.popstate?.length, 1);

    harness.history.pushState(null, '', '/admin/students');
    assert.equal(harness.location.pathname, '/admin/students');
    assert.equal(harness.history.state, null);
    assert.equal(harness.storage.getItem(BACK_LOGOUT_HREF), '/admin/students');

    harness.history.back();
    assert.equal(harness.location.pathname, '/admin');
    assert.equal(harness.storage.getItem(BACK_LOGOUT_SHOW), null);
    assert.equal(harness.history.state?.[BACK_LOGOUT_GUARD], 1);

    harness.history.back();
    assert.equal(harness.location.pathname, '/admin');
    assert.equal(harness.storage.getItem(BACK_LOGOUT_SHOW), '1');
    assert.equal(harness.storage.getItem(BACK_LOGOUT_DONE), null);
    assert.equal(harness.history.state?.[BACK_LOGOUT_GUARD], 1);
  });

  it('does not log out on a query-string Back', () => {
    const harness = createHarness({ pathname: '/admin' });
    harness.storage.setItem(BACK_LOGOUT_STORE, 'pending');
    harness.install();
    harness.history.pushState(null, '', '/admin/students?page=2');
    harness.history.pushState(null, '', '/admin/students?page=1');
    harness.history.back();
    assert.equal(harness.location.search, '?page=2');
    assert.equal(harness.storage.getItem(BACK_LOGOUT_SHOW), null);
  });

  it('keeps repeated Back presses on the dashboard until the user confirms', () => {
    const harness = createHarness({ pathname: '/admin' });
    harness.storage.setItem(BACK_LOGOUT_STORE, 'pending');
    harness.install();
    harness.history.back();
    harness.history.back();
    harness.history.back();
    assert.equal(harness.location.pathname, '/admin');
    assert.equal(harness.storage.getItem(BACK_LOGOUT_SHOW), '1');
    assert.equal(harness.storage.getItem(BACK_LOGOUT_DONE), null);
    assert.equal(harness.history.state?.[BACK_LOGOUT_GUARD], 1);
  });

  it('does not ask again after the session is already cleared', () => {
    const harness = createHarness({ pathname: '/admin' });
    harness.storage.setItem(BACK_LOGOUT_STORE, 'pending');
    harness.install();
    harness.window.__bcHasSession = false;
    harness.history.back();
    assert.equal(harness.storage.getItem(BACK_LOGOUT_SHOW), null);
  });

  it('sends a confirmed logout back to login instead of the dashboard', () => {
    const harness = createHarness({ pathname: '/admin' });
    harness.storage.setItem(BACK_LOGOUT_STORE, 'pending');
    harness.install();
    harness.storage.setItem(BACK_LOGOUT_DONE, '/login');
    harness.history.back();
    assert.equal(harness.location.pathname, '/login');
    assert.equal(harness.storage.getItem(BACK_LOGOUT_SHOW), null);
  });

  it('does not arm school or anonymous dashboard loads', () => {
    const harness = createHarness({ pathname: '/admin' });
    harness.install();
    assert.equal(harness.stack.length, 1);
    assert.equal(harness.storage.getItem(BACK_LOGOUT_STORE), null);
  });

  it('arms when a client replace lands on the college home', () => {
    const harness = createHarness({ pathname: '/change-password' });
    harness.install();
    harness.storage.setItem(BACK_LOGOUT_STORE, 'pending');
    harness.history.replaceState(null, '', '/admin');
    assert.equal(harness.location.pathname, '/admin');
    assert.equal(harness.storage.getItem(BACK_LOGOUT_STORE), 'armed');
    assert.equal(harness.history.state?.[BACK_LOGOUT_GUARD], 1);
  });

  it('returns from the login page when Back left the live session', () => {
    const harness = createHarness({
      pathname: '/login',
      navType: 'back_forward',
      stack: [
        { pathname: '/login', search: '', hash: '', state: null },
        { pathname: '/admin', search: '', hash: '', state: { [BACK_LOGOUT_GUARD]: 1 } },
      ],
      index: 0,
    });
    harness.storage.setItem(BACK_LOGOUT_STORE, 'armed');
    harness.storage.setItem(BACK_LOGOUT_HREF, '/admin');
    harness.install();
    harness.flushTimers();
    assert.equal(harness.location.pathname, '/admin');
    assert.equal(harness.storage.getItem(BACK_LOGOUT_SHOW), '1');
  });

  it('stays on login when there is nothing to restore', () => {
    const harness = createHarness({ pathname: '/login', navType: 'back_forward' });
    harness.storage.setItem(BACK_LOGOUT_STORE, 'armed');
    harness.install();
    harness.flushTimers();
    assert.equal(harness.location.pathname, '/login');
    assert.equal(harness.storage.getItem(BACK_LOGOUT_SHOW), null);
  });

  it('replaces a protected page after logout has been confirmed', () => {
    const harness = createHarness({ pathname: '/admin' });
    harness.storage.setItem(BACK_LOGOUT_DONE, '/login');
    harness.install();
    assert.equal(harness.location.pathname, '/login');
    assert.equal(harness.stack.length, 1);
  });

  it('installs the popstate listener once', () => {
    const harness = createHarness({ pathname: '/admin' });
    harness.storage.setItem(BACK_LOGOUT_STORE, 'pending');
    harness.install();
    harness.install();
    assert.equal(harness.listeners.popstate?.length, 1);
    assert.equal(harness.stack.length, 2);
  });
});

describe('back logout confirmation flags', () => {
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.sessionStorage;

  afterEach(() => {
    if (previousWindow === undefined) {
      // @ts-expect-error test cleanup
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
    if (previousStorage === undefined) {
      // @ts-expect-error test cleanup
      delete globalThis.sessionStorage;
    } else {
      globalThis.sessionStorage = previousStorage;
    }
  });

  it('does not mark the session revoked when the user stays', () => {
    const storage = memoryStorage();
    globalThis.window = { __bcHasSession: true } as unknown as Window & typeof globalThis.window;
    globalThis.sessionStorage = storage as unknown as Storage;
    markCollegeBackLogoutPending();
    assert.equal(storage.getItem(BACK_LOGOUT_STORE), 'pending');
    assert.equal(storage.getItem(BACK_LOGOUT_DONE), null);
    clearBackLogoutTrap();
    assert.equal(storage.getItem(BACK_LOGOUT_STORE), null);
  });

  it('records a confirmed logout without leaving the show flag set', () => {
    const storage = memoryStorage();
    globalThis.window = { __bcHasSession: true } as unknown as Window & typeof globalThis.window;
    globalThis.sessionStorage = storage as unknown as Storage;
    markCollegeBackLogoutPending();
    storage.setItem(BACK_LOGOUT_SHOW, '1');
    markBackLogoutConfirmed();
    assert.equal(storage.getItem(BACK_LOGOUT_DONE), '/login');
    assert.equal(storage.getItem(BACK_LOGOUT_STORE), 'off');
    assert.equal(storage.getItem(BACK_LOGOUT_SHOW), null);
    assert.equal(globalThis.window.__bcHasSession, false);
  });
});
