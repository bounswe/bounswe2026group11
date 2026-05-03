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
import { router } from 'expo-router';
import {
  useForgotPasswordViewModel,
  ForgotPasswordStep,
} from '@/viewmodels/auth/useForgotPasswordViewModel';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const STEPS: ForgotPasswordStep[] = ['email', 'otp', 'reset'];

const STEP_SUBTITLES: Record<ForgotPasswordStep, string> = {
  email: 'Enter your email address to request a password reset.',
  otp: 'Enter the verification code sent to your email.',
  reset: 'Choose a new password for your account.',
};

const BUTTON_LABELS: Record<ForgotPasswordStep, string> = {
  email: 'Send reset code',
  otp: 'Verify code',
  reset: 'Reset password',
};

export default function ForgotPasswordView() {
  const vm = useForgotPasswordViewModel();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleNext = async () => {
    if (vm.step === 'email') {
      await vm.handleRequestOtp();
    } else if (vm.step === 'otp') {
      await vm.handleVerifyOtp();
    } else {
      const success = await vm.handleResetPassword();
      if (success) {
        router.replace('/');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.subtitle}>{STEP_SUBTITLES[vm.step]}</Text>

        <View style={styles.stepIndicator}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[
                styles.stepDot,
                STEPS.indexOf(vm.step) >= i && styles.stepDotActive,
              ]}
            />
          ))}
        </View>

        {vm.successMessage && (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{vm.successMessage}</Text>
          </View>
        )}

        {vm.apiError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{vm.apiError}</Text>
          </View>
        )}

        {vm.step === 'email' && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, vm.errors.email && styles.inputError]}
              placeholder="you@example.com"
              placeholderTextColor={theme.placeholder}
              value={vm.formData.email}
              onChangeText={(v) => vm.updateField('email', v)}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              editable={!vm.isLoading}
            />
            {vm.errors.email && (
              <Text style={styles.fieldError}>{vm.errors.email}</Text>
            )}
          </View>
        )}

        {vm.step === 'otp' && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={[styles.input, vm.errors.otp && styles.inputError]}
              placeholder="123456"
              placeholderTextColor={theme.placeholder}
              value={vm.formData.otp}
              onChangeText={(v) => vm.updateField('otp', v)}
              keyboardType="number-pad"
              maxLength={6}
              editable={!vm.isLoading}
            />
            {vm.errors.otp && (
              <Text style={styles.fieldError}>{vm.errors.otp}</Text>
            )}
          </View>
        )}

        {vm.step === 'reset' && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={[
                styles.input,
                vm.errors.newPassword && styles.inputError,
              ]}
              placeholder="At least 8 characters"
              placeholderTextColor={theme.placeholder}
              value={vm.formData.newPassword}
              onChangeText={(v) => vm.updateField('newPassword', v)}
              secureTextEntry
              autoComplete="new-password"
              editable={!vm.isLoading}
            />
            {vm.errors.newPassword && (
              <Text style={styles.fieldError}>{vm.errors.newPassword}</Text>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, vm.isLoading && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={vm.isLoading}
          activeOpacity={0.8}
        >
          {vm.isLoading ? (
            <ActivityIndicator color={theme.textOnPrimary} />
          ) : (
            <Text style={styles.buttonText}>{BUTTON_LABELS[vm.step]}</Text>
          )}
        </TouchableOpacity>

        {vm.step !== 'email' && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={vm.goBack}
            disabled={vm.isLoading}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        )}

        {vm.step === 'email' && (
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => router.back()}
              disabled={vm.isLoading}
            >
              <Text style={styles.footerLink}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.surface,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 24,
      paddingTop: 60,
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
      marginBottom: 24,
    },
    stepIndicator: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 32,
    },
    stepDot: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.border,
    },
    stepDotActive: {
      backgroundColor: t.text,
    },
    successBanner: {
      backgroundColor: t.successBg,
      borderWidth: 1,
      borderColor: t.successBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    successBannerText: {
      color: t.successText,
      fontSize: 14,
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
    backButton: {
      alignItems: 'center',
      marginTop: 16,
      paddingVertical: 8,
    },
    backButtonText: {
      color: t.textSecondary,
      fontSize: 15,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 24,
    },
    footerLink: {
      fontSize: 15,
      color: t.text,
      fontWeight: '600',
    },
  });
}
