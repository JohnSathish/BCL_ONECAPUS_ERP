/**
 * Browser Back on an authenticated Bosco Connect session opens a logout
 * confirmation instead of dropping the user onto the login page.
 * School, library, and applicant portals are not armed.
 */

export const BACK_LOGOUT_GUARD = 'bcLogoutGuard';
export const BACK_LOGOUT_STORE = 'bc-back-logout';
export const BACK_LOGOUT_HREF = 'bc-back-logout-href';
export const BACK_LOGOUT_BUSY = 'bc-back-logout-busy';
export const BACK_LOGOUT_SHOW = 'bc-back-logout-show';
export const BACK_LOGOUT_DONE = 'bc-logged-out-to';
export const BACK_LOGOUT_EVENT = 'bc-back-logout-confirm';

declare global {
  interface Window {
    __bcHasSession?: boolean;
    __bcBackLogoutBound?: boolean;
    __bcHistoryWrapped?: boolean;
    __bcIgnorePop?: boolean;
  }
}

const SKIP_ARM_PREFIXES = [
  '/school-admissions-portal',
  '/school-sis-portal',
  '/school-sis-invite',
  '/library-desk',
  '/opac',
  '/journals-portal',
  '/fee-collection-portal',
  '/admissions-portal',
];

export function isPublicAuthPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/forgot-password' ||
    pathname.endsWith('/login') ||
    pathname.endsWith('/register')
  );
}

function hasPathPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** College ERP only. School and kiosk products keep their existing Back behaviour. */
export function shouldArmBackLogout(input: { schoolSession: boolean; destination: string }) {
  if (input.schoolSession) return false;
  const path = (input.destination.split('?')[0] || '/').split('#')[0] || '/';
  if (!path.startsWith('/')) return false;
  if (isPublicAuthPath(path) || path === '/change-password') return false;
  return !SKIP_ARM_PREFIXES.some((prefix) => hasPathPrefix(path, prefix));
}

export function noteBackLogoutSession(active: boolean) {
  if (typeof window === 'undefined') return;
  window.__bcHasSession = active;
}

export function clearBackLogoutTrap() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(BACK_LOGOUT_STORE);
    sessionStorage.removeItem(BACK_LOGOUT_HREF);
    sessionStorage.removeItem(BACK_LOGOUT_BUSY);
    sessionStorage.removeItem(BACK_LOGOUT_SHOW);
    sessionStorage.removeItem(BACK_LOGOUT_DONE);
  } catch {
    /* private mode */
  }
}

export function markCollegeBackLogoutPending() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(BACK_LOGOUT_STORE, 'pending');
    sessionStorage.removeItem(BACK_LOGOUT_BUSY);
    sessionStorage.removeItem(BACK_LOGOUT_DONE);
    sessionStorage.removeItem(BACK_LOGOUT_SHOW);
    window.__bcHasSession = true;
  } catch {
    /* private mode */
  }
}

/** Confirmed sign-out. Forward/back must not restore a live session. */
export function markBackLogoutConfirmed() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(BACK_LOGOUT_BUSY, '1');
    sessionStorage.setItem(BACK_LOGOUT_DONE, '/login');
    sessionStorage.setItem(BACK_LOGOUT_STORE, 'off');
    sessionStorage.removeItem(BACK_LOGOUT_SHOW);
    window.__bcHasSession = false;
  } catch {
    /* private mode */
  }
}

export const BACK_LOGOUT_BOOT_SCRIPT = `(function () {
  var GUARD = ${JSON.stringify(BACK_LOGOUT_GUARD)};
  var STORE = ${JSON.stringify(BACK_LOGOUT_STORE)};
  var HREF = ${JSON.stringify(BACK_LOGOUT_HREF)};
  var BUSY = ${JSON.stringify(BACK_LOGOUT_BUSY)};
  var SHOW = ${JSON.stringify(BACK_LOGOUT_SHOW)};
  var DONE = ${JSON.stringify(BACK_LOGOUT_DONE)};
  var EVENT_NAME = ${JSON.stringify(BACK_LOGOUT_EVENT)};
  var arming = false;

  function isPublic(pathname) {
    if (!pathname) return false;
    return (
      pathname === '/login' ||
      pathname.indexOf('/login/') === 0 ||
      pathname === '/forgot-password' ||
      pathname.slice(-6) === '/login' ||
      pathname.slice(-9) === '/register'
    );
  }

  function isCollegeLogin(pathname) {
    return pathname === '/login' || pathname.indexOf('/login/') === 0;
  }

  function currentHref() {
    return location.pathname + location.search + location.hash;
  }

  function remember() {
    if (sessionStorage.getItem(STORE) !== 'armed') return;
    if (sessionStorage.getItem(BUSY) === '1') return;
    if (isPublic(location.pathname)) return;
    sessionStorage.setItem(HREF, currentHref());
  }

  function showConfirm() {
    sessionStorage.setItem(SHOW, '1');
    try {
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    } catch (e) {}
  }

  function armIfPending() {
    if (arming) return;
    if (sessionStorage.getItem(STORE) !== 'pending') return;
    if (isPublic(location.pathname) || location.pathname === '/change-password') return;
    arming = true;
    try {
      var raw = history.state;
      var state = raw && typeof raw === 'object' ? Object.assign({}, raw) : {};
      if (state[GUARD] !== 1) {
        state[GUARD] = 1;
        history.pushState(state, '', currentHref());
      }
      sessionStorage.setItem(STORE, 'armed');
      sessionStorage.setItem(HREF, currentHref());
    } finally {
      arming = false;
    }
  }

  function ensureGuard() {
    if (arming) return;
    if (sessionStorage.getItem(STORE) !== 'armed') return;
    if (isPublic(location.pathname) || location.pathname === '/change-password') return;
    var raw = history.state;
    var state = raw && typeof raw === 'object' ? Object.assign({}, raw) : {};
    if (state[GUARD] === 1) return;
    arming = true;
    try {
      state[GUARD] = 1;
      history.pushState(state, '', currentHref());
      sessionStorage.setItem(HREF, currentHref());
    } finally {
      arming = false;
    }
  }

  function afterHistory() {
    if (arming) return;
    try {
      armIfPending();
      remember();
    } catch (e) {}
  }

  function onPop(event) {
    try {
      if (window.__bcIgnorePop) {
        window.__bcIgnorePop = false;
        return;
      }
      var loggedOutTo = sessionStorage.getItem(DONE);
      if (loggedOutTo) {
        if (!isPublic(location.pathname)) {
          if (event && event.stopImmediatePropagation) event.stopImmediatePropagation();
          location.replace(loggedOutTo);
        }
        return;
      }
      if (sessionStorage.getItem(BUSY) === '1') return;
      if (window.__bcHasSession === false) return;
      if (sessionStorage.getItem(STORE) !== 'armed') return;
      var path = location.pathname;
      if (path === '/change-password') {
        sessionStorage.setItem(HREF, currentHref());
        return;
      }
      if (isCollegeLogin(path)) {
        if (event && event.stopImmediatePropagation) event.stopImmediatePropagation();
        var backTo = sessionStorage.getItem(HREF) || '/admin';
        var loginState = {};
        loginState[GUARD] = 1;
        arming = true;
        try {
          history.pushState(loginState, '', backTo);
        } finally {
          arming = false;
        }
        sessionStorage.setItem(HREF, backTo);
        showConfirm();
        return;
      }
      var href = currentHref();
      var raw = history.state;
      var guarded = !!(raw && raw[GUARD] === 1);
      if (guarded || isPublic(path)) {
        if (!isPublic(path)) sessionStorage.setItem(HREF, href);
        return;
      }
      var last = sessionStorage.getItem(HREF);
      if (!last) {
        sessionStorage.setItem(HREF, href);
        return;
      }
      if (href !== last) {
        sessionStorage.setItem(HREF, href);
        return;
      }
      if (event && event.stopImmediatePropagation) event.stopImmediatePropagation();
      var state = raw && typeof raw === 'object' ? Object.assign({}, raw) : {};
      state[GUARD] = 1;
      arming = true;
      try {
        history.pushState(state, '', href);
      } finally {
        arming = false;
      }
      sessionStorage.setItem(HREF, href);
      showConfirm();
    } catch (e) {}
  }

  function readNav() {
    try {
      var entries = performance.getEntriesByType('navigation');
      var nav = entries && entries[0];
      return (nav && nav.type) || '';
    } catch (e) {
      return '';
    }
  }

  try {
    var loggedOutTo = sessionStorage.getItem(DONE);
    if (loggedOutTo && !isPublic(location.pathname)) {
      location.replace(loggedOutTo);
      return;
    }
    if (!window.__bcHistoryWrapped) {
      window.__bcHistoryWrapped = true;
      var originalPush = history.pushState.bind(history);
      var originalReplace = history.replaceState.bind(history);
      history.pushState = function () {
        var result = originalPush.apply(history, arguments);
        afterHistory();
        return result;
      };
      history.replaceState = function () {
        var result = originalReplace.apply(history, arguments);
        afterHistory();
        return result;
      };
    }
    if (!window.__bcBackLogoutBound) {
      window.__bcBackLogoutBound = true;
      window.addEventListener('popstate', onPop, true);
      window.addEventListener('pageshow', function (event) {
        try {
          var dest = sessionStorage.getItem(DONE);
          if (dest && !isPublic(location.pathname)) {
            location.replace(dest);
            return;
          }
          if (event && event.persisted && sessionStorage.getItem(SHOW) === '1') {
            window.dispatchEvent(new CustomEvent(EVENT_NAME));
          }
        } catch (e) {}
      });
    }
    armIfPending();
    if (sessionStorage.getItem(SHOW) === '1') ensureGuard();
    if (
      isCollegeLogin(location.pathname) &&
      sessionStorage.getItem(STORE) === 'armed' &&
      !sessionStorage.getItem(DONE) &&
      readNav() === 'back_forward'
    ) {
      sessionStorage.setItem(SHOW, '1');
      var stayed = location.href;
      history.forward();
      setTimeout(function () {
        try {
          if (location.href === stayed) sessionStorage.removeItem(SHOW);
        } catch (e) {}
      }, 80);
    }
  } catch (e) {}
})();
`;
