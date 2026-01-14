import { useCallback, useEffect, useState } from 'react';

import { useAuthStore } from '../store/auth';

type SessionRole = 'donor' | 'admin';

const SESSION_EXPIRY_KEY = 'temple-session-expiry';

const ROLE_DURATION_MINUTES: Record<SessionRole, number> = {
  donor: 10,
  admin: 15,
};

const getDurationForRole = (role?: SessionRole): number => {
  if (!role) {
    return ROLE_DURATION_MINUTES.donor;
  }
  return ROLE_DURATION_MINUTES[role] ?? ROLE_DURATION_MINUTES.donor;
};

const writeStoredExpiry = (value: number | null) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const { sessionStorage } = window;
    if (value === null) {
      sessionStorage.removeItem(SESSION_EXPIRY_KEY);
      return;
    }
    sessionStorage.setItem(SESSION_EXPIRY_KEY, value.toString());
  } catch {
    // Ignore storage errors
  }
};

const getDurationMsForRole = (role?: SessionRole) => getDurationForRole(role) * 60 * 1000;

export interface UseSessionTimeoutOutput {
  shouldShowPrompt: boolean;
  extendSession: () => void;
  handleLogout: () => void;
  role: SessionRole | undefined;
  sessionDurationMinutes: number | null;
  timeLeftMs: number | null;
}

const useSessionTimeout = (): UseSessionTimeoutOutput => {
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clear);
  const [expiryTime, setExpiryTime] = useState<number | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setExpiryTime(null);
      writeStoredExpiry(null);
      setPromptVisible(false);
      return;
    }
    const durationMs = getDurationMsForRole(user.role);
    const nextExpiry = Date.now() + durationMs;
    setExpiryTime(nextExpiry);
    writeStoredExpiry(nextExpiry);
    setTimeLeftMs(durationMs);
    setPromptVisible(false);
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user || !expiryTime) {
      setTimeLeftMs(null);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(expiryTime - now, 0);
      setTimeLeftMs(remaining);
      if (remaining === 0) {
        setPromptVisible(true);
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [expiryTime, user]);

  const extendSession = useCallback(() => {
    if (!user) {
      return;
    }
    const durationMs = getDurationMsForRole(user.role);
    const nextExpiry = Date.now() + durationMs;
    setExpiryTime(nextExpiry);
    writeStoredExpiry(nextExpiry);
    setTimeLeftMs(durationMs);
    setPromptVisible(false);
  }, [user]);

  const handleLogout = useCallback(() => {
    writeStoredExpiry(null);
    setTimeLeftMs(null);
    clearAuth();
  }, [clearAuth]);

  return {
    shouldShowPrompt: promptVisible,
    extendSession,
    handleLogout,
    role: user?.role,
    sessionDurationMinutes: user ? getDurationForRole(user.role) : null,
    timeLeftMs,
  };
};

export default useSessionTimeout;
