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
import { useTranslation } from 'react-i18next';
import {
  useRegisterViewModel,
  Gender,
  RegisterStep,
} from '@/viewmodels/auth/useRegisterViewModel';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import SemLogo from '@/components/common/SemLogo';

type GenderChoice = Exclude<Gender, ''>;
const GENDER_VALUES: GenderChoice[] = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
const GENDER_LABEL_KEYS: Record<GenderChoice, string> = {
  MALE: 'auth.register.genderMale',
  FEMALE: 'auth.register.genderFemale',
  OTHER: 'auth.register.genderOther',
  PREFER_NOT_TO_SAY: 'auth.register.genderPreferNotToSay',
};

const STEPS: RegisterStep[] = ['details', 'otp'];

export default function RegisterView() {
  const vm = useRegisterViewModel();
  const { setSession } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
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
    vm.step === 'details' ? t('auth.register.continue') : t('auth.register.submit');
  const subtitle =
    vm.step === 'details'
      ? t('auth.register.subtitleDetails')
      : t('auth.register.subtitleOtp');

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
          <View style={styles.brand}>
            <SemLogo height={76} color={theme.text} />
          </View>
          <Text style={styles.title}>{t('auth.register.title')}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

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
              <Text style={styles.label}>{t('auth.register.email')}</Text>
              <TextInput
                style={[styles.input, vm.errors.email && styles.inputError]}
                placeholder={t('auth.register.emailPlaceholder')}
                placeholderTextColor={theme.placeholder}
                value={vm.formData.email}
                onChangeText={(v) => vm.updateField('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!vm.isLoading}
                accessibilityLabel="Email"
                accessibilityState={{ disabled: vm.isLoading }}
              />
              {vm.errors.email && (
                <Text style={styles.fieldError}>{vm.errors.email}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.register.username')}</Text>
              <TextInput
                style={[styles.input, vm.errors.username && styles.inputError]}
                placeholder={t('auth.register.usernamePlaceholder')}
                placeholderTextColor={theme.placeholder}
                value={vm.formData.username}
                onChangeText={(v) => vm.updateField('username', v)}
                autoCapitalize="none"
                autoComplete="username"
                editable={!vm.isLoading}
                accessibilityLabel="Username"
                accessibilityState={{ disabled: vm.isLoading }}
              />
              {vm.errors.username && (
                <Text style={styles.fieldError}>{vm.errors.username}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.register.password')}</Text>
              <TextInput
                style={[styles.input, vm.errors.password && styles.inputError]}
                placeholder={t('auth.register.passwordPlaceholder')}
                placeholderTextColor={theme.placeholder}
                value={vm.formData.password}
                onChangeText={(v) => vm.updateField('password', v)}
                secureTextEntry
                autoComplete="new-password"
                editable={!vm.isLoading}
                accessibilityLabel="Password"
                accessibilityState={{ disabled: vm.isLoading }}
              />
              {vm.errors.password && (
                <Text style={styles.fieldError}>{vm.errors.password}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                {t('auth.register.phoneNumber')} <Text style={styles.optional}>{t('auth.register.optional')}</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  vm.errors.phone_number && styles.inputError,
                ]}
                placeholder={t('auth.register.phoneNumberPlaceholder')}
                placeholderTextColor={theme.placeholder}
                value={vm.formData.phone_number}
                onChangeText={(v) => vm.updateField('phone_number', v)}
                keyboardType="phone-pad"
                autoComplete="tel"
                editable={!vm.isLoading}
                accessibilityLabel="Phone number"
                accessibilityState={{ disabled: vm.isLoading }}
              />
              {vm.errors.phone_number && (
                <Text style={styles.fieldError}>{vm.errors.phone_number}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.register.gender')}</Text>
              <View style={styles.genderRow}>
                {GENDER_VALUES.map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.genderOption,
                      vm.formData.gender === value && styles.genderOptionSelected,
                    ]}
                    onPress={() =>
                      vm.updateField(
                        'gender',
                        vm.formData.gender === value ? '' : value,
                      )
                    }
                    disabled={vm.isLoading}
                    accessibilityRole="button"
                    accessibilityLabel={`Gender ${opt.label}`}
                    accessibilityState={{
                      selected: vm.formData.gender === opt.value,
                      disabled: vm.isLoading,
                    }}
                  >
                    <Text
                      style={[
                        styles.genderOptionText,
                        vm.formData.gender === value && styles.genderOptionTextSelected,
                      ]}
                    >
                      {t(GENDER_LABEL_KEYS[value])}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {vm.errors.gender && (
                <Text style={styles.fieldError}>{vm.errors.gender}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.register.birthDate')}</Text>
              <TextInput
                style={[
                  styles.input,
                  vm.errors.birth_date && styles.inputError,
                ]}
                placeholder={t('auth.register.birthDatePlaceholder')}
                placeholderTextColor={theme.placeholder}
                value={vm.formData.birth_date}
                onChangeText={(v) => vm.updateField('birth_date', v)}
                keyboardType="numbers-and-punctuation"
                editable={!vm.isLoading}
                accessibilityLabel="Birth date"
                accessibilityState={{ disabled: vm.isLoading }}
              />
              {vm.errors.birth_date && (
                <Text style={styles.fieldError}>{vm.errors.birth_date}</Text>
              )}
            </View>
          </>
        )}

        {vm.step === 'otp' && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('auth.register.verificationCode')}</Text>
            <TextInput
              style={[styles.input, vm.errors.otp && styles.inputError]}
              placeholder={t('auth.register.verificationCodePlaceholder')}
              placeholderTextColor={theme.placeholder}
              value={vm.formData.otp}
              onChangeText={(v) => vm.updateField('otp', v)}
              keyboardType="number-pad"
              maxLength={6}
              editable={!vm.isLoading}
              accessibilityLabel="Verification code"
              accessibilityState={{ disabled: vm.isLoading }}
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
          accessibilityRole="button"
          accessibilityLabel={vm.isLoading ? `${buttonLabel} in progress` : buttonLabel}
          accessibilityState={{ disabled: vm.isLoading, busy: vm.isLoading }}
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
            accessibilityRole="button"
            accessibilityLabel="Go back to account details"
            accessibilityState={{ disabled: vm.isLoading }}
          >
            <Text style={styles.backButtonText}>{t('auth.register.goBack')}</Text>
          </TouchableOpacity>
        )}

        {vm.step === 'details' && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.register.haveAccount')}</Text>
            <TouchableOpacity
              onPress={() => router.push('/')}
              disabled={vm.isLoading}
              accessibilityRole="link"
              accessibilityLabel="Sign in"
              accessibilityState={{ disabled: vm.isLoading }}
            >
              <Text style={styles.footerLink}>{t('auth.register.signIn')}</Text>
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
    brand: {
      alignItems: 'center',
      marginBottom: 20,
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
