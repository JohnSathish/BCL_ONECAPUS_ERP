'use client';

let globalDirty = false;

export function setGlobalUnsavedChanges(dirty: boolean): void {
  globalDirty = dirty;
}

export function hasGlobalUnsavedChanges(): boolean {
  return globalDirty;
}

export function confirmGlobalUnsavedDiscard(message = 'You have unsaved changes.'): boolean {
  if (!globalDirty) return true;
  return window.confirm(message);
}
