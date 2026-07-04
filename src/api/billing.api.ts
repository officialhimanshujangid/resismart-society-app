import { apiClient } from './axios';

export const billingApi = {
  getMySubscription: () => apiClient.get('/billing/my-subscription'),
  getPublicPlans: (module: 'society' | 'shop') =>
    apiClient.get(`/plans/public?module=${module}`),
  getInvoices: (page: number, pageSize: number = 10) =>
    apiClient.get(`/billing/invoices?isPagination=true&page=${page}&pageSize=${pageSize}`),
  downloadInvoice: (id: string) => apiClient.get(`/billing/invoices/${id}/download`),

  // Checkout flow
  upgradePreview: (planId: string, tenure: string, intent: string) =>
    apiClient.post('/billing/upgrade-preview', { planId, tenure, intent }),
  checkout: (planId: string, tenure: string, intent: string) =>
    apiClient.post('/billing/checkout', { planId, tenure, intent }),
  verifyPayment: (payload: {
    invoiceId: string;
    razorpay_subscription_id?: string;
    razorpay_order_id?: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => apiClient.post('/billing/verify-payment', payload),

  cancelSubscription: () => apiClient.post('/billing/cancel'),
};
