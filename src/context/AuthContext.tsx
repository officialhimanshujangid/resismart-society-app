import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, ProfileInfo, UserInfo } from '../api/auth.api';
import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../constants/app';
import { router } from 'expo-router';
import { eventEmitter } from '../utils/events';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  profile: ProfileInfo | null;
  user: UserInfo | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<LoginResult>;
  selectContext: (userId: string, tenantId: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
}

export interface LoginResult {
  success: boolean;
  requiresContextSelection?: boolean;
  profiles?: ProfileInfo[];
  userId?: string;
  error?: string;
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    token: null,
    profile: null,
    user: null,
  });

  // Hydrate auth state from secure storage on app startup
  useEffect(() => {
    (async () => {
      try {
        const token = await storage.get(STORAGE_KEYS.ACCESS_TOKEN);
        const profile = await storage.getObject<ProfileInfo>(STORAGE_KEYS.USER_PROFILE);
        const user = await storage.getObject<UserInfo>(STORAGE_KEYS.USER_INFO);

        if (token && profile) {
          setState({ isAuthenticated: true, isLoading: false, token, profile, user });
        } else {
          setState((s) => ({ ...s, isLoading: false }));
        }
      } catch {
        setState((s) => ({ ...s, isLoading: false }));
      }
    })();
  }, []);

  // Listen for global logout events (e.g. from axios interceptor on refresh failure)
  useEffect(() => {
    const unsubscribe = eventEmitter.on('logout', () => {
      setState({ isAuthenticated: false, isLoading: false, token: null, profile: null, user: null });
      router.replace('/(auth)/login');
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const { data } = await authApi.login({ email, password });

      if (data.requiresContextSelection && data.profiles && data.userId) {
        // Filter to only SOCIETY profiles for this app
        const societyProfiles = data.profiles.filter(
          (p: ProfileInfo) => p.tenantType === 'SOCIETY'
        );

        if (societyProfiles.length === 0) {
          return {
            success: false,
            error: 'Your account does not have access to the Society panel. Please use the Shop app or contact your administrator.',
          };
        }

        // If only one society profile, auto-select it
        if (societyProfiles.length === 1) {
          const p = societyProfiles[0];
          const { data: ctxData } = await authApi.selectContext({
            userId: data.userId,
            tenantId: p.tenantId,
            role: p.role,
          });
          await persistSession(ctxData.token, ctxData.refreshToken, ctxData.profile, null);
          return { success: true };
        }

        // Multiple society profiles — show picker
        return {
          success: false,
          requiresContextSelection: true,
          profiles: societyProfiles,
          userId: data.userId,
        };
      }

      if (data.token && data.refreshToken && data.profile) {
        // Auto-selected single profile — verify it is a SOCIETY profile
        if (data.profile.tenantType !== 'SOCIETY') {
          return {
            success: false,
            error: 'Your account does not have access to the Society panel. Please use the Shop app or contact your administrator.',
          };
        }
        await persistSession(data.token, data.refreshToken, data.profile, data.user ?? null);
        return { success: true };
      }

      return { success: false, error: 'Unexpected response from server.' };
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Login failed. Please try again.';
      return { success: false, error: message };
    }
  }, []);

  const selectContext = useCallback(async (userId: string, tenantId: string, role: string) => {
    const { data } = await authApi.selectContext({ userId, tenantId, role });
    await persistSession(data.token, data.refreshToken, data.profile, null);
  }, []);

  const logout = useCallback(async () => {
    await storage.delete(STORAGE_KEYS.ACCESS_TOKEN);
    await storage.delete(STORAGE_KEYS.REFRESH_TOKEN);
    await storage.delete(STORAGE_KEYS.USER_PROFILE);
    await storage.delete(STORAGE_KEYS.USER_INFO);
    setState({ isAuthenticated: false, isLoading: false, token: null, profile: null, user: null });
    router.replace('/(auth)/login');
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function persistSession(
    token: string,
    refreshToken: string,
    profile: ProfileInfo,
    user: UserInfo | null
  ) {
    await storage.set(STORAGE_KEYS.ACCESS_TOKEN, token);
    await storage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    await storage.setObject(STORAGE_KEYS.USER_PROFILE, profile);
    if (user) await storage.setObject(STORAGE_KEYS.USER_INFO, user);
    setState({ isAuthenticated: true, isLoading: false, token, profile, user });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, selectContext, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
