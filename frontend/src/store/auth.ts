import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      name: 'temple-auth-store',
    },
  ),
);

export const isAdmin = (role?: string) => role === 'admin';
