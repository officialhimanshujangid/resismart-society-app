import { apiClient } from './axios';

export interface LoginRequest {
  identifier: string; // Updated from email
  password?: string;
}

export interface ProfileInfo {
  tenantType: 'SOCIETY' | 'SHOP' | 'SYSTEM' | string;
  tenantId: string;
  role: string;
}

export interface UserInfo {
  name: string;
  email: string;
  phone?: string;
}

export interface IContext {
  contextId: string;
  kind: 'SOCIETY_UNIT' | 'SHOP' | 'ADMIN';
  tenantType: 'SYSTEM' | 'SOCIETY' | 'SHOP';
  tenantId: string;
  tenantName: string;
  unitType: 'FLAT' | 'SHOP' | null;
  unitId: string | null;
  unitLabel: string | null;
  role: string;
}

export interface LoginResponse {
  message?: string;
  useOtp?: boolean;
  token?: string;
  refreshToken?: string;
  activeContext?: IContext;
  availableContexts?: IContext[];
  user?: UserInfo;
}

export interface OtpRequestData {
  identifier: string;
}

export interface OtpRequestResponse {
  devCode?: string;
  channel?: string;
}

export interface OtpVerifyData {
  identifier: string;
  code: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', data),

  loginOtpRequest: (data: OtpRequestData) =>
    apiClient.post<OtpRequestResponse>('/auth/login/otp/request', data),

  loginOtpVerify: (data: OtpVerifyData) =>
    apiClient.post<LoginResponse>('/auth/login/otp/verify', data),

  forgotPassword: (data: ForgotPasswordRequest) =>
    apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', data),

  refreshToken: (refreshToken: string, contextId?: string) =>
    apiClient.post('/auth/refresh-token', { refreshToken, contextId }),
};
