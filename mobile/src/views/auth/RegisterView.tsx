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
import {
  useRegisterViewModel,
  Gender,
  RegisterStep,
} from '@/viewmodels/auth/useRegisterViewModel';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const STEPS: RegisterStep[] = ['details', 'otp'];

const STEP_SUBTITLES: Record<RegisterStep, string> = {
  details: 'Fill in your details to get started',
  otp: 'Enter the verification code sent to your email',
};

export default function RegisterView() {
  const vm = useRegisterViewModel();
  const { setSession } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleNext = async () => {
    if (vm.step === 'details') {
      await vm.handleSubmitDetails();
    } else {
      const session = await vm.handleVerifyOtp();
      if (session) {
        await setSession(
          session.access_token,
          session.refresh_token,
          session.user,
        );
        router.replace('/(tabs)/home' as Href);
      }
    }
  };

  const buttonLabel =
    vm.step === 'details' ? 'Continue' : 'Create Account';

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
        <Text style={styles.title}>Create Account</Text>
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

        {vm.apiError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{vm.apiError}</Text>
          </View>
        )}

        {vm.step === 'details' && (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, vm.errors.email && styles.inputError]}
                placeholder="user@example.com"
                placeholderTextColor={theme.placeholder}
                value={vm.formData.email}
                onChangeText={(v) => vm.updateField('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!vm.isLoading}
              />
              {vm.errors.email && (
                <Text style={styles.fieldError}>{vm.errors.email}</Text>
              )}
            </View>

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
                placeholder="At least 8 characters"
                placeholderTextColor={theme.placeholder}
                value={vm.formData.password}
                onChangeText={(v) => vm.updateField('password', v)}
                secureTextEntry
                autoComplete="new-password"
                editable={!vm.isLoading}
              />
              {vm.errors.password && (
                <Text style={styles.fieldError}>{vm.errors.password}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Phone Number <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  vm.errors.phone_number && styles.inputError,
                ]}
                placeholder="+905551112233"
                placeholderTextColor={theme.placeholder}
                value={vm.formData.phone_number}
                onChangeText={(v) => vm.updateField('phone_number', v)}
                keyboardType="phone-pad"
                autoComplete="tel"
                editable={!vm.isLoading}
              />
              {vm.errors.phone_number && (
                <Text style={styles.fieldError}>{vm.errors.phone_number}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Gender <Text style={styles.optional}>(optional)</Text>
              </Text>
              <View style={styles.genderRow}>
                {GENDER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.genderOption,
                      vm.formData.gender === opt.value &&
                        styles.genderOptionSelected,
                    ]}
                    onPress={() =>
                      vm.updateField(
                        'gender',
                        vm.formData.gender === opt.value ? '' : opt.value,
                      )
                    }
                    disabled={vm.isLoading}
                  >
                    <Text
                      style={[
                        styles.genderOptionText,
                        vm.formData.gender === opt.value &&
                          styles.genderOptionTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Birth Date <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  vm.errors.birth_date && styles.inputError,
                ]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.placeholder}
                value={vm.formData.birth_date}
                onChangeText={(v) => vm.updateField('birth_date', v)}
                keyboardType="numbers-and-punctuation"
                editable={!vm.isLoading}
              />
              {vm.errors.birth_date && (
                <Text style={styles.fieldError}>{vm.errors.birth_date}</Text>
              )}
            </View>
          </>
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

        <TouchableOpacity
          style={[styles.button, vm.isLoading && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={vm.isLoading}
          activeOpacity={0.8}
        >
          {vm.isLoading ? (
            <ActivityIndicator color={theme.textOnPrimary} />
          ) : (
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          )}
        </TouchableOpacity>

        {vm.step === 'otp' && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={vm.goBack}
            disabled={vm.isLoading}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        )}

        {vm.step === 'details' && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => router.push('/')}
              disabled={vm.isLoading}
            >
              <Text style={styles.footerLink}>Sign In</Text>
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
    optional: {
      fontWeight: '400',
      color: t.textTertiary,
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
    genderRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    genderOption: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.surfaceVariant,
    },
    genderOptionSelected: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    genderOptionText: {
      fontSize: 14,
      color: t.textSecondary,
    },
    genderOptionTextSelected: {
      color: t.textOnPrimary,
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
