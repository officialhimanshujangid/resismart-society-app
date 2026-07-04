import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../constants/app';
import { storage } from '../utils/storage';
import { eventEmitter } from '../utils/events';

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Request interceptor: attach token ─────────────────────────────────────────
apiClient.interceptors.request.use(
  async (config) => {
    const token = await storage.get(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 ──────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Attempt silent token refresh on first 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      isRefreshing = true;

      try {
        const refreshToken = await storage.get(STORAGE_KEYS.REFRESH_TOKEN);
        const profile = await storage.getObject<{ tenantId: string; role: string }>(STORAGE_KEYS.USER_PROFILE);

        if (!refreshToken) throw new Error('No refresh token');

        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
          tenantId: profile?.tenantId,
          role: profile?.role,
        });

        const { token, refreshToken: newRefresh } = response.data;
        await storage.set(STORAGE_KEYS.ACCESS_TOKEN, token);
        await storage.set(STORAGE_KEYS.REFRESH_TOKEN, newRefresh);

        processQueue(null, token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // Clear all storage on refresh failure
        await storage.delete(STORAGE_KEYS.ACCESS_TOKEN);
        await storage.delete(STORAGE_KEYS.REFRESH_TOKEN);
        await storage.delete(STORAGE_KEYS.USER_PROFILE);
        await storage.delete(STORAGE_KEYS.USER_INFO);
        
        eventEmitter.emit('logout');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
