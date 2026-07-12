import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, IContext, UserInfo } from '../api/auth.api';
import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../constants/app';
import { router } from 'expo-router';
import { eventEmitter } from '../utils/events';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  activeContext: IContext | null;
  availableContexts: IContext[];
  user: UserInfo | null;
}

interface AuthContextType extends AuthState {
  login: (identifier: string, password: string) => Promise<LoginResult>;
  loginOtpRequest: (identifier: string) => Promise<OtpRequestResult>;
  loginOtpVerify: (identifier: string, code: string) => Promise<LoginResult>;
  switchContext: (contextId: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export interface LoginResult {
  success: boolean;
  useOtp?: boolean;
  error?: string;
}

export interface OtpRequestResult {
  success: boolean;
  devCode?: string;
  channel?: string;
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
    activeContext: null,
    availableContexts: [],
    user: null,
  });

  // Hydrate auth state from secure storage on app startup
  useEffect(() => {
    (async () => {
      try {
        const token = await storage.get(STORAGE_KEYS.ACCESS_TOKEN);
        const refreshToken = await storage.get(STORAGE_KEYS.REFRESH_TOKEN);
        const activeContext = await storage.getObject<IContext>('activeContext');
        const availableContexts = await storage.getObject<IContext[]>('availableContexts');
        const user = await storage.getObject<UserInfo>(STORAGE_KEYS.USER_INFO);

        if (token && refreshToken && activeContext) {
          try {
            // Hit refresh endpoint to restore session
            const { data } = await authApi.refreshToken(refreshToken, activeContext.contextId);
            if (data.token && data.refreshToken) {
              await persistSession(data.token, data.refreshToken, data.activeContext || activeContext, data.availableContexts || availableContexts || [], data.user || user);
            }
          } catch (err) {
            console.log('Auto-login refresh failed', err);
            await handleLogout();
          }
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
    const unsubscribe = eventEmitter.on('logout', async () => {
      await handleLogout();
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (identifier: string, password: string): Promise<LoginResult> => {
    try {
      const { data } = await authApi.login({ identifier, password });
      
      if (data.token && data.refreshToken && data.activeContext) {
        if (data.activeContext.tenantType !== 'SOCIETY') {
          return { success: false, error: 'Your account does not have access to the Society panel.' };
        }
        await persistSession(data.token, data.refreshToken, data.activeContext, data.availableContexts || [], data.user ?? null);
        return { success: true };
      }
      return { success: false, error: 'Unexpected response from server.' };
    } catch (err: any) {
      if (err?.response?.data?.useOtp) {
        return { success: false, useOtp: true, error: err.response.data.error };
      }
      return { success: false, error: err?.response?.data?.error || 'Login failed' };
    }
  }, []);

  const loginOtpRequest = useCallback(async (identifier: string): Promise<OtpRequestResult> => {
    try {
      const { data } = await authApi.loginOtpRequest({ identifier });
      return { success: true, devCode: data.devCode, channel: data.channel };
    } catch (err: any) {
      if (err.response?.status === 429) return { success: false, error: 'Please wait before requesting another code.' };
      return { success: false, error: err?.response?.data?.error || 'Failed to send OTP' };
    }
  }, []);

  const loginOtpVerify = useCallback(async (identifier: string, code: string): Promise<LoginResult> => {
    try {
      const { data } = await authApi.loginOtpVerify({ identifier, code });
      
      if (data.token && data.refreshToken && data.activeContext) {
        if (data.activeContext.tenantType !== 'SOCIETY') {
          return { success: false, error: 'Your account does not have access to the Society panel.' };
        }
        await persistSession(data.token, data.refreshToken, data.activeContext, data.availableContexts || [], data.user ?? null);
        return { success: true };
      }
      return { success: false, error: 'Unexpected response' };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error || 'Verification failed' };
    }
  }, []);

  const switchContext = useCallback(async (contextId: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const refreshToken = await storage.get(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) throw new Error('No refresh token');
      
      const { data } = await authApi.refreshToken(refreshToken, contextId);
      if (data.token && data.refreshToken && data.activeContext) {
        await persistSession(data.token, data.refreshToken, data.activeContext, data.availableContexts || state.availableContexts, state.user);
        return true;
      }
      return false;
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false }));
      return false;
    }
  }, [state.availableContexts, state.user]);

  const handleLogout = async () => {
    await storage.delete(STORAGE_KEYS.ACCESS_TOKEN);
    await storage.delete(STORAGE_KEYS.REFRESH_TOKEN);
    await storage.delete('activeContext');
    await storage.delete('availableContexts');
    await storage.delete(STORAGE_KEYS.USER_INFO);
    await storage.delete(STORAGE_KEYS.USER_PROFILE); // Clean up legacy
    setState({ isAuthenticated: false, isLoading: false, token: null, activeContext: null, availableContexts: [], user: null });
    router.replace('/(auth)/login');
  };

  const logout = useCallback(async () => {
    await handleLogout();
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function persistSession(
    token: string,
    refreshToken: string,
    activeContext: IContext,
    availableContexts: IContext[],
    user: UserInfo | null
  ) {
    await storage.set(STORAGE_KEYS.ACCESS_TOKEN, token);
    await storage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    await storage.setObject('activeContext', activeContext);
    await storage.setObject('availableContexts', availableContexts);
    if (user) await storage.setObject(STORAGE_KEYS.USER_INFO, user);
    
    setState({ isAuthenticated: true, isLoading: false, token, activeContext, availableContexts, user });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, loginOtpRequest, loginOtpVerify, switchContext, logout }}>
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
