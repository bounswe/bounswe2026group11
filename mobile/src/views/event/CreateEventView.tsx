import React, { useCallback, useMemo, useState } from 'react';
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
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCreateEventViewModel,
  CATEGORIES,
  CATEGORY_PREVIEW_COUNT,
  PRIVACY_OPTIONS,
  CONSTRAINT_TYPES,
  CONSTRAINT_TYPE_LIMITS,
  ConstraintType,
  TITLE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from '@/viewmodels/event/useCreateEventViewModel';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export default function CreateEventView() {
  const vm = useCreateEventViewModel();
  const { token } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleCreate = async () => {
    await vm.handleSubmit(token ?? '');
  };

  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | null>(null);
  const [activeTimePicker, setActiveTimePicker] = useState<'start' | 'end' | null>(null);

  const parseDateString = useCallback((dateStr: string): Date => {
    if (dateStr && dateStr.length === 10) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const parsed = new Date(y, m, d);
        if (
          !isNaN(parsed.getTime()) &&
          parsed.getDate() === d &&
          parsed.getMonth() === m &&
          parsed.getFullYear() === y
        ) {
          return parsed;
        }
      }
    }
    return new Date();
  }, []);

  const parseTimeString = useCallback((timeStr: string): Date => {
    const now = new Date();
    if (timeStr && timeStr.length === 5) {
      const parts = timeStr.split(':');
      if (parts.length === 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          now.setHours(h, m, 0, 0);
          return now;
        }
      }
    }
    return now;
  }, []);

  const getCurrentPickerDate = useCallback(() => {
    const dateStr = activeDatePicker === 'start' ? vm.formData.startDate : vm.formData.endDate;
    return parseDateString(dateStr);
  }, [activeDatePicker, vm.formData.startDate, vm.formData.endDate, parseDateString]);

  const getCurrentPickerTime = useCallback(() => {
    const timeStr = activeTimePicker === 'start' ? vm.formData.startTime : vm.formData.endTime;
    return parseTimeString(timeStr);
  }, [activeTimePicker, vm.formData.startTime, vm.formData.endTime, parseTimeString]);

  const getStartOfDay = useCallback((date: Date): Date => {
    const minDate = new Date(date);
    minDate.setHours(0, 0, 0, 0);
    return minDate;
  }, []);

  const getMinimumDatePickerDate = useCallback(() => {
    if (activeDatePicker === 'end' && vm.formData.startDate?.length === 10) {
      const parsedStart = parseDateString(vm.formData.startDate);
      if (!isNaN(parsedStart.getTime())) {
        return getStartOfDay(parsedStart);
      }
    }
    return getStartOfDay(new Date());
  }, [activeDatePicker, vm.formData.startDate, parseDateString, getStartOfDay]);

  const handleDateValueChange = useCallback(
    (_event: any, selectedDate?: Date) => {
      if (!selectedDate) {
        setActiveDatePicker(null);
        return;
      }
      const prevDate = getCurrentPickerDate();
      const onlyDayChanged =
        selectedDate.getDate() !== prevDate.getDate() &&
        selectedDate.getMonth() === prevDate.getMonth() &&
        selectedDate.getFullYear() === prevDate.getFullYear();

      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = String(selectedDate.getFullYear());
      const formatted = `${day}.${month}.${year}`;

      if (activeDatePicker === 'start') {
        vm.updateField('startDate', formatted);
      } else if (activeDatePicker === 'end') {
        vm.updateField('endDate', formatted);
      }

      if (Platform.OS === 'android' || (Platform.OS === 'ios' && onlyDayChanged)) {
        setActiveDatePicker(null);
      }
    },
    [activeDatePicker, getCurrentPickerDate, vm],
  );

  const handleTimeValueChange = useCallback(
    (_event: any, selectedDate?: Date) => {
      if (!selectedDate) {
        setActiveTimePicker(null);
        return;
      }
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
      const formatted = `${hours}:${minutes}`;

      if (activeTimePicker === 'start') {
        vm.updateField('startTime', formatted);
      } else if (activeTimePicker === 'end') {
        vm.updateField('endTime', formatted);
      }

      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        setActiveTimePicker(null);
      }
    },
    [activeTimePicker, vm],
  );

  const toggleDatePicker = useCallback((target: 'start' | 'end') => {
    setActiveTimePicker(null);
    setActiveDatePicker((prev) => (prev === target ? null : target));
  }, []);

  const toggleTimePicker = useCallback((target: 'start' | 'end') => {
    setActiveDatePicker(null);
    setActiveTimePicker((prev) => (prev === target ? null : target));
  }, []);

  const clearEndDateTime = useCallback(() => {
    vm.updateField('endDate', '');
    vm.updateField('endTime', '');
    setActiveDatePicker((prev) => (prev === 'end' ? null : prev));
    setActiveTimePicker((prev) => (prev === 'end' ? null : prev));
  }, [vm]);

  const visibleCategories = (() => {
    if (vm.categoriesExpanded) return CATEGORIES;
    const preview = CATEGORIES.slice(0, CATEGORY_PREVIEW_COUNT);
    if (
      vm.formData.categoryId !== null &&
      !preview.some((c) => c.id === vm.formData.categoryId)
    ) {
      const selected = CATEGORIES.find((c) => c.id === vm.formData.categoryId);
      if (selected) return [...preview, selected];
    }
    return preview;
  })();

  const isConstraintTypeAtLimit = (ct: ConstraintType) =>
    vm.constraintTypeCounts[ct] >= CONSTRAINT_TYPE_LIMITS[ct];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        testID="create-event-keyboard-avoider"
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              accessibilityLabel="Go back to home"
            >
              <MaterialIcons name="arrow-back" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Create Event</Text>
            <View style={styles.headerSpacer} />
          </View>

        {vm.apiError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{vm.apiError}</Text>
          </View>
        )}

        {vm.successMessage && (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{vm.successMessage}</Text>
          </View>
        )}

        {vm.imageUploadSuccessMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{vm.imageUploadSuccessMessage}</Text>
          </View>
        ) : null}

        {/* Image */}
        <View style={styles.fieldGroup}>
          {vm.selectedImageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: vm.selectedImageUri }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.imageRemoveButton}
                onPress={vm.removeImage}
                disabled={vm.isLoading}
              >
                <MaterialIcons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              {vm.isUploadingImage && (
                <View style={styles.imageUploadOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.imageUploadOverlayText}>Uploading...</Text>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.imageUploadArea}
              onPress={vm.pickImage}
              disabled={vm.isLoading}
            >
              <MaterialIcons name="add-photo-alternate" size={36} color={theme.textTertiary} />
              <Text style={styles.imageUploadText}>Add Event Image</Text>
            </TouchableOpacity>
          )}
          {vm.imageError && <Text style={styles.fieldError}>{vm.imageError}</Text>}
        </View>

        {/* Title */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, vm.errors.title && styles.inputError]}
            placeholder="Event name"
            placeholderTextColor={theme.placeholder}
            value={vm.formData.title}
            onChangeText={(v) => vm.updateField('title', v)}
            maxLength={TITLE_MAX_LENGTH}
            editable={!vm.isLoading}
          />
          {vm.errors.title && (
            <Text style={styles.fieldError}>{vm.errors.title}</Text>
          )}
        </View>

        {/* Description */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Description <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea, vm.errors.description && styles.inputError]}
            placeholder="What's this event about?"
            placeholderTextColor={theme.placeholder}
            value={vm.formData.description}
            onChangeText={(v) => vm.updateField('description', v)}
            maxLength={DESCRIPTION_MAX_LENGTH}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!vm.isLoading}
          />
          {vm.errors.description && (
            <Text style={styles.fieldError}>{vm.errors.description}</Text>
          )}
        </View>

        {/* Category */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Category <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.chipRow}>
            {visibleCategories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.chip,
                  vm.formData.categoryId === cat.id && styles.chipSelected,
                ]}
                onPress={() =>
                  vm.updateField('categoryId', vm.formData.categoryId === cat.id ? null : cat.id)
                }
                disabled={vm.isLoading}
              >
                <Text
                  style={[
                    styles.chipText,
                    vm.formData.categoryId === cat.id && styles.chipTextSelected,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {CATEGORIES.length > CATEGORY_PREVIEW_COUNT && (
            <TouchableOpacity style={styles.showMoreBtn} onPress={vm.toggleCategoriesExpanded}>
              <Text style={styles.showMoreText}>
                {vm.categoriesExpanded ? 'Show less' : 'Show more'}
              </Text>
            </TouchableOpacity>
          )}
          {vm.errors.categoryId && (
            <Text style={styles.fieldError}>{vm.errors.categoryId}</Text>
          )}
        </View>

        {/* Location */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Location <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.locationInputRow}>
            <TextInput
              style={[styles.input, styles.locationInput, vm.errors.location && styles.inputError]}
              placeholder="Search for a place..."
              placeholderTextColor={theme.placeholder}
              value={vm.formData.locationQuery}
              onChangeText={(v) => vm.handleLocationSearch(v)}
              editable={!vm.isLoading}
            />
            {vm.formData.lat !== null && (
              <TouchableOpacity style={styles.clearLocationBtn} onPress={vm.clearLocation}>
                <Text style={styles.clearLocationText}>X</Text>
              </TouchableOpacity>
            )}
          </View>
          {vm.isSearchingLocation && (
            <ActivityIndicator size="small" color={theme.text} style={styles.searchSpinner} />
          )}
          {vm.locationSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {vm.locationSuggestions.map((s, i) => (
                <TouchableOpacity
                  key={`${s.lat}-${s.lon}-${i}`}
                  style={styles.suggestionItem}
                  onPress={() => vm.selectLocation(s)}
                >
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {s.display_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {vm.errors.location && (
            <Text style={styles.fieldError}>{vm.errors.location}</Text>
          )}
        </View>

        {/* Start Date/Time */}
        <View style={styles.fieldGroup}>
          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeCol}>
              <Text style={styles.label}>
                Start <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.input, styles.pickerField, vm.errors.startDate && styles.inputError]}
                onPress={() => toggleDatePicker('start')}
                disabled={vm.isLoading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Pick start date"
              >
                <Text
                  style={[
                    styles.pickerFieldText,
                    !vm.formData.startDate && styles.pickerPlaceholderText,
                  ]}
                >
                  {vm.formData.startDate || 'Select date'}
                </Text>
                <MaterialIcons name="event" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              {vm.errors.startDate && (
                <Text style={styles.fieldError}>{vm.errors.startDate}</Text>
              )}
            </View>
            <View style={styles.dateTimeColSmall}>
              <Text style={styles.label}>{' '}</Text>
              <TouchableOpacity
                style={[styles.input, styles.pickerField, vm.errors.startTime && styles.inputError]}
                onPress={() => toggleTimePicker('start')}
                disabled={vm.isLoading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Pick start time"
              >
                <Text
                  style={[
                    styles.pickerFieldText,
                    !vm.formData.startTime && styles.pickerPlaceholderText,
                  ]}
                >
                  {vm.formData.startTime || 'Select time'}
                </Text>
                <MaterialIcons name="schedule" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              {vm.errors.startTime && (
                <Text style={styles.fieldError}>{vm.errors.startTime}</Text>
              )}
            </View>
          </View>
          {activeDatePicker === 'start' && (
            <View style={styles.datePickerWrapper}>
              <DateTimePicker
                value={getCurrentPickerDate()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={getMinimumDatePickerDate()}
                onChange={handleDateValueChange}
              />
            </View>
          )}
          {activeTimePicker === 'start' && (
            <View style={styles.datePickerWrapper}>
              <DateTimePicker
                value={getCurrentPickerTime()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                is24Hour={true}
                onChange={handleTimeValueChange}
              />
            </View>
          )}
        </View>

        {/* End Date/Time */}
        <View style={styles.fieldGroup}>
          <View style={styles.inlineLabelRow}>
            <Text style={styles.label}>End</Text>
            {(vm.formData.endDate || vm.formData.endTime) && (
              <TouchableOpacity
                onPress={clearEndDateTime}
                disabled={vm.isLoading}
                accessibilityRole="button"
                accessibilityLabel="Clear end date and time"
              >
                <Text style={styles.inlineActionText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeCol}>
              <TouchableOpacity
                style={[styles.input, styles.pickerField, vm.errors.endDate && styles.inputError]}
                onPress={() => toggleDatePicker('end')}
                disabled={vm.isLoading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Pick end date"
              >
                <Text
                  style={[
                    styles.pickerFieldText,
                    !vm.formData.endDate && styles.pickerPlaceholderText,
                  ]}
                >
                  {vm.formData.endDate || 'Select date'}
                </Text>
                <MaterialIcons name="event" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              {vm.errors.endDate && (
                <Text style={styles.fieldError}>{vm.errors.endDate}</Text>
              )}
            </View>
            <View style={styles.dateTimeColSmall}>
              <TouchableOpacity
                style={[styles.input, styles.pickerField, vm.errors.endTime && styles.inputError]}
                onPress={() => toggleTimePicker('end')}
                disabled={vm.isLoading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Pick end time"
              >
                <Text
                  style={[
                    styles.pickerFieldText,
                    !vm.formData.endTime && styles.pickerPlaceholderText,
                  ]}
                >
                  {vm.formData.endTime || 'Select time'}
                </Text>
                <MaterialIcons name="schedule" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              {vm.errors.endTime && (
                <Text style={styles.fieldError}>{vm.errors.endTime}</Text>
              )}
            </View>
          </View>
          {activeDatePicker === 'end' && (
            <View style={styles.datePickerWrapper}>
              <DateTimePicker
                value={getCurrentPickerDate()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={getMinimumDatePickerDate()}
                onChange={handleDateValueChange}
              />
            </View>
          )}
          {activeTimePicker === 'end' && (
            <View style={styles.datePickerWrapper}>
              <DateTimePicker
                value={getCurrentPickerTime()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                is24Hour={true}
                onChange={handleTimeValueChange}
              />
            </View>
          )}
        </View>

        {/* Privacy Level */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Privacy Level <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.privacyRow}>
            {PRIVACY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.privacyOption,
                  vm.formData.privacyLevel === opt.value && styles.privacyOptionSelected,
                ]}
                onPress={() => vm.updateField('privacyLevel', opt.value)}
                disabled={vm.isLoading}
              >
                <Text
                  style={[
                    styles.privacyOptionText,
                    vm.formData.privacyLevel === opt.value && styles.privacyOptionTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.privacyDescriptionContainer}>
            <Text style={styles.privacyDescriptionText}>
              {vm.formData.privacyLevel === 'PUBLIC' &&
                'Visible to everyone. Anyone can join without approval.'}
              {vm.formData.privacyLevel === 'PROTECTED' &&
                'Visible to everyone, but people must send a join request and wait for your approval.'}
              {vm.formData.privacyLevel === 'PRIVATE' &&
                'Only visible to invited users. People can join only if you invite them.'}
            </Text>
          </View>
        </View>

        {/* Invite Guests (Private Only) */}
        {vm.formData.privacyLevel === 'PRIVATE' && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Invite Guests</Text>
            <View style={styles.tagInputRow}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[styles.input, styles.tagInput]}
                  placeholder="Username"
                  placeholderTextColor={theme.placeholder}
                  value={vm.userSearchQuery}
                  onChangeText={(v) => vm.handleUserSearch(v, token ?? '')}
                  editable={!vm.isLoading}
                />
                {vm.isSearchingUsers && (
                  <ActivityIndicator size="small" color={theme.text} style={styles.userSearchSpinner} />
                )}
                {vm.userSuggestions.length > 0 && (
                  <View style={styles.userSuggestionsContainer}>
                    {vm.userSuggestions.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.userSuggestionItem}
                        onPress={() => vm.addInvitedUser(s.username)}
                      >
                        <Text style={styles.userSuggestionText}>@{s.username}</Text>
                        {s.display_name && (
                          <Text style={styles.userSuggestionSubtext}>{s.display_name}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.fileUploadButton}
                onPress={vm.pickAndParseUserFile}
                disabled={vm.isLoading}
              >
                <MaterialIcons name="upload-file" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {vm.invitedUsers.length > 0 && (
              <View style={styles.chipRow}>
                {vm.invitedUsers.map((username, i) => (
                  <View key={`${username}-${i}`} style={[styles.tagChip, styles.invitedUserChip]}>
                    <Text style={styles.tagChipText}>{username}</Text>
                    <TouchableOpacity
                      style={styles.chipRemoveBtn}
                      onPress={() => vm.removeInvitedUser(username)}
                    >
                      <MaterialIcons name="close" size={14} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.helperText}>
              Add guests by username or upload a .txt/.csv file (one username per line or comma-separated).
            </Text>

            {vm.invitedUsers.length > 0 && (
              <View style={[styles.fieldGroup, { marginTop: 16, marginBottom: 0 }]}>
                <Text style={styles.label}>Invitation Message (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { minHeight: 80 }]}
                  placeholder="Personalize your invitation..."
                  placeholderTextColor={theme.placeholder}
                  value={vm.formData.invitationMessage}
                  onChangeText={(v) => vm.updateField('invitationMessage', v)}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!vm.isLoading}
                />
                <Text style={styles.helperText}>
                  This message will be sent to all invited guests.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tags */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tags (max 5)</Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.input, styles.tagInput]}
              placeholder="Add tag"
              placeholderTextColor={theme.placeholder}
              value={vm.formData.tagInput}
              onChangeText={(v) => vm.updateField('tagInput', v)}
              onSubmitEditing={vm.addTag}
              editable={!vm.isLoading && vm.formData.tags.length < 5}
              maxLength={20}
            />
            <TouchableOpacity
              style={[
                styles.addButton,
                (vm.formData.tags.length >= 5 || !vm.formData.tagInput.trim()) &&
                  styles.addButtonDisabled,
              ]}
              onPress={vm.addTag}
              disabled={vm.formData.tags.length >= 5 || !vm.formData.tagInput.trim()}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          {vm.formData.tags.length > 0 && (
            <View style={styles.chipRow}>
              {vm.formData.tags.map((tag, i) => (
                <TouchableOpacity
                  key={`${tag}-${i}`}
                  style={styles.tagChip}
                  onPress={() => vm.removeTag(i)}
                >
                  <Text style={styles.tagChipText}>{tag} x</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {vm.errors.tags && (
            <Text style={styles.fieldError}>{vm.errors.tags}</Text>
          )}
        </View>

        {/* Participation Constraints */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Participation Constraints</Text>
          <View style={styles.chipRow}>
            {CONSTRAINT_TYPES.map((ct) => {
              const atLimit = isConstraintTypeAtLimit(ct);
              const isActive = vm.formData.constraintType === ct;
              return (
                <TouchableOpacity
                  key={ct}
                  style={[
                    styles.chip,
                    isActive && !atLimit && styles.chipSelected,
                    atLimit && styles.chipUsed,
                  ]}
                  onPress={() => vm.updateField('constraintType', ct as ConstraintType)}
                  disabled={vm.isLoading}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isActive && !atLimit && styles.chipTextSelected,
                      atLimit && styles.chipTextUsed,
                    ]}
                  >
                    {ct.charAt(0).toUpperCase() + ct.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!isConstraintTypeAtLimit(vm.formData.constraintType) && (
            <View style={styles.constraintInputSection}>
              {vm.formData.constraintType === 'gender' && (
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => vm.addGenderConstraint('MALE')}
                    disabled={vm.isLoading}
                  >
                    <Text style={styles.chipText}>Males only</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => vm.addGenderConstraint('FEMALE')}
                    disabled={vm.isLoading}
                  >
                    <Text style={styles.chipText}>Females only</Text>
                  </TouchableOpacity>
                </View>
              )}

              {vm.formData.constraintType === 'age' && (
                <View>
                  <View style={styles.chipRow}>
                    {['16', '18', '21'].map((age) => (
                      <TouchableOpacity
                        key={age}
                        style={[
                          styles.chip,
                          vm.formData.ageMinInput === age && !vm.formData.ageMaxInput && styles.chipSelected,
                        ]}
                        onPress={() => {
                          vm.updateField('ageMinInput', age);
                          vm.updateField('ageMaxInput', '');
                        }}
                        disabled={vm.isLoading}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            vm.formData.ageMinInput === age && !vm.formData.ageMaxInput && styles.chipTextSelected,
                          ]}
                        >
                          {age}+
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        vm.formData.ageMaxInput !== '' && styles.chipSelected,
                      ]}
                      onPress={() => {
                        if (!vm.formData.ageMaxInput) {
                          vm.updateField('ageMinInput', '');
                          vm.updateField('ageMaxInput', ' ');
                        } else {
                          vm.updateField('ageMaxInput', '');
                        }
                      }}
                      disabled={vm.isLoading}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          vm.formData.ageMaxInput !== '' && styles.chipTextSelected,
                        ]}
                      >
                        Custom range
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {vm.formData.ageMaxInput !== '' && (
                    <View style={[styles.dateTimeRow, { marginTop: 8 }]}>
                      <View style={styles.dateTimeCol}>
                        <TextInput
                          style={styles.input}
                          placeholder="Min age"
                          placeholderTextColor={theme.placeholder}
                          value={vm.formData.ageMinInput}
                          onChangeText={(v) => vm.updateField('ageMinInput', v)}
                          keyboardType="numeric"
                          editable={!vm.isLoading}
                        />
                      </View>
                      <View style={styles.dateTimeCol}>
                        <TextInput
                          style={styles.input}
                          placeholder="Max age"
                          placeholderTextColor={theme.placeholder}
                          value={vm.formData.ageMaxInput.trim() ? vm.formData.ageMaxInput : ''}
                          onChangeText={(v) => vm.updateField('ageMaxInput', v)}
                          keyboardType="numeric"
                          editable={!vm.isLoading}
                        />
                      </View>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.addConstraintBtn, styles.addButton, { marginTop: 8 }]}
                    onPress={vm.addConstraint}
                    disabled={vm.isLoading || (!vm.formData.ageMinInput.trim() && !vm.formData.ageMaxInput.trim())}
                  >
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}

              {vm.formData.constraintType === 'capacity' && (
                <View style={styles.tagInputRow}>
                  <TextInput
                    style={[styles.input, styles.tagInput]}
                    placeholder="Max participants"
                    placeholderTextColor={theme.placeholder}
                    value={vm.formData.capacityInput}
                    onChangeText={(v) => vm.updateField('capacityInput', v)}
                    keyboardType="numeric"
                    editable={!vm.isLoading}
                  />
                  <TouchableOpacity
                    style={[
                      styles.addButton,
                      !vm.formData.capacityInput.trim() && styles.addButtonDisabled,
                    ]}
                    onPress={vm.addConstraint}
                    disabled={vm.isLoading || !vm.formData.capacityInput.trim()}
                  >
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}

              {vm.formData.constraintType === 'other' && (
                <View style={styles.tagInputRow}>
                  <TextInput
                    style={[styles.input, styles.tagInput]}
                    placeholder="Describe requirement"
                    placeholderTextColor={theme.placeholder}
                    value={vm.formData.otherConstraintInput}
                    onChangeText={(v) => vm.updateField('otherConstraintInput', v)}
                    onSubmitEditing={vm.addConstraint}
                    editable={!vm.isLoading}
                  />
                  <TouchableOpacity
                    style={[
                      styles.addButton,
                      !vm.formData.otherConstraintInput.trim() && styles.addButtonDisabled,
                    ]}
                    onPress={vm.addConstraint}
                    disabled={vm.isLoading || !vm.formData.otherConstraintInput.trim()}
                  >
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {vm.formData.constraints.length > 0 && (
            <View style={styles.constraintList}>
              {vm.formData.constraints.map((c, i) => (
                <View key={`${c.type}-${c.info}-${i}`} style={styles.constraintChip}>
                  <Text style={styles.constraintChipText}>{c.info}</Text>
                  <TouchableOpacity
                    style={styles.constraintRemoveBtn}
                    onPress={() => vm.removeConstraint(i)}
                  >
                    <MaterialIcons name="close" size={16} color={theme.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {vm.errors.constraints && (
            <Text style={styles.fieldError}>{vm.errors.constraints}</Text>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, vm.isLoading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={vm.isLoading}
          activeOpacity={0.8}
        >
          {vm.isLoading ? (
            <ActivityIndicator color={theme.textOnPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>Create Event</Text>
          )}
        </TouchableOpacity>
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
      paddingTop: 24,
      paddingBottom: 40,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    headerSpacer: {
      width: 72,
    },
    backButton: {
      marginRight: 12,
      padding: 4,
    },
    title: {
      flex: 1,
      fontSize: 24,
      fontWeight: '700',
      color: t.text,
      textAlign: 'center',
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
    fieldGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
      marginBottom: 6,
    },
    inlineLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    inlineActionText: {
      fontSize: 13,
      fontWeight: '600',
      color: t.primary,
    },
    required: {
      color: t.errorText,
    },
    input: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: t.text,
      backgroundColor: t.surfaceVariant,
    },
    inputError: {
      borderColor: t.errorText,
      backgroundColor: t.errorBg,
    },
    textArea: {
      minHeight: 100,
      paddingTop: 12,
    },
    fieldError: {
      color: t.errorText,
      fontSize: 13,
      marginTop: 4,
    },
    imageUploadArea: {
      borderWidth: 2,
      borderColor: t.border,
      borderStyle: 'dashed',
      borderRadius: 10,
      paddingVertical: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceVariant,
      gap: 6,
    },
    imageUploadText: {
      fontSize: 14,
      color: t.textSecondary,
    },
    imagePreviewContainer: {
      position: 'relative',
      borderRadius: 10,
      overflow: 'hidden',
    },
    imagePreview: {
      width: '100%',
      height: 200,
      borderRadius: 10,
    },
    imageRemoveButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 14,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageUploadOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      gap: 8,
    },
    imageUploadOverlayText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    pickerField: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pickerFieldText: {
      color: t.text,
      fontSize: 16,
    },
    pickerPlaceholderText: {
      color: t.placeholder,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceVariant,
    },
    chipSelected: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    chipUsed: {
      backgroundColor: t.surfaceAlt,
      borderColor: t.border,
      opacity: 0.6,
    },
    chipText: {
      fontSize: 14,
      color: t.textSecondary,
    },
    chipTextSelected: {
      color: t.textOnPrimary,
    },
    chipTextUsed: {
      color: t.textTertiary,
    },
    showMoreBtn: {
      marginTop: 8,
      alignSelf: 'flex-start',
    },
    showMoreText: {
      fontSize: 13,
      color: t.primary,
      fontWeight: '600',
    },
    locationInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    locationInput: {
      flex: 1,
    },
    clearLocationBtn: {
      marginLeft: 8,
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
    dateTimeRow: {
      flexDirection: 'row',
      gap: 12,
    },
    dateTimeCol: {
      flex: 3,
    },
    dateTimeColSmall: {
      flex: 2,
    },
    datePickerWrapper: {
      alignItems: 'center',
      marginTop: 12,
      backgroundColor: t.surface,
      borderRadius: 12,
    },
    privacyRow: {
      flexDirection: 'row',
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
    },
    privacyOption: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: t.surfaceVariant,
    },
    privacyOptionSelected: {
      backgroundColor: t.primary,
    },
    privacyOptionText: {
      fontSize: 14,
      fontWeight: '500',
      color: t.textSecondary,
    },
    privacyOptionTextSelected: {
      color: t.textOnPrimary,
    },
    privacyDescriptionContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: t.surfaceVariant,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.border,
    },
    privacyDescriptionText: {
      fontSize: 13,
      color: t.textSecondary,
      lineHeight: 18,
    },
    tagInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    tagInput: {
      flex: 1,
    },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: t.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonDisabled: {
      opacity: 0.4,
    },
    addButtonText: {
      color: t.textOnPrimary,
      fontSize: 22,
      fontWeight: '600',
    },
    tagChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: t.surfaceAlt,
      borderWidth: 1,
      borderColor: t.border,
      marginTop: 8,
    },
    tagChipText: {
      fontSize: 13,
      color: t.text,
    },
    invitedUserChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingRight: 8,
    },
    chipRemoveBtn: {
      padding: 2,
    },
    userSearchSpinner: {
      position: 'absolute',
      right: 12,
      top: 12,
    },
    userSuggestionsContainer: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: t.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      zIndex: 1000,
      marginTop: 4,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      maxHeight: 200,
      overflow: 'hidden',
    },
    userSuggestionItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.surfaceAlt,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    userSuggestionText: {
      fontSize: 15,
      fontWeight: '600',
      color: t.text,
    },
    userSuggestionSubtext: {
      fontSize: 13,
      color: t.textSecondary,
    },
    fileUploadButton: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: t.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
    },
    helperText: {
      fontSize: 12,
      color: t.textSecondary,
      marginTop: 8,
      lineHeight: 16,
    },
    constraintInputSection: {
      marginTop: 10,
      gap: 8,
    },
    addConstraintBtn: {
      alignSelf: 'flex-end',
    },
    constraintList: {
      marginTop: 8,
      gap: 6,
    },
    constraintChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 12,
      paddingRight: 4,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: t.surfaceAlt,
      borderWidth: 1,
      borderColor: t.border,
    },
    constraintChipText: {
      flex: 1,
      fontSize: 13,
      color: t.textSecondary,
    },
    constraintRemoveBtn: {
      padding: 6,
    },
    submitButton: {
      backgroundColor: t.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: t.textOnPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
