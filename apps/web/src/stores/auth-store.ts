import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  changePassword,
  fetchAccessToken,
  fetchMe,
  isJwtExpired,
  signInEmail,
  signOut,
  signUpEmail,
} from '@/apis';
import { i18n } from '@/i18n';
import type { AuthPersist, AuthUser } from '@/types';

type AuthState = {
  sessionToken: string | null;
  accessToken: string | null;
  user: AuthUser | null;
  permissionCodes: string[];
  hydrateSession: (sessionToken: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  ensureAccessToken: () => Promise<string>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      sessionToken: null,
      accessToken: null,
      user: null,
      permissionCodes: [],
      hydrateSession: async (sessionToken) => {
        const accessToken = await fetchAccessToken(sessionToken);
        const me = await fetchMe(accessToken);
        set({
          sessionToken,
          accessToken,
          user: me.user,
          permissionCodes: me.permissionCodes,
        });
      },
      login: async (email, password) => {
        const sessionToken = await signInEmail(email, password);
        await get().hydrateSession(sessionToken);
      },
      register: async (name, email, password) => {
        const sessionToken = await signUpEmail(name, email, password);
        await get().hydrateSession(sessionToken);
      },
      ensureAccessToken: async () => {
        const { sessionToken, accessToken } = get();
        if (!sessionToken) {
          throw new Error(i18n.t('auth.notSignedIn'));
        }
        if (accessToken && !isJwtExpired(accessToken)) {
          return accessToken;
        }
        const next = await fetchAccessToken(sessionToken);
        set({ accessToken: next });
        return next;
      },
      updatePassword: async (currentPassword, newPassword) => {
        const { sessionToken } = get();
        if (!sessionToken) {
          throw new Error(i18n.t('auth.notSignedIn'));
        }
        await changePassword(sessionToken, currentPassword, newPassword);
        const email = get().user?.email;
        if (!email) {
          throw new Error(i18n.t('auth.notSignedIn'));
        }
        const nextSession = await signInEmail(email, newPassword);
        await get().hydrateSession(nextSession);
      },
      logout: async () => {
        const { sessionToken } = get();
        await signOut(sessionToken);
        get().clear();
      },
      clear: () => {
        set({
          sessionToken: null,
          accessToken: null,
          user: null,
          permissionCodes: [],
        });
      },
    }),
    {
      name: 'nexus-auth',
      partialize: (state): AuthPersist => ({
        sessionToken: state.sessionToken,
        accessToken: state.accessToken,
        user: state.user,
        permissionCodes: state.permissionCodes,
      }),
    },
  ),
);
