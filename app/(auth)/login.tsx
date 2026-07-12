// Polyfill DOMException for Axios and other libraries in React Native
if (typeof global !== 'undefined' && !(global as any).DOMException) {
  (global as any).DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || 'DOMException';
    }
  };
}

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

import { useAuth } from '../../src/context/AuthContext';
import { AppButton } from '../../src/components/AppButton';
import { AppInput } from '../../src/components/AppInput';
import { AppLogo } from '../../src/components/AppLogo';
import { Colors } from '../../src/constants/colors';

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const { login, loginOtpRequest, loginOtpVerify } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [otpStep, setOtpStep] = useState<'identifier' | 'code'>('identifier');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [infoText, setInfoText] = useState<string | null>(null);

  const showSnack = (message: string, error = false) =>
    Toast.show({
      type: error ? 'error' : 'success',
      text1: error ? 'Error' : 'Success',
      text2: message,
      position: 'top',
    });

  const handleSendCode = async () => {
    if (!identifier.trim()) {
      showSnack('Please enter your email or phone number.', true);
      return;
    }
    setIsLoading(true);
    const res = await loginOtpRequest(identifier.trim());
    setIsLoading(false);
    
    if (res.success) {
      setDevCode(res.devCode || null);
      if (res.devCode) {
        setInfoText(`Dev Mode: Your OTP is ${res.devCode}`);
      } else {
        setInfoText(res.channel === 'EMAIL' ? 'A code was emailed to you.' : 'A code was sent via SMS.');
      }
      setOtpStep('code');
    } else {
      showSnack(res.error || 'Failed to send OTP.', true);
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.length < 6) {
      showSnack('Please enter the 6-digit code.', true);
      return;
    }
    setIsLoading(true);
    const res = await loginOtpVerify(identifier.trim(), otpCode);
    setIsLoading(false);
    
    if (res.success) {
      router.replace('/');
    } else {
      showSnack(res.error || 'Verification failed.', true);
    }
  };

  const handlePasswordLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      showSnack('Please enter your identifier and password.', true);
      return;
    }
    setIsLoading(true);
    const res = await login(identifier.trim(), password);
    setIsLoading(false);
    
    if (res.success) {
      router.replace('/');
    } else if (res.useOtp) {
      setMode('otp');
      setOtpStep('identifier');
      showSnack('This account requires an OTP. Please request a code.', true);
    } else {
      showSnack(res.error || 'Login failed.', true);
    }
  };

  const resetOtp = () => {
    setOtpStep('identifier');
    setOtpCode('');
    setDevCode(null);
    setInfoText(null);
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <LinearGradient
            colors={[Colors.gradientStart, Colors.gradientEnd, Colors.secondary]}
            locations={[0, 0.6, 1]}
            style={styles.gradient}
          >
            <View style={styles.heroContent}>
              <AppLogo size="large" showTagline />
            </View>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSubtitle}>
              {mode === 'otp' ? 'Sign in with a one-time code' : 'Sign in with your password'}
            </Text>

            {infoText && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{infoText}</Text>
              </View>
            )}

            <View style={styles.form}>
              {mode === 'otp' ? (
                otpStep === 'identifier' ? (
                  <>
                    <AppInput
                      label="Email or Phone Number"
                      value={identifier}
                      onChangeText={setIdentifier}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      leftIcon="account-outline"
                    />
                    <AppButton
                      label="Send Code"
                      onPress={handleSendCode}
                      loading={isLoading}
                      style={styles.actionButton}
                    />
                  </>
                ) : (
                  <>
                    <AppInput
                      label="6-Digit Code"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="numeric"
                      maxLength={6}
                      leftIcon="key-outline"
                    />
                    <AppButton
                      label="Verify Code"
                      onPress={handleVerifyCode}
                      loading={isLoading}
                      style={styles.actionButton}
                    />
                    <TouchableOpacity onPress={resetOtp} style={styles.linkButton}>
                      <Text style={styles.linkText}>Change Email/Phone</Text>
                    </TouchableOpacity>
                  </>
                )
              ) : (
                <>
                  <AppInput
                    label="Email or Phone Number"
                    value={identifier}
                    onChangeText={setIdentifier}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    leftIcon="account-outline"
                  />
                  <AppInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    leftIcon="lock-outline"
                  />
                  <TouchableOpacity
                    onPress={() => router.push('/(auth)/forgot-password')}
                    style={styles.forgotLink}
                  >
                    <Text style={styles.linkText}>Forgot Password?</Text>
                  </TouchableOpacity>
                  <AppButton
                    label="Sign In"
                    onPress={handlePasswordLogin}
                    loading={isLoading}
                    icon="login"
                    style={styles.actionButton}
                  />
                </>
              )}

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                onPress={() => {
                  setMode(mode === 'otp' ? 'password' : 'otp');
                  resetOtp();
                }}
                style={styles.switchModeButton}
              >
                <Text style={styles.switchModeText}>
                  {mode === 'otp' ? 'Sign in with Password' : 'Sign in with OTP'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Having trouble? Contact your society administrator.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  gradient: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight! + 20 : 60,
    paddingBottom: 60,
    justifyContent: 'center',
  },
  heroContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 48,
    marginTop: -24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#e0f2fe',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  infoText: {
    color: '#0369a1',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  form: {
    gap: 4,
  },
  actionButton: {
    marginTop: 12,
  },
  linkButton: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 8,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  linkText: {
    color: Colors.primaryLight,
    fontWeight: '600',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  dividerText: {
    marginHorizontal: 12,
    color: Colors.textDisabled,
    fontWeight: '600',
    fontSize: 12,
  },
  switchModeButton: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    alignItems: 'center',
  },
  switchModeText: {
    color: Colors.primaryLight,
    fontWeight: '700',
    fontSize: 15,
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.textDisabled,
    textAlign: 'center',
  },
});
