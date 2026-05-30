"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getNovedadesUnreadSnapshotAction } from "@/features/novedades/actions/novedades.actions";

const NOVEDADES_PATH = "/novedades";
const POLL_MS = 10_000;
const SEEN_STORAGE_PREFIX = "pragma-novedades-seen-at:";

type NovedadesUnreadContextValue = {
  hasUnread: boolean;
  markSeen: (latestAt?: string | null, scopeKey?: string | null) => void;
};

const NovedadesUnreadContext = createContext<NovedadesUnreadContextValue | null>(
  null,
);

function readSeenAt(scopeKey: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${SEEN_STORAGE_PREFIX}${scopeKey}`);
}

function writeSeenAt(scopeKey: string, latestAt: string) {
  window.localStorage.setItem(`${SEEN_STORAGE_PREFIX}${scopeKey}`, latestAt);
}

function computeHasUnread(latestAt: string | null, seenAt: string | null): boolean {
  if (!latestAt) return false;
  if (!seenAt) return true;
  return latestAt > seenAt;
}

export function NovedadesUnreadProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [hasUnread, setHasUnread] = useState(false);
  const scopeKeyRef = useRef<string | null>(null);
  const latestAtRef = useRef<string | null>(null);
  const checkingRef = useRef(false);

  const markSeen = useCallback((latestAt?: string | null, explicitScopeKey?: string | null) => {
    const scopeKey = explicitScopeKey ?? scopeKeyRef.current;
    const value = latestAt ?? latestAtRef.current;

    if (explicitScopeKey) {
      scopeKeyRef.current = explicitScopeKey;
    }
    if (value) {
      latestAtRef.current = value;
    }

    if (!scopeKey || !value) {
      setHasUnread(false);
      return;
    }
    writeSeenAt(scopeKey, value);
    setHasUnread(false);
  }, []);

  useEffect(() => {
    if (pathname !== NOVEDADES_PATH) return;
    markSeen();
  }, [pathname, markSeen]);

  useEffect(() => {
    let cancelled = false;

    async function poll(trigger: string) {
      if (cancelled || checkingRef.current) return;
      if (document.visibilityState !== "visible") return;

      checkingRef.current = true;
      try {
        const result = await getNovedadesUnreadSnapshotAction();
        if (!result.success || cancelled) return;

        scopeKeyRef.current = result.scopeKey;
        const previousLatest = latestAtRef.current;
        latestAtRef.current = result.latestAt;

        const seenAt = readSeenAt(result.scopeKey);
        const onNovedadesPage = pathname === NOVEDADES_PATH;

        if (onNovedadesPage && result.latestAt) {
          writeSeenAt(result.scopeKey, result.latestAt);
          setHasUnread(false);
        } else {
          setHasUnread(computeHasUnread(result.latestAt, seenAt));
        }

        if (
          onNovedadesPage &&
          result.latestAt &&
          previousLatest &&
          result.latestAt !== previousLatest
        ) {
          router.refresh();
        }
      } catch {
        // Ignore polling errors; next interval retries.
      } finally {
        checkingRef.current = false;
      }
    }

    void poll("mount");

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void poll("visible");
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    const intervalId = window.setInterval(() => {
      void poll("interval");
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, router]);

  const value = useMemo(
    () => ({ hasUnread, markSeen }),
    [hasUnread, markSeen],
  );

  return (
    <NovedadesUnreadContext.Provider value={value}>
      {children}
    </NovedadesUnreadContext.Provider>
  );
}

export function useNovedadesUnread(): NovedadesUnreadContextValue {
  const ctx = useContext(NovedadesUnreadContext);
  if (!ctx) {
    return {
      hasUnread: false,
      markSeen: () => undefined,
    };
  }
  return ctx;
}
