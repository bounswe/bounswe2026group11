import React, { useMemo, useState } from 'react';
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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  useForgotPasswordViewModel,
  ForgotPasswordStep,
} from '@/viewmodels/auth/useForgotPasswordViewModel';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const STEPS: ForgotPasswordStep[] = ['email', 'otp', 'reset'];

const SUBTITLE_KEYS: Record<ForgotPasswordStep, string> = {
  email: 'auth.forgotPassword.subtitleEmail',
  otp: 'auth.forgotPassword.subtitleOtp',
  reset: 'auth.forgotPassword.subtitleReset',
};

const BUTTON_KEYS: Record<ForgotPasswordStep, string> = {
  email: 'auth.forgotPassword.submitEmail',
  otp: 'auth.forgotPassword.submitOtp',
  reset: 'auth.forgotPassword.submitReset',
};

export default function ForgotPasswordView() {
  const vm = useForgotPasswordViewModel();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

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

  const renderPasswordField = (
    label: string,
    field: 'newPassword' | 'confirmNewPassword',
    isVisible: boolean,
    toggleVisibility: () => void,
    placeholder: string,
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={[
            styles.input,
            styles.passwordInput,
            vm.errors[field] && styles.inputError,
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.placeholder}
          value={vm.formData[field]}
          onChangeText={(v) => vm.updateField(field, v)}
          secureTextEntry={!isVisible}
          autoComplete="new-password"
          editable={!vm.isLoading}
          accessibilityLabel={label}
        />
        <TouchableOpacity
          style={styles.visibilityToggle}
          onPress={toggleVisibility}
          disabled={vm.isLoading}
          accessibilityRole="button"
          accessibilityLabel={t(
            isVisible ? 'common.hidePasswordField' : 'common.showPasswordField',
            { field: label },
          )}
        >
          <Ionicons
            name={isVisible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={theme.textTertiary}
          />
        </TouchableOpacity>
      </View>
      {vm.errors[field] && (
        <Text style={styles.fieldError}>{vm.errors[field]}</Text>
      )}
    </View>
  );

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
        <Text style={styles.title}>{t('auth.forgotPassword.title')}</Text>
        <Text style={styles.subtitle}>{t(SUBTITLE_KEYS[vm.step])}</Text>

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
            <Text style={styles.label}>{t('auth.forgotPassword.email')}</Text>
            <TextInput
              style={[styles.input, vm.errors.email && styles.inputError]}
              placeholder={t('auth.forgotPassword.emailPlaceholder')}
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
            <Text style={styles.label}>{t('auth.forgotPassword.verificationCode')}</Text>
            <TextInput
              style={[styles.input, vm.errors.otp && styles.inputError]}
              placeholder={t('auth.forgotPassword.verificationCodePlaceholder')}
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
          <>
            {renderPasswordField(
              t('auth.forgotPassword.newPassword'),
              'newPassword',
              showNewPassword,
              () => setShowNewPassword(!showNewPassword),
              t('auth.forgotPassword.newPasswordPlaceholder'),
            )}

            {renderPasswordField(
              t('auth.forgotPassword.confirmNewPassword'),
              'confirmNewPassword',
              showConfirmNewPassword,
              () => setShowConfirmNewPassword(!showConfirmNewPassword),
              t('auth.forgotPassword.confirmNewPasswordPlaceholder'),
            )}
          </>
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
            <Text style={styles.buttonText}>{t(BUTTON_KEYS[vm.step])}</Text>
          )}
        </TouchableOpacity>

        {vm.step !== 'email' && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={vm.goBack}
            disabled={vm.isLoading}
          >
            <Text style={styles.backButtonText}>{t('auth.forgotPassword.goBack')}</Text>
          </TouchableOpacity>
        )}

        {vm.step === 'email' && (
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => router.back()}
              disabled={vm.isLoading}
            >
              <Text style={styles.footerLink}>{t('auth.forgotPassword.backToSignIn')}</Text>
            </TouchableOpacity>
          </View>
        )}
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
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
    },
    passwordInput: {
      flex: 1,
      paddingRight: 48,
    },
    visibilityToggle: {
      position: 'absolute',
      right: 12,
      padding: 4,
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
