import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useChangePasswordViewModel } from '@/viewmodels/profile/useChangePasswordViewModel';

export default function ChangePasswordView() {
  const vm = useChangePasswordViewModel();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSave = async () => {
    const success = await vm.handleSubmit();
    if (success) {
      // Success message is shown in the view, we can wait a bit or go back immediately
      setTimeout(() => {
        router.back();
      }, 1500);
    }
  };

  const renderPasswordField = (
    label: string,
    field: 'currentPassword' | 'newPassword' | 'confirmPassword',
    isVisible: boolean,
    toggleVisibility: () => void,
    placeholder: string
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={[
            styles.textInput,
            vm.errors[field] ? styles.textInputError : null,
          ]}
          value={vm.formData[field]}
          onChangeText={(text) => vm.updateField(field, text)}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!isVisible}
          accessibilityLabel={label}
        />
        <TouchableOpacity
          style={styles.visibilityToggle}
          onPress={toggleVisibility}
          accessibilityRole="button"
          accessibilityLabel={`Toggle ${label} visibility`}
        >
          <Ionicons
            name={isVisible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>
      {vm.errors[field] ? (
        <Text style={styles.fieldError}>{vm.errors[field]}</Text>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="arrow-back" size={28} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Change Password</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Error Banner */}
        {vm.apiError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{vm.apiError}</Text>
          </View>
        ) : null}

        {/* Success Banner */}
        {vm.successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{vm.successMessage}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          {renderPasswordField(
            'Current Password',
            'currentPassword',
            showCurrentPassword,
            () => setShowCurrentPassword(!showCurrentPassword),
            'Enter current password'
          )}

          {renderPasswordField(
            'New Password',
            'newPassword',
            showNewPassword,
            () => setShowNewPassword(!showNewPassword),
            'Enter new password'
          )}
          <Text style={styles.fieldHint}>Must be at least 8 characters long.</Text>

          {renderPasswordField(
            'Confirm New Password',
            'confirmPassword',
            showConfirmPassword,
            () => setShowConfirmPassword(!showConfirmPassword),
            'Confirm new password'
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              vm.isLoading && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={vm.isLoading}
            accessibilityRole="button"
            accessibilityLabel="Change password"
          >
            {vm.isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="lock-closed-outline" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Change Password</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  screenTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
  },
  successBanner: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  successBannerText: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    gap: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  fieldHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: -14,
    marginBottom: 4,
    marginLeft: 2,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  textInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 48,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  textInputError: {
    borderColor: '#DC2626',
  },
  visibilityToggle: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  fieldError: {
    fontSize: 13,
    color: '#DC2626',
  },
  saveButton: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
