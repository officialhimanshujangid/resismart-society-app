// Polyfill DOMException for Axios and other libraries in React Native
if (typeof global !== 'undefined' && !global.DOMException) {
  (global as any).DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      Object.defineProperty(this, 'name', {
        value: name || 'DOMException',
        configurable: true,
      });
    }
  };
}

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { AppLightTheme, AppDarkTheme } from '../src/constants/theme';
import { LoadingOverlay } from '../src/components/LoadingOverlay';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

function RootLayoutInner() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace('/');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return <LoadingOverlay visible message="Initializing..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? AppDarkTheme : AppLightTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
              <RootLayoutInner />
            </SafeAreaView>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
      <Toast />
    </GestureHandlerRootView>
  );
}
