import React, { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';

import { useLoginViewModel } from '@/viewmodels/auth/useLoginViewModel';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export default function LoginView() {
  const vm = useLoginViewModel();
  const { setSession } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleSubmit = async () => {
    const session = await vm.handleLogin();
    if (session) {
      await setSession(
        session.access_token,
        session.refresh_token,
        session.user,
      );
      router.replace('/(tabs)/home' as Href);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>
          Sign in to continue to your account
        </Text>

        {vm.apiError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{vm.apiError}</Text>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={[styles.input, vm.errors.username && styles.inputError]}
            placeholder="maplover"
            placeholderTextColor={theme.placeholder}
            value={vm.formData.username}
            onChangeText={(v) => vm.updateField('username', v)}
            autoCapitalize="none"
            autoComplete="username"
            editable={!vm.isLoading}
          />
          {vm.errors.username && (
            <Text style={styles.fieldError}>{vm.errors.username}</Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, vm.errors.password && styles.inputError]}
            placeholder="Your password"
            placeholderTextColor={theme.placeholder}
            value={vm.formData.password}
            onChangeText={(v) => vm.updateField('password', v)}
            secureTextEntry
            autoComplete="current-password"
            editable={!vm.isLoading}
          />
          {vm.errors.password && (
            <Text style={styles.fieldError}>{vm.errors.password}</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.forgotPasswordLink}
          onPress={() => router.push('/forgot-password' as Href)}
          disabled={vm.isLoading}
        >
          <Text style={styles.footerLink}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, vm.isLoading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={vm.isLoading}
          activeOpacity={0.8}
        >
          {vm.isLoading ? (
            <ActivityIndicator color={theme.textOnPrimary} />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don&apos;t have an account? </Text>
          <TouchableOpacity
            onPress={() => router.push('/register')}
            disabled={vm.isLoading}
          >
            <Text style={styles.footerLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.background,
    },
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 24,
      paddingTop: 72,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: t.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: t.textSecondary,
      marginBottom: 32,
    },
    errorBanner: {
      backgroundColor: t.errorBg,
      borderWidth: 1,
      borderColor: t.errorBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    errorBannerText: {
      color: t.errorText,
      fontSize: 14,
    },
    fieldGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: t.text,
      backgroundColor: t.surfaceVariant,
    },
    inputError: {
      borderColor: t.errorTextStrong,
      backgroundColor: t.errorBg,
    },
    fieldError: {
      color: t.errorTextStrong,
      fontSize: 13,
      marginTop: 4,
    },
    forgotPasswordLink: {
      alignSelf: 'flex-end',
      marginBottom: 8,
    },
    button: {
      backgroundColor: t.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: t.textOnPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 24,
    },
    footerText: {
      fontSize: 15,
      color: t.textSecondary,
    },
    footerLink: {
      fontSize: 15,
      color: t.text,
      fontWeight: '600',
    },
  });
}
