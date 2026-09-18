export function isCollegeErpLicenseKey(key: string) {
  const k = key.trim().toUpperCase();
  if (
    k.startsWith('BCL-SLS-') ||
    k.startsWith('BCL1.') ||
    k.startsWith('BCL-ONC-')
  ) {
    return false;
  }
  return (
    /^BCL-\d{4}-/.test(k) || /^BCL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}/.test(k)
  );
}

/** Any BaseCode Central product key (BCL-XXX-HHHH-HHHH-HHHH). */
export function isBaseCodeCentralProductKey(key: string) {
  return /^BCL-[A-Z]{3}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(key.trim());
}

/** OneCampus ERP keys that St. Luke's may activate against Central. */
export function isOneCampusCentralKey(key: string) {
  return /^BCL-ONC-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(key.trim());
}
