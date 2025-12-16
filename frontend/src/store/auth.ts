import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const AUTH_SESSION_KEY = 'temple-auth-session-key';
const AUTH_STORAGE_PREFIX = 'temple-auth-store';

const generateSessionIdentifier = (): string =>
  typeof globalThis !== 'undefined' &&
  typeof globalThis.crypto !== 'undefined' &&
  typeof globalThis.crypto.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getSessionIdentifier = (() => {
  let cached: string | null | undefined;

  return () => {
    if (cached !== undefined) {
      return cached;
    }
    if (typeof window === 'undefined') {
      cached = null;
      return cached;
    }
    try {
      const { sessionStorage } = window;
      if (!sessionStorage) {
        cached = null;
        return cached;
      }
      let stored = sessionStorage.getItem(AUTH_SESSION_KEY);
      if (!stored) {
        stored = generateSessionIdentifier();
        sessionStorage.setItem(AUTH_SESSION_KEY, stored);
      }
      cached = stored;
      return cached;
    } catch {
      cached = null;
      return cached;
    }
  };
})();

const AUTH_PERSIST_NAME = (() => {
  const sessionId = getSessionIdentifier();
  return sessionId ? `${AUTH_STORAGE_PREFIX}-${sessionId}` : AUTH_STORAGE_PREFIX;
})();

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface UserProfile {
  id: number;
  phone_number: string;
  name: string;
  email?: string;
  role: 'donor' | 'admin';
}

interface AuthState {
  user?: UserProfile;
  tokens?: AuthTokens;
  setAuth: (payload: { user: UserProfile; tokens: AuthTokens }) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: undefined,
      tokens: undefined,
      setAuth: ({ user, tokens }) => set({ user, tokens }),
      clear: () => set({ user: undefined, tokens: undefined }),
    }),
    {
      name: AUTH_PERSIST_NAME,
    },
  ),
);

export const isAdmin = (role?: string) => role === 'admin';
