import React, { useState, useCallback, useMemo } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import {
  useEditProfileViewModel,
  GENDER_OPTIONS,
  DISPLAY_NAME_MAX_LENGTH,
  BIO_MAX_LENGTH,
} from '@/viewmodels/profile/useEditProfileViewModel';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export default function EditProfileView() {
  const vm = useEditProfileViewModel();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const getPickerDate = useCallback(() => {
    if (vm.formData.birthDate && vm.formData.birthDate.length === 10) {
      const parts = vm.formData.birthDate.split('.');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const parsed = new Date(y, m, d);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
    return new Date();
  }, [vm.formData.birthDate]);

  const handleDateChange = useCallback(
    (event: any, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }
      if (!selectedDate || event.type === 'dismissed') return;

      const prevDate = getPickerDate();
      const onlyDayChanged =
        selectedDate.getDate() !== prevDate.getDate() &&
        selectedDate.getMonth() === prevDate.getMonth() &&
        selectedDate.getFullYear() === prevDate.getFullYear();

      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      vm.updateField('birthDate', `${d}.${m}.${y}`);

      if (Platform.OS === 'ios' && (event.type === 'set' || onlyDayChanged)) {
        setShowDatePicker(false);
      }
    },
    [getPickerDate, vm],
  );

  const handleSave = async () => {
    const success = await vm.handleSave();
    if (success) {
      router.replace('/(tabs)/profile' as Href);
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
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialIcons name="arrow-back" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.screenTitle}>Edit Profile</Text>
            <View style={styles.headerSpacer} />
          </View>

        {vm.apiError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{vm.apiError}</Text>
          </View>
        ) : null}

        {vm.successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{vm.successMessage}</Text>
          </View>
        ) : null}

        {vm.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.text} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : (
          <View style={styles.formCard}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Display Name</Text>
              <TextInput
                style={[
                  styles.textInput,
                  vm.errors.displayName ? styles.textInputError : null,
                ]}
                value={vm.formData.displayName}
                onChangeText={(text) => vm.updateField('displayName', text)}
                placeholder="Enter your display name"
                placeholderTextColor={theme.placeholder}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                accessibilityLabel="Display name"
              />
              <Text style={styles.charCount}>
                {vm.formData.displayName.length}/{DISPLAY_NAME_MAX_LENGTH}
              </Text>
              {vm.errors.displayName ? (
                <Text style={styles.fieldError}>{vm.errors.displayName}</Text>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Bio</Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textArea,
                  vm.errors.bio ? styles.textInputError : null,
                ]}
                value={vm.formData.bio}
                onChangeText={(text) => vm.updateField('bio', text)}
                placeholder="Tell us about yourself"
                placeholderTextColor={theme.placeholder}
                maxLength={BIO_MAX_LENGTH}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                accessibilityLabel="Bio"
              />
              <Text style={styles.charCount}>
                {vm.formData.bio.length}/{BIO_MAX_LENGTH}
              </Text>
              {vm.errors.bio ? (
                <Text style={styles.fieldError}>{vm.errors.bio}</Text>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <TextInput
                style={[
                  styles.textInput,
                  vm.errors.phoneNumber ? styles.textInputError : null,
                ]}
                value={vm.formData.phoneNumber}
                onChangeText={(text) => vm.updateField('phoneNumber', text)}
                placeholder="+905551112233"
                placeholderTextColor={theme.placeholder}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                accessibilityLabel="Phone number"
              />
              {vm.errors.phoneNumber ? (
                <Text style={styles.fieldError}>{vm.errors.phoneNumber}</Text>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Default Location</Text>
              <View style={styles.locationInputRow}>
                <TextInput
                  style={styles.textInput}
                  value={vm.locationQuery}
                  onChangeText={vm.updateLocationQuery}
                  placeholder="Search for a place..."
                  placeholderTextColor={theme.placeholder}
                  accessibilityLabel="Default location"
                />
                {vm.formData.defaultLocationLat !== null ? (
                  <TouchableOpacity
                    style={styles.clearLocationBtn}
                    onPress={vm.clearLocation}
                    accessibilityRole="button"
                    accessibilityLabel="Clear default location"
                  >
                    <Text style={styles.clearLocationText}>X</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {vm.isSearchingLocation ? (
                <ActivityIndicator
                  size="small"
                  color={theme.text}
                  style={styles.searchSpinner}
                />
              ) : null}
              {vm.locationSuggestions.length > 0 ? (
                <View style={styles.suggestionsContainer}>
                  {vm.locationSuggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                      style={styles.suggestionItem}
                      onPress={() => vm.selectLocationSuggestion(suggestion)}
                    >
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {suggestion.display_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            {vm.canEditGender ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Gender</Text>
                <View style={styles.genderRow}>
                  {GENDER_OPTIONS.map((option) => {
                    const selected = vm.formData.gender === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.genderChip,
                          selected && styles.genderChipSelected,
                        ]}
                        onPress={() =>
                          vm.updateField(
                            'gender',
                            selected ? '' : option.value,
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${option.label}`}
                      >
                        <Text
                          style={[
                            styles.genderChipText,
                            selected && styles.genderChipTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {vm.canEditBirthDate ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Birth Date</Text>
                <View style={styles.dateInputContainer}>
                  <TextInput
                    style={[
                      styles.textInput,
                      styles.dateInputText,
                      vm.errors.birthDate ? styles.textInputError : null,
                    ]}
                    value={vm.formData.birthDate}
                    onChangeText={(text) => vm.updateField('birthDate', text)}
                    placeholder="dd.mm.yyyy"
                    placeholderTextColor={theme.placeholder}
                    accessibilityLabel="Birth date"
                  />
                  <TouchableOpacity
                    style={styles.calendarIconInside}
                    onPress={() => setShowDatePicker((prev) => !prev)}
                    activeOpacity={0.7}
                    accessibilityLabel="Pick birth date"
                  >
                    <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                {vm.errors.birthDate ? (
                  <Text style={styles.fieldError}>{vm.errors.birthDate}</Text>
                ) : null}
              </View>
            ) : null}

            {showDatePicker && vm.canEditBirthDate ? (
              <View style={styles.datePickerWrapper}>
                <DateTimePicker
                  value={getPickerDate()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  maximumDate={new Date()}
                  onChange={handleDateChange}
                />
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.saveButton,
                vm.isSaving && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={vm.isSaving}
              accessibilityRole="button"
              accessibilityLabel="Save profile"
            >
              {vm.isSaving ? (
                <ActivityIndicator size="small" color={theme.textOnPrimary} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.textOnPrimary} />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
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
      color: t.text,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 36,
    },
    errorBanner: {
      backgroundColor: t.errorBg,
      borderColor: t.errorBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    errorBannerText: {
      color: t.errorText,
      fontSize: 14,
    },
    successBanner: {
      backgroundColor: t.successBg,
      borderColor: t.successBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    successBannerText: {
      color: t.successText,
      fontSize: 14,
      fontWeight: '600',
    },
    loadingContainer: {
      paddingVertical: 64,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 12,
      color: t.textSecondary,
      fontSize: 15,
    },
    formCard: {
      backgroundColor: t.surface,
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
      color: t.textSecondary,
    },
    textInput: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: t.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: t.text,
      backgroundColor: t.surfaceVariant,
    },
    locationInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    textInputError: {
      borderColor: t.errorText,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    charCount: {
      fontSize: 12,
      color: t.textTertiary,
      textAlign: 'right',
    },
    fieldError: {
      fontSize: 13,
      color: t.errorText,
    },
    genderRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    genderChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: t.border,
      backgroundColor: t.surfaceVariant,
    },
    genderChipSelected: {
      borderColor: t.primaryAlt,
      backgroundColor: t.primaryAlt,
    },
    genderChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
    },
    genderChipTextSelected: {
      color: t.textOnPrimary,
    },
    dateInputContainer: {
      position: 'relative',
      justifyContent: 'center',
    },
    dateInputText: {
      paddingRight: 46,
    },
    calendarIconInside: {
      position: 'absolute',
      right: 14,
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    datePickerWrapper: {
      alignItems: 'center',
      marginBottom: 4,
      backgroundColor: t.surface,
      borderRadius: 12,
    },
    clearLocationBtn: {
      padding: 10,
      backgroundColor: t.surfaceAlt,
      borderRadius: 10,
    },
    clearLocationText: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
    },
    searchSpinner: {
      marginTop: 8,
    },
    suggestionsContainer: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surface,
      overflow: 'hidden',
    },
    suggestionItem: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.surfaceAlt,
    },
    suggestionText: {
      fontSize: 14,
      color: t.textSecondary,
    },
    saveButton: {
      backgroundColor: t.primaryAlt,
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
      color: t.textOnPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
