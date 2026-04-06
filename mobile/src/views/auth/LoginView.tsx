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
import { router, type Href } from 'expo-router';
import { useLoginViewModel } from '@/viewmodels/auth/useLoginViewModel';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginView() {
  const vm = useLoginViewModel();
  const { setSession } = useAuth();

  const handleSubmit = async () => {
    const session = await vm.handleLogin();
    if (session) {
      await setSession(
        session.access_token,
        session.refresh_token,
        session.user,
      );
      router.replace('/home' as Href);
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
            placeholderTextColor="#9CA3AF"
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
            placeholderTextColor="#9CA3AF"
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
            <ActivityIndicator color="#fff" />
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
    paddingTop: 72,
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
    marginBottom: 32,
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
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#111827',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 15,
    color: '#6B7280',
  },
  footerLink: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
});
