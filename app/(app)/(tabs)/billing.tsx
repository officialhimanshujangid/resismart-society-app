import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Alert,
  Linking,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
// Safe import — returns null in Expo Go where the native module is absent.
// To use Razorpay for real, run `npx expo run:android` to build a dev client.
const RazorpayCheckout: any =
  (() => { try { return require('react-native-razorpay').default ?? require('react-native-razorpay'); } catch { return null; } })();
import Toast from 'react-native-toast-message';

import { billingApi } from '../../../src/api/billing.api';
import { useAuth } from '../../../src/context/AuthContext';
import { Colors } from '../../../src/constants/colors';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

// ─────────────── Types ───────────────
interface Plan {
  _id: string;
  name: string;
  description?: string;
  basePrice: number;
  isFeatured: boolean;
  capabilities: Record<string, number>;
  computedPricing?: {
    tenure: string;
    label: string;
    totalPrice: number;
    perMonthEquivalent: number;
    savedAmount: number;
    discountPercent: number;
  }[];
}

interface Invoice {
  _id: string;
  invoiceType: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt?: string;
  customInvoiceNumber?: string;
  customPdfUrl?: string;
  razorpayInvoiceUrl?: string;
  planId?: { name: string };
  tenure?: string;
}

const CAP_LABELS: Record<string, string> = {
  max_flat_count: 'Flats',
  max_staff_count: 'Staff',
  max_member_count: 'Members',
  max_visitor_count: 'Visitors',
  max_tickets_count: 'Tickets',
  max_service_count: 'Services',
};

const TENURES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'halfYearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' },
];

// ─────────────── Helpers ───────────────
const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
const cap = (v: number) => (v === -1 ? '∞' : String(v));
const formatDate = (s?: string) =>
  s
    ? new Date(s).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

// ─────────────── StatusBadge ───────────────
function StatusBadge({ status, isFreeTier }: { status: string; isFreeTier: boolean }) {
  const label = isFreeTier ? 'FREE' : status === 'past_due' ? 'GRACE' : 'ACTIVE';
  const color = isFreeTier
    ? '#94a3b8'
    : status === 'past_due'
    ? '#f87171'
    : '#34d399';
  return (
    <View style={[styles.statusBadge, { borderColor: color + '40', backgroundColor: color + '20' }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─────────────── TenureSelector ───────────────
function TenureSelector({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={styles.tenureContainer}>
      {TENURES.map((t) => (
        <TouchableOpacity
          key={t.value}
          style={[styles.tenureBtn, selected === t.value && styles.tenureBtnActive]}
          onPress={() => onSelect(t.value)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tenureBtnText,
              selected === t.value && styles.tenureBtnTextActive,
            ]}
          >
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─────────────── PlanCard ───────────────
function PlanCard({
  plan,
  tenure,
  currentPlanId,
  currentTenure,
  hasAutoPay,
  upcoming,
  payingPlanId,
  onPress,
}: {
  plan: Plan;
  tenure: string;
  currentPlanId?: string;
  currentTenure?: string;
  hasAutoPay: boolean;
  upcoming: any[];
  payingPlanId: string | null;
  onPress: (plan: Plan, intent: string) => void;
}) {
  const pricing = plan.computedPricing?.find((c) => c.tenure === tenure);
  const isCurrentPlan = currentPlanId === plan._id && currentTenure === tenure;
  const isProcessing = payingPlanId === plan._id;

  let btnLabel = 'Subscribe & Pay';
  let btnIntent = 'upgrade';
  if (isCurrentPlan) {
    if (hasAutoPay) {
      btnLabel = 'Active (Auto-Renews)';
    } else if (upcoming.length > 0) {
      btnLabel = 'Setup Auto-Pay';
      btnIntent = 'setup_autopay';
    } else {
      btnLabel = 'Renew Plan';
      btnIntent = 'manual_renewal';
    }
  }

  return (
    <View style={[styles.planCard, plan.isFeatured && styles.planCardFeatured]}>
      {plan.isFeatured && (
        <View style={styles.planFeaturedBadge}>
          <Text style={styles.planFeaturedText}>MOST POPULAR</Text>
        </View>
      )}
      <View style={styles.planCardInner}>
        <Text style={styles.planCardName}>{plan.name}</Text>
        {plan.description ? (
          <Text style={styles.planCardDesc} numberOfLines={2}>
            {plan.description}
          </Text>
        ) : null}

        <View style={styles.planPricing}>
          <Text style={styles.planPrice}>
            {pricing ? inr(pricing.totalPrice) : inr(plan.basePrice)}
          </Text>
          <Text style={styles.planPriceSuffix}>
            {' '}/ {TENURES.find((t) => t.value === tenure)?.label.toLowerCase()}
          </Text>
        </View>

        {pricing && pricing.perMonthEquivalent > 0 && (
          <Text style={styles.planPerMonth}>≈ {inr(pricing.perMonthEquivalent)}/mo</Text>
        )}
        {pricing && pricing.savedAmount > 0 && (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>
              Save {inr(pricing.savedAmount)} · {pricing.discountPercent}% off
            </Text>
          </View>
        )}

        <View style={styles.planFeaturesSep} />
        {Object.entries(CAP_LABELS).map(([key, label]) => (
          <View key={key} style={styles.planFeatureRow}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#10b981" />
            <Text style={styles.planFeatureText}>
              <Text style={styles.planFeatureValue}>{cap(plan.capabilities?.[key] ?? 0)}</Text>{' '}
              {label}
            </Text>
          </View>
        ))}

        <TouchableOpacity
          style={[
            styles.planBtn,
            plan.isFeatured ? styles.planBtnPrimary : styles.planBtnOutline,
            isCurrentPlan && hasAutoPay && styles.planBtnDisabled,
          ]}
          disabled={isCurrentPlan && hasAutoPay || isProcessing}
          onPress={() => onPress(plan, btnIntent)}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={plan.isFeatured ? '#fff' : Colors.primary} />
          ) : (
            <Text
              style={[
                styles.planBtnText,
                plan.isFeatured ? styles.planBtnTextPrimary : styles.planBtnTextOutline,
                isCurrentPlan && hasAutoPay && styles.planBtnTextDisabled,
              ]}
            >
              {btnLabel}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────── PreviewModal ───────────────
function PreviewModal({
  visible,
  onClose,
  previewData,
  intent,
  planName,
  onConfirm,
  confirming,
}: {
  visible: boolean;
  onClose: () => void;
  previewData: any;
  intent: string;
  planName: string;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 500,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!previewData) return null;

  const title =
    intent === 'setup_autopay'
      ? 'Setup Auto-Pay'
      : intent === 'manual_renewal'
      ? 'Manual Renewal'
      : previewData?.mode === 'scheduled'
      ? 'Renew Plan'
      : 'Confirm Plan Change';

  const subtitle =
    intent === 'setup_autopay'
      ? 'No charges today. Auto-pay will activate for your next billing cycle.'
      : intent === 'manual_renewal'
      ? 'You are manually paying for your upcoming billing cycle.'
      : previewData.mode === 'scheduled'
      ? 'Your current plan will be extended when the current term ends.'
      : 'Review the details below before proceeding to checkout.';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View
          style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <Pressable>
            {/* Handle bar */}
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.modalSubtitle}>{subtitle}</Text>

            {/* Plan row */}
            <View style={styles.previewBox}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>New Plan</Text>
                <Text style={styles.previewValue}>
                  {previewData.newPlanName} · {previewData.tenure}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Plan Price</Text>
                <Text style={styles.previewValue}>{inr((previewData.newPricePaise || 0) / 100)}</Text>
              </View>

              {previewData.creditPaise > 0 && (
                <>
                  <View style={styles.previewSep} />
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewLabel, { color: '#10b981' }]}>
                      Unused Credit
                    </Text>
                    <Text style={[styles.previewValue, { color: '#10b981' }]}>
                      +{inr(previewData.creditPaise / 100)}
                    </Text>
                  </View>
                  {previewData.bonusDays > 0 && (
                    <Text style={styles.previewNote}>
                      Credit converted to {previewData.bonusDays} bonus days on your new plan.
                    </Text>
                  )}
                </>
              )}
            </View>

            {/* Amount due */}
            <View style={styles.previewAmountBox}>
              <Text style={styles.previewAmountLabel}>
                {intent === 'setup_autopay' ? 'Amount Due Today' : 'Amount Due Today'}
              </Text>
              <Text style={styles.previewAmountValue}>
                {inr((previewData.amountDuePaise || 0) / 100)}
              </Text>
            </View>

            {/* Date range */}
            {previewData.startDate && (
              <Text style={styles.previewDateNote}>
                Active: {formatDate(previewData.startDate)} → {formatDate(previewData.newEndDate)}
              </Text>
            )}

            {/* Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, confirming && { opacity: 0.6 }]}
                onPress={onConfirm}
                disabled={confirming}
                activeOpacity={0.8}
              >
                {confirming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {intent === 'setup_autopay' ? 'Confirm Setup' : 'Confirm & Pay'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─────────────── InvoiceRow ───────────────
function InvoiceRow({
  inv,
  onDownload,
}: {
  inv: Invoice;
  onDownload: (id: string) => void;
}) {
  const statusColor =
    inv.status === 'PAID' ? '#10b981' : inv.status === 'PENDING' ? '#f59e0b' : '#ef4444';
  const hasDoc = !!(inv.customPdfUrl || inv.razorpayInvoiceUrl);

  return (
    <TouchableOpacity
      style={styles.invoiceRow}
      onPress={() => hasDoc && onDownload(inv._id)}
      activeOpacity={hasDoc ? 0.7 : 1}
    >
      <View style={styles.invoiceLeft}>
        <View style={styles.invoiceIconWrap}>
          <MaterialCommunityIcons name="file-document-outline" size={18} color={Colors.primary} />
        </View>
        <View>
          <Text style={styles.invoiceNum}>
            {inv.customInvoiceNumber || inv._id.slice(-8).toUpperCase()}
          </Text>
          <Text style={styles.invoicePlan}>
            {inv.planId?.name ?? '—'}
            {inv.tenure ? ` · ${inv.tenure}` : ''}
          </Text>
          <Text style={styles.invoiceDate}>{formatDate(inv.paidAt || inv.createdAt)}</Text>
        </View>
      </View>
      <View style={styles.invoiceRight}>
        <Text style={styles.invoiceAmount}>{inr(inv.amount / 100)}</Text>
        <View style={[styles.invoiceStatusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
          <Text style={[styles.invoiceStatusText, { color: statusColor }]}>{inv.status}</Text>
        </View>
        {hasDoc && (
          <MaterialCommunityIcons name="download" size={18} color={Colors.primary} style={{ marginTop: 4 }} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────── BillingScreen ───────────────
export default function BillingScreen() {
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [subscription, setSubscription] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<Record<string, number>>({});
  const [planStatus, setPlanStatus] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [nextAmountPaise, setNextAmountPaise] = useState(0);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenureByPlan, setTenureByPlan] = useState<Record<string, string>>({});
  const [globalTenure, setGlobalTenure] = useState('yearly');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invLoading, setInvLoading] = useState(false);

  // Checkout state
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewPlan, setPreviewPlan] = useState<Plan | null>(null);
  const [previewIntent, setPreviewIntent] = useState('upgrade');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchSubscription = useCallback(async () => {
    const { data } = await billingApi.getMySubscription();
    setSubscription(data.subscription);
    setCapabilities(data.capabilities || {});
    setPlanStatus(data.planStatus || null);
    setUpcoming(data.upcoming || []);
    setNextAmountPaise(data.nextAmountPaise || 0);
  }, []);

  const fetchPlans = useCallback(async () => {
    const module = profile?.tenantType === 'shop' ? 'shop' : 'society';
    const { data } = await billingApi.getPublicPlans(module);
    const ps: Plan[] = data.plans || [];
    setPlans(ps);
    // Default tenure per plan to yearly
    const defaults: Record<string, string> = {};
    ps.forEach((p) => (defaults[p._id] = 'yearly'));
    setTenureByPlan(defaults);
  }, [profile]);

  const fetchInvoices = useCallback(async () => {
    setInvLoading(true);
    try {
      const { data } = await billingApi.getInvoices(1, 20);
      setInvoices(data.invoices || []);
    } finally {
      setInvLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([fetchSubscription(), fetchPlans(), fetchInvoices()]);
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not load billing data.' });
    }
  }, [fetchSubscription, fetchPlans, fetchInvoices]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // ── Derived values ──
  const effectiveEndDate =
    upcoming.length > 0 ? upcoming[upcoming.length - 1].endDate : subscription?.endDate;
  const daysLeft = effectiveEndDate
    ? Math.max(0, Math.ceil((new Date(effectiveEndDate).getTime() - Date.now()) / 86400000))
    : 0;
  const planName =
    subscription?.planId?.name || (subscription?.tenure === 'trial' ? 'Free Trial' : '—');
  const hasAutoPay =
    !!subscription?.razorpaySubscriptionId ||
    upcoming.some((u: any) => !!u.razorpaySubscriptionId);
  const autoPayChargeDate = (() => {
    if (!hasAutoPay) return undefined;
    const upWithAP = upcoming.filter((u: any) => !!u.razorpaySubscriptionId);
    if (upWithAP.length > 0) return upWithAP[upWithAP.length - 1].endDate;
    if (upcoming.length > 0) return upcoming[upcoming.length - 1].endDate;
    return subscription?.endDate;
  })();
  const nextBillingDate = planStatus?.isFreeTier
    ? 'Never'
    : hasAutoPay
    ? formatDate(autoPayChargeDate)
    : upcoming.length > 0
    ? formatDate(upcoming[upcoming.length - 1].endDate)
    : formatDate(subscription?.endDate);

  // ── Handlers ──
  const handlePlanPress = async (plan: Plan, intent: string) => {
    // For autopay setup, always honour the current subscription's tenure —
    // not the UI tenure selector which defaults to 'yearly'.
    const tenure =
      intent === 'setup_autopay' && subscription?.tenure
        ? subscription.tenure
        : tenureByPlan[plan._id] || globalTenure;

    console.log('[Billing] handlePlanPress called', { planId: plan._id, planName: plan.name, tenure, intent });
    setPayingPlanId(plan._id);
    try {
      console.log('[Billing] Calling upgradePreview...');
      const { data } = await billingApi.upgradePreview(plan._id, tenure, intent);
      console.log('[Billing] upgradePreview SUCCESS:', JSON.stringify(data, null, 2));
      setPreviewData(data.preview);
      setPreviewPlan(plan);
      setPreviewIntent(intent);
      setPreviewOpen(true);
    } catch (err: any) {
      console.error('[Billing] upgradePreview FAILED:');
      console.error('  status:', err?.response?.status);
      console.error('  message:', err?.response?.data?.message);
      console.error('  full error:', JSON.stringify(err?.response?.data, null, 2));
      Toast.show({
        type: 'error',
        text1: 'Preview Failed',
        text2: err?.response?.data?.message || 'Could not fetch upgrade details.',
      });
    } finally {
      setPayingPlanId(null);
    }
  };

  const handleConfirmCheckout = async () => {
    if (!previewPlan || !previewData) return;
    const tenure = previewData.tenure || tenureByPlan[previewPlan._id] || globalTenure;
    console.log('[Billing] handleConfirmCheckout called', { planId: previewPlan._id, planName: previewPlan.name, tenure, intent: previewIntent });
    setConfirming(true);
    setPreviewOpen(false);
    try {
      console.log('[Billing] Calling checkout...');
      const { data } = await billingApi.checkout(previewPlan._id, tenure, previewIntent);
      console.log('[Billing] checkout SUCCESS:', JSON.stringify(data, null, 2));
      const { subscriptionId, orderId, keyId, invoiceId } = data;

      const options: any = {
        description: `${previewPlan.name} — ${tenure}`,
        currency: 'INR',
        key: keyId,
        name: 'Resismart',
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: { color: Colors.primary },
      };
      if (subscriptionId) options.subscription_id = subscriptionId;
      if (orderId) options.order_id = orderId;

      console.log('[Billing] Opening Razorpay with options:', JSON.stringify(options, null, 2));

      // Guard: Razorpay native module is null in Expo Go — needs a dev build.
      if (!RazorpayCheckout || typeof RazorpayCheckout.open !== 'function') {
        Alert.alert(
          'Payment Not Available',
          'Razorpay requires a development build to run.\n\nRun:\n  npx expo run:android\n\nthen open the installed app instead of Expo Go.',
          [{ text: 'OK' }]
        );
        return;
      }

      const response = await RazorpayCheckout.open(options);
      console.log('[Billing] Razorpay response:', JSON.stringify(response, null, 2));

      // Verify payment
      const verifyPayload = {
        invoiceId,
        razorpay_subscription_id: response.razorpay_subscription_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      };
      console.log('[Billing] Calling verifyPayment with:', JSON.stringify(verifyPayload, null, 2));
      await billingApi.verifyPayment(verifyPayload);
      console.log('[Billing] verifyPayment SUCCESS');

      Toast.show({
        type: 'success',
        text1: 'Payment Successful 🎉',
        text2:
          previewIntent === 'manual_renewal'
            ? 'Plan renewed successfully!'
            : 'Subscription is now active.',
      });
      await loadAll();
    } catch (err: any) {
      // Razorpay SDK wraps error info under err.error, with non-enumerable properties
      const rzpError = err?.error ?? err;
      const errCode = rzpError?.code;
      const errDescription = rzpError?.description;
      const errReason = rzpError?.reason;
      const errSource = rzpError?.source;
      const errStep = rzpError?.step;

      console.error('[Billing] handleConfirmCheckout FAILED:');
      console.error('  err.message:', err?.message);   // ← plain JS Error message
      console.error('  error description:', errDescription);
      console.error('  error reason:', errReason);
      console.error('  error source:', errSource);
      console.error('  error step:', errStep);
      // Manually enumerate since Razorpay error props are non-enumerable
      try {
        console.error('  raw err keys:', Object.getOwnPropertyNames(err));
        if (err?.error) console.error('  raw err.error keys:', Object.getOwnPropertyNames(err.error));
      } catch (_) {}

      // code === 0 means user cancelled the payment sheet
      if (errCode === 0 || errDescription === 'Payment Cancelled by user') {
        Toast.show({ type: 'info', text1: 'Payment cancelled.' });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Payment Failed',
          text2: errDescription || err?.response?.data?.message || 'Please try again.',
        });
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelAutopay = () => {
    Alert.alert(
      'Turn Off Auto-Pay',
      'Are you sure? Your current plan remains active until it expires, but auto-renewal will stop after that.',
      [
        { text: 'Keep Auto-Pay', style: 'cancel' },
        {
          text: 'Turn Off',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await billingApi.cancelSubscription();
              Toast.show({ type: 'success', text1: 'Auto-Pay turned off.' });
              await fetchSubscription();
            } catch (err: any) {
              Toast.show({
                type: 'error',
                text1: 'Failed',
                text2: err?.response?.data?.message || 'Could not cancel auto-pay.',
              });
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const handleDownloadInvoice = async (id: string) => {
    try {
      const { data } = await billingApi.downloadInvoice(id);
      if (data?.url) {
        await Linking.openURL(data.url);
      } else {
        Toast.show({ type: 'info', text1: 'No PDF available for this invoice.' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open invoice.' });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading billing info…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page Header ── */}
        <View style={styles.pageHeader}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Billing & Subscription</Text>
            <Text style={styles.pageSubtitle}>Manage your plan, upgrade and download invoices</Text>
          </View>
        </View>

        {/* ── Banners ── */}
        {planStatus?.isFreeTier && (
          <View style={[styles.banner, styles.bannerAmber]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#92400e" />
            <Text style={styles.bannerAmberText}>
              You're on the <Text style={{ fontWeight: '800' }}>Free Tier</Text>. Upgrade below to unlock more capacity.
            </Text>
          </View>
        )}
        {planStatus?.status === 'past_due' && (
          <View style={[styles.banner, styles.bannerRed]}>
            <MaterialCommunityIcons name="alert-outline" size={18} color="#991b1b" />
            <Text style={styles.bannerRedText}>
              Your plan has expired — you're in a{' '}
              <Text style={{ fontWeight: '800' }}>grace period</Text>
              {planStatus.graceEndsAt ? ` until ${formatDate(planStatus.graceEndsAt)}` : ''}. Renew now.
            </Text>
          </View>
        )}

        {/* ── Hero Subscription Card ── */}
        <LinearGradient
          colors={['#0f172a', '#1e293b']}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Top row */}
          <View style={styles.heroPlanRow}>
            <View style={styles.heroCrownWrap}>
              <MaterialCommunityIcons name="crown" size={22} color="#60a5fa" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.heroLabel}>YOUR ACTIVE PLAN</Text>
              <Text style={styles.heroPlanName}>{planStatus?.planName || planName}</Text>
            </View>
            {planStatus && (
              <StatusBadge status={planStatus.status} isFreeTier={planStatus.isFreeTier} />
            )}
          </View>

          {subscription && !planStatus?.isFreeTier && (
            <Text style={styles.heroCycleText}>
              Billed {subscription.tenure} · {formatDate(subscription.startDate)} → {formatDate(subscription.endDate)}
            </Text>
          )}

          {/* Stats row */}
          {!planStatus?.isFreeTier && subscription && (
            <View style={styles.heroStats}>
              <View style={styles.heroStatBox}>
                <MaterialCommunityIcons name="clock-outline" size={14} color="#94a3b8" />
                <Text style={styles.heroStatLabel}>Time Remaining</Text>
                <Text style={styles.heroStatValue}>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatBox}>
                <MaterialCommunityIcons name="calendar-outline" size={14} color="#94a3b8" />
                <Text style={styles.heroStatLabel}>Next Billing</Text>
                <Text style={styles.heroStatValue}>{nextBillingDate}</Text>
              </View>
            </View>
          )}

          {/* Auto-pay section */}
          {subscription && !planStatus?.isFreeTier && (
            <View style={styles.heroAutopay}>
              {hasAutoPay ? (
                <LinearGradient
                  colors={['#1d4ed820', '#1d4ed815']}
                  style={styles.autopayBox}
                >
                  <View style={styles.autopayRow}>
                    <View style={styles.autopayDot} />
                    <Text style={styles.autopayActiveText}>Auto-Pay is ON</Text>
                  </View>
                  <Text style={styles.autopayDetail}>
                    {inr(nextAmountPaise / 100)} will be charged on {formatDate(autoPayChargeDate)}.
                  </Text>
                  <TouchableOpacity onPress={handleCancelAutopay} disabled={cancelling} activeOpacity={0.7}>
                    <Text style={styles.autopayToggle}>
                      {cancelling ? 'Cancelling…' : 'Turn off auto-renewal →'}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              ) : upcoming.length > 0 ? (
                <View style={[styles.autopayBox, { borderColor: '#34d39930', backgroundColor: '#34d39910' }]}>
                  <View style={styles.autopayRow}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#34d399" />
                    <Text style={[styles.autopayActiveText, { color: '#34d399' }]}>Paid in Advance</Text>
                  </View>
                  <Text style={styles.autopayDetail}>
                    Fully paid until {formatDate(upcoming[upcoming.length - 1].endDate)}.
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const plan = plans.find((p) => p._id === subscription.planId?._id);
                      if (plan) handlePlanPress(plan, 'setup_autopay');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.autopayToggle, { color: '#34d399' }]}>Setup Auto-Pay →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.autopayBox, { borderColor: '#f59e0b30', backgroundColor: '#f59e0b10' }]}>
                  <View style={styles.autopayRow}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#f59e0b" />
                    <Text style={[styles.autopayActiveText, { color: '#f59e0b' }]}>Auto-Pay is OFF</Text>
                  </View>
                  <Text style={styles.autopayDetail}>
                    Manual payment of {inr(nextAmountPaise / 100)} required before {formatDate(subscription.endDate)}.
                  </Text>
                  <View style={styles.autopayBtnRow}>
                    <TouchableOpacity
                      style={styles.autopayPayBtn}
                      onPress={() => {
                        const plan = plans.find((p) => p._id === subscription.planId?._id);
                        if (plan) handlePlanPress(plan, 'manual_renewal');
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.autopayPayText}>Pay Now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const plan = plans.find((p) => p._id === subscription.planId?._id);
                        if (plan) handlePlanPress(plan, 'setup_autopay');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.autopayToggle, { color: '#f59e0b' }]}>Setup Auto-Pay →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </LinearGradient>

        {/* ── Capacity Limits ── */}
        {Object.keys(capabilities).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="shield-check" size={16} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Current Capacity</Text>
            </View>
            <View style={styles.capsGrid}>
              {Object.entries(CAP_LABELS).map(([key, label]) => (
                <View key={key} style={styles.capCard}>
                  <Text style={styles.capValue}>{cap(capabilities[key] ?? 0)}</Text>
                  <Text style={styles.capLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Upcoming Plans ── */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="calendar-clock" size={16} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Upcoming Plans</Text>
            </View>
            <View style={styles.upcomingCard}>
              {upcoming.map((u: any) => (
                <View key={u._id} style={styles.upcomingRow}>
                  <View>
                    <Text style={styles.upcomingPlan}>
                      {u.planId?.name || 'Plan'}{' '}
                      <Text style={styles.upcomingTenure}>· {u.tenure}</Text>
                    </Text>
                    <Text style={styles.upcomingDates}>
                      {formatDate(u.startDate)} → {formatDate(u.endDate)}
                    </Text>
                  </View>
                  <View style={styles.upcomingBadge}>
                    <Text style={styles.upcomingBadgeText}>SCHEDULED</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Plans ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="rocket-launch" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>
              {subscription?.tenure === 'trial' ? 'Upgrade Your Plan' : 'Change Plan'}
            </Text>
          </View>

          <TenureSelector
            selected={globalTenure}
            onSelect={(v) => {
              setGlobalTenure(v);
              const updated: Record<string, string> = {};
              plans.forEach((p) => (updated[p._id] = v));
              setTenureByPlan(updated);
            }}
          />

          {plans.length === 0 ? (
            <Text style={styles.emptyText}>No plans available right now.</Text>
          ) : (
            plans.map((plan) => (
              <PlanCard
                key={plan._id}
                plan={plan}
                tenure={tenureByPlan[plan._id] || globalTenure}
                currentPlanId={subscription?.planId?._id}
                currentTenure={subscription?.tenure}
                hasAutoPay={hasAutoPay}
                upcoming={upcoming}
                payingPlanId={payingPlanId}
                onPress={handlePlanPress}
              />
            ))
          )}
        </View>

        {/* ── Invoice History ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="receipt" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Invoice History</Text>
          </View>
          <View style={styles.invoiceCard}>
            {invLoading ? (
              <View style={styles.invLoadingWrap}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : invoices.length === 0 ? (
              <Text style={styles.emptyText}>No invoices yet.</Text>
            ) : (
              invoices.map((inv, i) => (
                <React.Fragment key={inv._id}>
                  {i > 0 && <View style={styles.invDivider} />}
                  <InvoiceRow inv={inv} onDownload={handleDownloadInvoice} />
                </React.Fragment>
              ))
            )}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Preview Modal ── */}
      <PreviewModal
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        previewData={previewData}
        intent={previewIntent}
        planName={previewPlan?.name || ''}
        onConfirm={handleConfirmCheckout}
        confirming={confirming}
      />
    </>
  );
}

// ─────────────── Styles ───────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },

  // Page header
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.divider,
    flexShrink: 0,
  },
  pageTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  // Banners
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1 },
  bannerAmber: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  bannerAmberText: { color: '#92400e', fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
  bannerRed: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  bannerRedText: { color: '#991b1b', fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },

  // Hero Card
  heroCard: { borderRadius: 24, padding: 20, marginBottom: 20 },
  heroPlanRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  heroCrownWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  heroLabel: { fontSize: 10, color: '#93c5fd', fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  heroPlanName: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 2 },
  heroCycleText: { fontSize: 13, color: '#94a3b8', marginBottom: 16, fontWeight: '500' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14, marginBottom: 16,
  },
  heroStatBox: { flex: 1, alignItems: 'center', gap: 4 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroStatLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroStatValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroAutopay: { marginTop: 4 },
  autopayBox: { borderRadius: 14, borderWidth: 1, padding: 14, borderColor: '#2563eb30', backgroundColor: '#2563eb10' },
  autopayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  autopayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#60a5fa' },
  autopayActiveText: { fontSize: 14, fontWeight: '700', color: '#93c5fd' },
  autopayDetail: { fontSize: 12, color: '#94a3b8', lineHeight: 18 },
  autopayToggle: { fontSize: 12, color: '#60a5fa', fontWeight: '700', marginTop: 8 },
  autopayBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  autopayPayBtn: { backgroundColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  autopayPayText: { color: '#1c1917', fontWeight: '800', fontSize: 13 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  // Capacity — 3 columns
  capsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  capCard: {
    width: '32%',
    backgroundColor: Colors.surface, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.divider,
  },
  capValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  capLabel: { fontSize: 10, color: Colors.textDisabled, textTransform: 'uppercase', fontWeight: '600', marginTop: 4, letterSpacing: 0.5, textAlign: 'center' },

  // Upcoming
  upcomingCard: { backgroundColor: Colors.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#bfdbfe' },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  upcomingPlan: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  upcomingTenure: { fontWeight: '400', color: Colors.textSecondary },
  upcomingDates: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  upcomingBadge: { backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#bfdbfe' },
  upcomingBadgeText: { fontSize: 9, fontWeight: '800', color: '#1d4ed8', letterSpacing: 1 },

  // Tenure selector
  tenureContainer: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: Colors.divider },
  tenureBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  tenureBtnActive: { backgroundColor: Colors.primary },
  tenureBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  tenureBtnTextActive: { color: '#fff', fontWeight: '700' },

  // Plan cards
  planCard: {
    backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1,
    borderColor: Colors.divider, marginBottom: 14, overflow: 'hidden',
  },
  planCardFeatured: { borderColor: Colors.primary, shadowColor: Colors.primary, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  planFeaturedBadge: {
    backgroundColor: Colors.primary, alignSelf: 'center',
    marginTop: -1, paddingHorizontal: 16, paddingVertical: 5,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
  },
  planFeaturedText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  planCardInner: { padding: 20 },
  planCardName: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  planCardDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  planPricing: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 16 },
  planPrice: { fontSize: 34, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1 },
  planPriceSuffix: { fontSize: 13, color: Colors.textSecondary, marginBottom: 5 },
  planPerMonth: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  savingsBadge: { backgroundColor: '#ecfdf5', borderRadius: 20, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#bbf7d0', marginTop: 8 },
  savingsText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  planFeaturesSep: { height: 1, backgroundColor: Colors.divider, marginVertical: 16 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  planFeatureText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  planFeatureValue: { fontWeight: '800', color: Colors.textPrimary },
  planBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  planBtnPrimary: { backgroundColor: Colors.primary },
  planBtnOutline: { borderWidth: 1.5, borderColor: Colors.primary },
  planBtnDisabled: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#bbf7d0' },
  planBtnText: { fontSize: 15, fontWeight: '700' },
  planBtnTextPrimary: { color: '#fff' },
  planBtnTextOutline: { color: Colors.primary },
  planBtnTextDisabled: { color: '#059669' },

  // Invoice
  invoiceCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.divider, overflow: 'hidden' },
  invLoadingWrap: { padding: 24, alignItems: 'center' },
  invDivider: { height: 1, backgroundColor: Colors.divider, marginHorizontal: 16 },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  invoiceLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  invoiceIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  invoiceNum: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  invoicePlan: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  invoiceDate: { fontSize: 11, color: Colors.textDisabled, marginTop: 2 },
  invoiceRight: { alignItems: 'flex-end', gap: 4 },
  invoiceAmount: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  invoiceStatusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  invoiceStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Empty
  emptyText: { color: Colors.textDisabled, fontSize: 14, textAlign: 'center', padding: 20 },

  // Modal / BottomSheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingTop: 12,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.divider, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 20 },
  previewBox: { backgroundColor: Colors.background, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.divider, marginBottom: 12 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  previewLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  previewValue: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  previewSep: { height: 1, backgroundColor: Colors.divider, borderStyle: 'dashed', marginVertical: 8 },
  previewNote: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16, marginTop: 4 },
  previewAmountBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primary + '10', borderRadius: 14,
    borderWidth: 1, borderColor: Colors.primary + '30', padding: 16, marginBottom: 10,
  },
  previewAmountLabel: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  previewAmountValue: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  previewDateNote: { fontSize: 11, color: Colors.textDisabled, textAlign: 'center', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.divider, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  modalConfirmBtn: { flex: 2, borderRadius: 12, backgroundColor: Colors.primary, paddingVertical: 14, alignItems: 'center' },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
