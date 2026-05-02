import React, { useState, useCallback } from 'react';
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
import { router, type Href } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
  useEditProfileViewModel,
  GENDER_OPTIONS,
  DISPLAY_NAME_MAX_LENGTH,
  BIO_MAX_LENGTH,
} from '@/viewmodels/profile/useEditProfileViewModel';

export default function EditProfileView() {
  const vm = useEditProfileViewModel();
  const [showDatePicker, setShowDatePicker] = useState(false);

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
          <Text style={styles.screenTitle}>Edit Profile</Text>
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

        {/* Loading State */}
        {vm.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0F172A" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : (
          <View style={styles.formCard}>
            {/* Display Name */}
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
                placeholderTextColor="#9CA3AF"
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

            {/* Bio */}
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
                placeholderTextColor="#9CA3AF"
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

            {/* Phone Number */}
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
                placeholderTextColor="#9CA3AF"
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
                  placeholderTextColor="#9CA3AF"
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
                  color="#111827"
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

            {/* Gender */}
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

            {/* Birth Date */}
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
                    placeholderTextColor="#9CA3AF"
                    accessibilityLabel="Birth date"
                  />
                  <TouchableOpacity
                    style={styles.calendarIconInside}
                    onPress={() => setShowDatePicker((prev) => !prev)}
                    activeOpacity={0.7}
                    accessibilityLabel="Pick birth date"
                  >
                    <Ionicons name="calendar-outline" size={20} color="#6B7280" />
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

            {/* Save Button */}
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
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
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
  loadingContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 15,
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
  textInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInputError: {
    borderColor: '#DC2626',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  fieldError: {
    fontSize: 13,
    color: '#DC2626',
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
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  genderChipSelected: {
    borderColor: '#0F172A',
    backgroundColor: '#0F172A',
  },
  genderChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  genderChipTextSelected: {
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  clearLocationBtn: {
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  clearLocationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  searchSpinner: {
    marginTop: 8,
  },
  suggestionsContainer: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionText: {
    fontSize: 14,
    color: '#374151',
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
