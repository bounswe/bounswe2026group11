import React, { useCallback, useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
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

export default function CreateEventView() {
  const vm = useCreateEventViewModel();
  const { token } = useAuth();

  const handleCreate = async () => {
    await vm.handleSubmit(token ?? '');
  };

  // Date & time picker state
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
    (_event: any, selectedDate: Date) => {
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
    (_event: any, selectedDate: Date) => {
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

  const handleDateDismiss = useCallback(() => {
    setActiveDatePicker(null);
  }, []);

  const handleTimeDismiss = useCallback(() => {
    setActiveTimePicker(null);
  }, []);

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

  // When collapsed, show the first N categories plus the selected one if it's outside that range
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
            accessibilityLabel="Go back to home"
          >
            <MaterialIcons name="arrow-back" size={28} color="#111827" />
          </TouchableOpacity>
          <Text style={[styles.title, styles.headerTitle]}>Create Event</Text>
          <View style={styles.headerSpacer} />
        </View>

        {vm.apiError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{vm.apiError}</Text>
          </View>
        )}

        {/* Success Banner */}
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
              <MaterialIcons name="add-photo-alternate" size={36} color="#9CA3AF" />
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
            placeholderTextColor="#9CA3AF"
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
            style={[
              styles.input,
              styles.textArea,
              vm.errors.description && styles.inputError,
            ]}
            placeholder="What's this event about?"
            placeholderTextColor="#9CA3AF"
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
                  vm.updateField(
                    'categoryId',
                    vm.formData.categoryId === cat.id ? null : cat.id,
                  )
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
            <TouchableOpacity
              style={styles.showMoreBtn}
              onPress={vm.toggleCategoriesExpanded}
            >
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
              style={[
                styles.input,
                styles.locationInput,
                vm.errors.location && styles.inputError,
              ]}
              placeholder="Search for a place..."
              placeholderTextColor="#9CA3AF"
              value={vm.formData.locationQuery}
              onChangeText={(v) => vm.handleLocationSearch(v)}
              editable={!vm.isLoading}
            />
            {vm.formData.lat !== null && (
              <TouchableOpacity
                style={styles.clearLocationBtn}
                onPress={vm.clearLocation}
              >
                <Text style={styles.clearLocationText}>X</Text>
              </TouchableOpacity>
            )}
          </View>
          {vm.isSearchingLocation && (
            <ActivityIndicator size="small" color="#111827" style={styles.searchSpinner} />
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
                style={[
                  styles.input,
                  styles.pickerField,
                  vm.errors.startDate && styles.inputError,
                ]}
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
                <MaterialIcons name="event" size={20} color="#6B7280" />
              </TouchableOpacity>
              {vm.errors.startDate && (
                <Text style={styles.fieldError}>{vm.errors.startDate}</Text>
              )}
            </View>
            <View style={styles.dateTimeColSmall}>
              <Text style={styles.label}>{' '}</Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.pickerField,
                  vm.errors.startTime && styles.inputError,
                ]}
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
                <MaterialIcons name="schedule" size={20} color="#6B7280" />
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
                onValueChange={handleDateValueChange}
                onDismiss={handleDateDismiss}
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
                onValueChange={handleTimeValueChange}
                onDismiss={handleTimeDismiss}
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
                style={[
                  styles.input,
                  styles.pickerField,
                  vm.errors.endDate && styles.inputError,
                ]}
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
                <MaterialIcons name="event" size={20} color="#6B7280" />
              </TouchableOpacity>
              {vm.errors.endDate && (
                <Text style={styles.fieldError}>{vm.errors.endDate}</Text>
              )}
            </View>
            <View style={styles.dateTimeColSmall}>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.pickerField,
                  vm.errors.endTime && styles.inputError,
                ]}
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
                <MaterialIcons name="schedule" size={20} color="#6B7280" />
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
                onValueChange={handleDateValueChange}
                onDismiss={handleDateDismiss}
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
                onValueChange={handleTimeValueChange}
                onDismiss={handleTimeDismiss}
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
                  vm.formData.privacyLevel === opt.value &&
                    styles.privacyOptionSelected,
                ]}
                onPress={() => vm.updateField('privacyLevel', opt.value)}
                disabled={vm.isLoading}
              >
                <Text
                  style={[
                    styles.privacyOptionText,
                    vm.formData.privacyLevel === opt.value &&
                      styles.privacyOptionTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

        </View>

        {/* Tags */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tags (max 5)</Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.input, styles.tagInput]}
              placeholder="Add tag"
              placeholderTextColor="#9CA3AF"
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

          {/* Constraint type selector */}
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

          {/* Type-specific input */}
          {!isConstraintTypeAtLimit(vm.formData.constraintType) && (
            <View style={styles.constraintInputSection}>
              {/* Gender: tap to directly add */}
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

              {/* Age: quick-select presets + optional custom range */}
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
                          placeholderTextColor="#9CA3AF"
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
                          placeholderTextColor="#9CA3AF"
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

              {/* Capacity */}
              {vm.formData.constraintType === 'capacity' && (
                <View style={styles.tagInputRow}>
                  <TextInput
                    style={[styles.input, styles.tagInput]}
                    placeholder="Max participants"
                    placeholderTextColor="#9CA3AF"
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

              {/* Other */}
              {vm.formData.constraintType === 'other' && (
                <View style={styles.tagInputRow}>
                  <TextInput
                    style={[styles.input, styles.tagInput]}
                    placeholder="Describe requirement"
                    placeholderTextColor="#9CA3AF"
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

          {/* Constraint chips */}
          {vm.formData.constraints.length > 0 && (
            <View style={styles.constraintList}>
              {vm.formData.constraints.map((c, i) => (
                <View key={`${c.type}-${c.info}-${i}`} style={styles.constraintChip}>
                  <Text style={styles.constraintChipText}>{c.info}</Text>
                  <TouchableOpacity
                    style={styles.constraintRemoveBtn}
                    onPress={() => vm.removeConstraint(i)}
                  >
                    <MaterialIcons name="close" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {vm.errors.constraints && (
            <Text style={styles.fieldError}>{vm.errors.constraints}</Text>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            vm.isLoading && styles.buttonDisabled,
          ]}
          onPress={handleCreate}
          disabled={vm.isLoading}
          activeOpacity={0.8}
        >
          {vm.isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Create Event</Text>
          )}
        </TouchableOpacity>
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    flex: 1,
  },
  headerSpacer: {
    width: 72,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backArrow: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
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
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
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
    color: '#111827',
  },
  required: {
    color: '#EF4444',
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
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  fieldError: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 4,
  },
  imageUploadArea: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    gap: 6,
  },
  imageUploadText: {
    fontSize: 14,
    color: '#6B7280',
  },
  pickerField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerFieldText: {
    color: '#111827',
    fontSize: 16,
  },
  pickerPlaceholderText: {
    color: '#9CA3AF',
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
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  chipSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chipUsed: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    opacity: 0.6,
  },
  chipText: {
    fontSize: 14,
    color: '#374151',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  chipTextUsed: {
    color: '#6B7280',
  },
  showMoreBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  showMoreText: {
    fontSize: 13,
    color: '#111827',
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
  dateInputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  dateInputWithIcon: {
    paddingRight: 42,
  },
  timeInputWithIcon: {
    paddingRight: 42,
  },
  pickerIconButton: {
    position: 'absolute',
    right: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerWrapper: {
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 0,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  privacyOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  privacyOptionSelected: {
    backgroundColor: '#111827',
  },
  privacyOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  privacyOptionTextSelected: {
    color: '#FFFFFF',
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
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginTop: 8,
  },
  tagChipText: {
    fontSize: 13,
    color: '#111827',
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
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  constraintChipText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },
  constraintRemoveBtn: {
    padding: 6,
  },
  submitButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
