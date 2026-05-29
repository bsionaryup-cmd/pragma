"use client";

const PINNED_GROUP_KEY = "pragma-nav-pinned-group";
const SUPPRESSED_GROUP_KEY = "pragma-nav-suppressed-group";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(key);
    return value?.trim() ? value : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readPinnedNavGroupId(): string | null {
  return readStorage(PINNED_GROUP_KEY);
}

export function writePinnedNavGroupId(groupId: string | null): void {
  writeStorage(PINNED_GROUP_KEY, groupId);
}

export function readSuppressedNavGroupId(): string | null {
  return readStorage(SUPPRESSED_GROUP_KEY);
}

export function writeSuppressedNavGroupId(groupId: string | null): void {
  writeStorage(SUPPRESSED_GROUP_KEY, groupId);
}
