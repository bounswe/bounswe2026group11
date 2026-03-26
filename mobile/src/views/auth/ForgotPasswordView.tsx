import React from 'react';
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
              placeholderTextColor="#9CA3AF"
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
              placeholderTextColor="#9CA3AF"
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
              placeholderTextColor="#9CA3AF"
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
            <ActivityIndicator color="#fff" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
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
    backgroundColor: '#E5E7EB',
  },
  stepDotActive: {
    backgroundColor: '#2563EB',
  },
  successBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successBannerText: {
    color: '#047857',
    fontSize: 14,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  fieldError: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#6B7280',
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerLink: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '600',
  },
});
