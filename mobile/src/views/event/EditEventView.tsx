import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import PointPickerMap from '@/components/events/PointPickerMap';
import RoutePointsEditor from '@/components/events/RoutePointsEditor';
import {
  CATEGORIES,
  CATEGORY_PREVIEW_COUNT,
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from '@/viewmodels/event/useCreateEventViewModel';
import {
  EditEventChangePreview,
  useEditEventViewModel,
} from '@/viewmodels/event/useEditEventViewModel';
import { useTheme, type Theme } from '@/theme';

interface EditEventViewProps {
  eventId: string;
}

function parseDateString(dateStr: string): Date {
  if (dateStr && dateStr.length === 10) {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const d = Number.parseInt(parts[0], 10);
      const m = Number.parseInt(parts[1], 10) - 1;
      const y = Number.parseInt(parts[2], 10);
      const parsed = new Date(y, m, d);
      if (
        !Number.isNaN(parsed.getTime()) &&
        parsed.getDate() === d &&
        parsed.getMonth() === m &&
        parsed.getFullYear() === y
      ) {
        return parsed;
      }
    }
  }
  return new Date();
}

function parseTimeString(timeStr: string): Date {
  const now = new Date();
  if (timeStr && timeStr.length === 5) {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const h = Number.parseInt(parts[0], 10);
      const m = Number.parseInt(parts[1], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        now.setHours(h, m, 0, 0);
      }
    }
  }
  return now;
}

function formatPickerDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}.${month}.${year}`;
}

function formatPickerTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getChangeFieldLabel(field: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    title: t('events.edit.fields.titleLabel'),
    description: t('events.edit.fields.descriptionLabel'),
    category_id: t('events.edit.fields.category'),
    location: t('events.edit.fields.locationOrRoute'),
    start_time: t('events.edit.fields.startTime'),
    end_time: t('events.edit.fields.endTime'),
    capacity: t('events.edit.fields.capacity'),
    constraints: t('events.edit.fields.requirements'),
  };
  return labels[field] ?? field.replace(/_/g, ' ');
}

function getEventVersionLabel(vm: ReturnType<typeof useEditEventViewModel>): string | null {
  const version =
    vm.event?.version_no ??
    vm.event?.viewer_context.latest_event_version ??
    null;
  return version == null ? null : `v${version}`;
}

export default function EditEventView({ eventId }: EditEventViewProps) {
  const vm = useEditEventViewModel(eventId);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | null>(null);
  const [activeTimePicker, setActiveTimePicker] = useState<'start' | 'end' | null>(null);
  const [pendingPreview, setPendingPreview] = useState<EditEventChangePreview | null>(null);

  const visibleCategories = useMemo(() => {
    if (vm.categoriesExpanded) return CATEGORIES;
    const preview = CATEGORIES.slice(0, CATEGORY_PREVIEW_COUNT);
    if (
      vm.formData.categoryId !== null &&
      !preview.some((category) => category.id === vm.formData.categoryId)
    ) {
      const selected = CATEGORIES.find((category) => category.id === vm.formData.categoryId);
      if (selected) return [...preview, selected];
    }
    return preview;
  }, [vm.categoriesExpanded, vm.formData.categoryId]);

  const getCurrentPickerDate = useCallback(() => {
    const dateStr = activeDatePicker === 'start' ? vm.formData.startDate : vm.formData.endDate;
    return parseDateString(dateStr);
  }, [activeDatePicker, vm.formData.endDate, vm.formData.startDate]);

  const getCurrentPickerTime = useCallback(() => {
    const timeStr = activeTimePicker === 'start' ? vm.formData.startTime : vm.formData.endTime;
    return parseTimeString(timeStr);
  }, [activeTimePicker, vm.formData.endTime, vm.formData.startTime]);

  const getMinimumDatePickerDate = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (activeDatePicker === 'end' && vm.formData.startDate?.length === 10) {
      const parsedStart = parseDateString(vm.formData.startDate);
      if (!Number.isNaN(parsedStart.getTime())) {
        parsedStart.setHours(0, 0, 0, 0);
        return parsedStart;
      }
    }
    return today;
  }, [activeDatePicker, vm.formData.startDate]);

  const toggleDatePicker = useCallback((target: 'start' | 'end') => {
    setActiveTimePicker(null);
    setActiveDatePicker((prev) => (prev === target ? null : target));
  }, []);

  const toggleTimePicker = useCallback((target: 'start' | 'end') => {
    setActiveDatePicker(null);
    setActiveTimePicker((prev) => (prev === target ? null : target));
  }, []);

  const handleDateValueChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (!selectedDate) {
        setActiveDatePicker(null);
        return;
      }

      if (activeDatePicker === 'start') {
        vm.updateField('startDate', formatPickerDate(selectedDate));
      } else if (activeDatePicker === 'end') {
        vm.updateField('endDate', formatPickerDate(selectedDate));
      }

      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        setActiveDatePicker(null);
      }
    },
    [activeDatePicker, vm],
  );

  const handleTimeValueChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (!selectedDate) {
        setActiveTimePicker(null);
        return;
      }

      if (activeTimePicker === 'start') {
        vm.updateField('startTime', formatPickerTime(selectedDate));
      } else if (activeTimePicker === 'end') {
        vm.updateField('endTime', formatPickerTime(selectedDate));
      }

      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        setActiveTimePicker(null);
      }
    },
    [activeTimePicker, vm],
  );

  const clearEndDateTime = useCallback(() => {
    vm.updateField('endDate', '');
    vm.updateField('endTime', '');
    setActiveDatePicker((prev) => (prev === 'end' ? null : prev));
    setActiveTimePicker((prev) => (prev === 'end' ? null : prev));
  }, [vm]);

  const submitPreview = useCallback(
    async (preview: EditEventChangePreview) => {
      setPendingPreview(null);
      const result = await vm.handleSubmit(preview.request);
      if (result) {
        router.replace(`/event/${eventId}` as Href);
      }
    },
    [eventId, vm],
  );

  const handleSavePress = useCallback(async () => {
    const preview = vm.previewChanges();
    if (!preview) return;
    if (preview.criticalChangeLabels.length > 0) {
      setPendingPreview(preview);
      return;
    }
    await submitPreview(preview);
  }, [submitPreview, vm]);

  const disabled = vm.isSaving || !vm.canEdit;
  const versionLabel = getEventVersionLabel(vm);

  if (vm.isLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.centeredScreen}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t('events.edit.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vm.event || !vm.canEdit) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.blockedContainer}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.back()}
            accessibilityLabel={t('common.back')}
          >
            <Feather name="arrow-left" size={22} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.blockedPanel}>
            <View style={styles.blockedIcon}>
              <Feather name="lock" size={28} color={theme.textSecondary} />
            </View>
            <Text style={styles.blockedTitle}>{t('events.edit.blockedTitle')}</Text>
            <Text style={styles.blockedText}>
              {vm.apiError ?? t('events.edit.blockedDescription')}
            </Text>
            {vm.event ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.replace(`/event/${eventId}` as Href)}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>{t('events.edit.viewEvent')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => void vm.retry()}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.back()}
              accessibilityLabel={t('common.back')}
            >
              <Feather name="arrow-left" size={22} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.screenTitle}>{t('events.edit.title')}</Text>
              <Text style={styles.screenSubtitle} numberOfLines={1}>
                {vm.event.title}
              </Text>
            </View>
            {versionLabel ? (
              <View style={styles.versionPill}>
                <Text style={styles.versionPillText}>{versionLabel}</Text>
              </View>
            ) : null}
          </View>

          {vm.apiError ? (
            <View style={styles.errorBanner} testID="edit-event-error">
              <Feather name="alert-circle" size={16} color={theme.errorText} />
              <Text style={styles.errorBannerText}>{vm.apiError}</Text>
            </View>
          ) : null}

          {vm.successMessage ? (
            <View style={styles.successBanner}>
              <Feather name="check-circle" size={16} color={theme.successText} />
              <Text style={styles.successBannerText}>{vm.successMessage}</Text>
            </View>
          ) : null}

          <View style={styles.warningBanner}>
            <Feather name="alert-triangle" size={16} color={theme.warningText} />
            <Text style={styles.warningBannerText}>
              {t('events.edit.warning')}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('events.edit.sections.basics')}</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('events.edit.fields.titleLabel')}</Text>
              <TextInput
                style={[styles.input, vm.errors.title && styles.inputError]}
                value={vm.formData.title}
                onChangeText={(value) => vm.updateField('title', value)}
                placeholder={t('events.edit.fields.titlePlaceholder')}
                placeholderTextColor={theme.placeholder}
                maxLength={TITLE_MAX_LENGTH}
                editable={!disabled}
              />
              {vm.errors.title ? <Text style={styles.fieldError}>{vm.errors.title}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('events.edit.fields.descriptionLabel')}</Text>
              <TextInput
                style={[styles.input, styles.textArea, vm.errors.description && styles.inputError]}
                value={vm.formData.description}
                onChangeText={(value) => vm.updateField('description', value)}
                placeholder={t('events.edit.fields.descriptionPlaceholder')}
                placeholderTextColor={theme.placeholder}
                maxLength={DESCRIPTION_MAX_LENGTH}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!disabled}
              />
              {vm.errors.description ? (
                <Text style={styles.fieldError}>{vm.errors.description}</Text>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('events.edit.fields.category')}</Text>
              <View style={styles.chipRow}>
                {visibleCategories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.chip,
                      vm.formData.categoryId === category.id && styles.chipSelected,
                    ]}
                    onPress={() => vm.updateField('categoryId', category.id)}
                    disabled={disabled}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        vm.formData.categoryId === category.id && styles.chipTextSelected,
                      ]}
                    >
                      {t(`events.categories.${category.name}`, { defaultValue: category.name })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {CATEGORIES.length > CATEGORY_PREVIEW_COUNT ? (
                <TouchableOpacity
                  style={styles.inlineAction}
                  onPress={vm.toggleCategoriesExpanded}
                  disabled={disabled}
                >
                  <Text style={styles.inlineActionText}>
                    {vm.categoriesExpanded ? t('events.create.showLess') : t('events.create.showMore')}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {vm.errors.categoryId ? (
                <Text style={styles.fieldError}>{vm.errors.categoryId}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('events.edit.sections.location')}</Text>

            <View style={styles.segmentedControl} testID="edit-location-type-toggle">
              <TouchableOpacity
                style={[
                  styles.segmentOption,
                  vm.formData.locationType === 'POINT' && styles.segmentOptionActive,
                ]}
                onPress={() => vm.setLocationType('POINT')}
                disabled={disabled}
                activeOpacity={0.85}
              >
                <Feather
                  name="map-pin"
                  size={15}
                  color={vm.formData.locationType === 'POINT' ? theme.textOnPrimary : theme.text}
                />
                <Text
                  style={[
                    styles.segmentOptionText,
                    vm.formData.locationType === 'POINT' && styles.segmentOptionTextActive,
                  ]}
                >
                  {t('events.edit.fields.locationTypePoint')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentOption,
                  vm.formData.locationType === 'ROUTE' && styles.segmentOptionActive,
                ]}
                onPress={() => vm.setLocationType('ROUTE')}
                disabled={disabled}
                activeOpacity={0.85}
              >
                <Feather
                  name="navigation"
                  size={15}
                  color={vm.formData.locationType === 'ROUTE' ? theme.textOnPrimary : theme.text}
                />
                <Text
                  style={[
                    styles.segmentOptionText,
                    vm.formData.locationType === 'ROUTE' && styles.segmentOptionTextActive,
                  ]}
                >
                  {t('events.edit.fields.locationTypeRoute')}
                </Text>
              </TouchableOpacity>
            </View>

            {vm.formData.locationType === 'POINT' ? (
              <>
                <View style={styles.locationInputRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.locationInput,
                      vm.errors.location && styles.inputError,
                    ]}
                    value={vm.formData.locationQuery}
                    onChangeText={vm.handleLocationSearch}
                    placeholder={t('events.edit.fields.locationSearchPlaceholder')}
                    placeholderTextColor={theme.placeholder}
                    editable={!disabled}
                  />
                  {vm.formData.lat !== null ? (
                    <TouchableOpacity
                      style={styles.clearLocationButton}
                      onPress={vm.clearLocation}
                      disabled={disabled}
                      accessibilityLabel={t('events.edit.fields.clearLocation')}
                    >
                      <Feather name="x" size={18} color={theme.text} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {vm.isSearchingLocation ? (
                  <ActivityIndicator size="small" color={theme.text} style={styles.searchSpinner} />
                ) : null}
                {vm.locationSuggestions.length > 0 ? (
                  <View style={styles.suggestionsContainer}>
                    {vm.locationSuggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                        style={styles.suggestionItem}
                        onPress={() => vm.selectLocation(suggestion)}
                        disabled={disabled}
                      >
                        <Text style={styles.suggestionText} numberOfLines={2}>
                          {suggestion.display_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <View style={styles.mapWrapper}>
                  <PointPickerMap
                    lat={vm.formData.lat}
                    lon={vm.formData.lon}
                    disabled={disabled}
                    onSelect={vm.setPointFromCoordinate}
                  />
                </View>
                {vm.errors.location ? (
                  <Text style={styles.fieldError}>{vm.errors.location}</Text>
                ) : null}
              </>
            ) : (
              <RoutePointsEditor
                routePoints={vm.formData.routePoints}
                locationQuery={vm.formData.locationQuery}
                isSearching={vm.isSearchingLocation}
                suggestions={vm.locationSuggestions}
                errorText={vm.errors.location}
                disabled={disabled}
                onSearch={vm.handleLocationSearch}
                onAddFromSuggestion={vm.addRoutePointFromSuggestion}
                onAddFromCoordinate={vm.addRoutePointFromCoordinate}
                onRemove={vm.removeRoutePoint}
                onMove={vm.moveRoutePoint}
                onUpdateLabel={vm.updateRoutePointLabel}
              />
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('events.edit.sections.schedule')}</Text>
            <View style={styles.dateTimeRow}>
              <View style={styles.dateCol}>
                <Text style={styles.label}>{t('events.edit.fields.startDate')}</Text>
                <TouchableOpacity
                  style={[
                    styles.input,
                    styles.pickerField,
                    vm.errors.startDate && styles.inputError,
                  ]}
                  onPress={() => toggleDatePicker('start')}
                  disabled={disabled}
                  accessibilityLabel={t('events.edit.fields.pickStartDate')}
                >
                  <Text
                    style={[
                      styles.pickerFieldText,
                      !vm.formData.startDate && styles.pickerPlaceholderText,
                    ]}
                  >
                    {vm.formData.startDate || t('events.create.fields.selectDate')}
                  </Text>
                  <MaterialIcons name="event" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                {vm.errors.startDate ? (
                  <Text style={styles.fieldError}>{vm.errors.startDate}</Text>
                ) : null}
              </View>

              <View style={styles.timeCol}>
                <Text style={styles.label}>{t('events.edit.fields.startTime')}</Text>
                <TouchableOpacity
                  style={[
                    styles.input,
                    styles.pickerField,
                    vm.errors.startTime && styles.inputError,
                  ]}
                  onPress={() => toggleTimePicker('start')}
                  disabled={disabled}
                  accessibilityLabel={t('events.edit.fields.pickStartTime')}
                >
                  <Text
                    style={[
                      styles.pickerFieldText,
                      !vm.formData.startTime && styles.pickerPlaceholderText,
                    ]}
                  >
                    {vm.formData.startTime || t('events.edit.fields.timePlaceholder')}
                  </Text>
                  <MaterialIcons name="schedule" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                {vm.errors.startTime ? (
                  <Text style={styles.fieldError}>{vm.errors.startTime}</Text>
                ) : null}
              </View>
            </View>

            {activeDatePicker === 'start' ? (
              <View style={styles.datePickerWrapper}>
                <DateTimePicker
                  value={getCurrentPickerDate()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={getMinimumDatePickerDate()}
                  onChange={handleDateValueChange}
                />
              </View>
            ) : null}
            {activeTimePicker === 'start' ? (
              <View style={styles.datePickerWrapper}>
                <DateTimePicker
                  value={getCurrentPickerTime()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  is24Hour
                  onChange={handleTimeValueChange}
                />
              </View>
            ) : null}

            <View style={styles.inlineLabelRow}>
              <Text style={styles.label}>{t('events.edit.fields.end')}</Text>
              {vm.formData.endDate || vm.formData.endTime ? (
                <TouchableOpacity onPress={clearEndDateTime} disabled={disabled}>
                  <Text style={styles.inlineActionText}>{t('events.edit.fields.clear')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.dateTimeRow}>
              <View style={styles.dateCol}>
                <TouchableOpacity
                  style={[
                    styles.input,
                    styles.pickerField,
                    vm.errors.endDate && styles.inputError,
                  ]}
                  onPress={() => toggleDatePicker('end')}
                  disabled={disabled}
                  accessibilityLabel={t('events.edit.fields.pickEndDate')}
                >
                  <Text
                    style={[
                      styles.pickerFieldText,
                      !vm.formData.endDate && styles.pickerPlaceholderText,
                    ]}
                  >
                    {vm.formData.endDate || t('events.create.fields.selectDate')}
                  </Text>
                  <MaterialIcons name="event" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                {vm.errors.endDate ? (
                  <Text style={styles.fieldError}>{vm.errors.endDate}</Text>
                ) : null}
              </View>

              <View style={styles.timeCol}>
                <TouchableOpacity
                  style={[
                    styles.input,
                    styles.pickerField,
                    vm.errors.endTime && styles.inputError,
                  ]}
                  onPress={() => toggleTimePicker('end')}
                  disabled={disabled}
                  accessibilityLabel={t('events.edit.fields.pickEndTime')}
                >
                  <Text
                    style={[
                      styles.pickerFieldText,
                      !vm.formData.endTime && styles.pickerPlaceholderText,
                    ]}
                  >
                    {vm.formData.endTime || t('events.edit.fields.timePlaceholder')}
                  </Text>
                  <MaterialIcons name="schedule" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                {vm.errors.endTime ? (
                  <Text style={styles.fieldError}>{vm.errors.endTime}</Text>
                ) : null}
              </View>
            </View>

            {activeDatePicker === 'end' ? (
              <View style={styles.datePickerWrapper}>
                <DateTimePicker
                  value={getCurrentPickerDate()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={getMinimumDatePickerDate()}
                  onChange={handleDateValueChange}
                />
              </View>
            ) : null}
            {activeTimePicker === 'end' ? (
              <View style={styles.datePickerWrapper}>
                <DateTimePicker
                  value={getCurrentPickerTime()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  is24Hour
                  onChange={handleTimeValueChange}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('events.edit.sections.participation')}</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('events.edit.fields.capacity')}</Text>
              <TextInput
                style={[styles.input, vm.errors.constraints && styles.inputError]}
                value={vm.formData.capacityInput}
                onChangeText={(value) => vm.updateField('capacityInput', value)}
                placeholder={t('events.edit.fields.unlimited')}
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
                editable={!disabled}
              />
              <Text style={styles.helperText}>
                {t('events.edit.currentParticipants', {
                  count: vm.event.approved_participant_count + vm.event.pending_participant_count,
                })}
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('events.edit.fields.requirements')}</Text>
              {vm.formData.constraints.length > 0 ? (
                <View style={styles.constraintList}>
                  {vm.formData.constraints.map((constraint, index) => (
                    <View key={`${constraint.type}-${constraint.info}-${index}`} style={styles.constraintRow}>
                      <View style={styles.constraintCopy}>
                        <Text style={styles.constraintType}>{constraint.type}</Text>
                        <Text style={styles.constraintInfo}>{constraint.info}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.constraintRemoveButton}
                        onPress={() => vm.removeConstraint(index)}
                        disabled={disabled}
                        accessibilityLabel={t('events.edit.fields.removeRequirement')}
                      >
                        <Feather name="trash-2" size={16} color={theme.errorText} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyRequirement}>
                  <Text style={styles.emptyRequirementText}>{t('events.edit.noRequirements')}</Text>
                </View>
              )}

              <View style={styles.requirementDraft}>
                <TextInput
                  style={[styles.input, styles.requirementTypeInput]}
                  value={vm.constraintDraftType}
                  onChangeText={vm.updateConstraintDraftType}
                  placeholder={t('events.edit.fields.requirementType')}
                  placeholderTextColor={theme.placeholder}
                  editable={!disabled}
                />
                <TextInput
                  style={[styles.input, styles.requirementInfoInput]}
                  value={vm.constraintDraftInfo}
                  onChangeText={vm.updateConstraintDraftInfo}
                  placeholder={t('events.edit.fields.requirementDetails')}
                  placeholderTextColor={theme.placeholder}
                  editable={!disabled}
                />
                <TouchableOpacity
                  style={[
                    styles.addRequirementButton,
                    (!vm.constraintDraftType.trim() || !vm.constraintDraftInfo.trim()) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={vm.addConstraint}
                  disabled={
                    disabled ||
                    !vm.constraintDraftType.trim() ||
                    !vm.constraintDraftInfo.trim()
                  }
                  accessibilityLabel={t('events.edit.fields.addRequirement')}
                >
                  <Feather name="plus" size={20} color={theme.textOnPrimary} />
                </TouchableOpacity>
              </View>
              {vm.errors.constraints ? (
                <Text style={styles.fieldError}>{vm.errors.constraints}</Text>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, (vm.isSaving || !vm.canEdit) && styles.buttonDisabled]}
            onPress={handleSavePress}
            disabled={vm.isSaving || !vm.canEdit}
            activeOpacity={0.88}
            testID="edit-event-save-button"
          >
            {vm.isSaving ? (
              <ActivityIndicator size="small" color={theme.textOnPrimary} />
            ) : (
              <>
                <Feather name="save" size={18} color={theme.textOnPrimary} />
                <Text style={styles.saveButtonText}>{t('events.edit.saveChanges')}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={pendingPreview !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingPreview(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmSheet} testID="edit-event-confirmation">
            <View style={styles.confirmIcon}>
              <Feather name="alert-triangle" size={24} color={theme.warningText} />
            </View>
            <Text style={styles.confirmTitle}>{t('events.edit.confirmTitle')}</Text>
            <Text style={styles.confirmBody}>
              {t('events.edit.confirmBody')}
            </Text>

            {pendingPreview ? (
              <View style={styles.confirmChangeList}>
                {pendingPreview.criticalChangeLabels.map((label) => (
                  <View key={label} style={styles.criticalChangeRow}>
                    <Feather name="alert-circle" size={15} color={theme.warningText} />
                    <Text style={styles.criticalChangeText}>{label}</Text>
                  </View>
                ))}
                <View style={styles.changedFieldPills}>
                  {pendingPreview.changedFields.map((field) => (
                    <View key={field} style={styles.changedFieldPill}>
                      <Text style={styles.changedFieldPillText}>
                        {getChangeFieldLabel(field, t)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelConfirmButton}
                onPress={() => setPendingPreview(null)}
                disabled={vm.isSaving}
              >
                <Text style={styles.cancelConfirmText}>{t('events.edit.keepEditing')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmSaveButton, vm.isSaving && styles.buttonDisabled]}
                onPress={() => pendingPreview && void submitPreview(pendingPreview)}
                disabled={vm.isSaving}
              >
                {vm.isSaving ? (
                  <ActivityIndicator size="small" color={theme.textOnPrimary} />
                ) : (
                  <Text style={styles.confirmSaveText}>{t('events.edit.saveAnyway')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    centeredScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 24,
    },
    loadingText: {
      fontSize: 14,
      color: t.textSecondary,
      fontWeight: '600',
    },
    blockedContainer: {
      flex: 1,
      padding: 24,
    },
    blockedPanel: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
    },
    blockedIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
    },
    blockedTitle: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '800',
      color: t.text,
      textAlign: 'center',
    },
    blockedText: {
      fontSize: 15,
      lineHeight: 22,
      color: t.textSecondary,
      textAlign: 'center',
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
    },
    headerCopy: {
      flex: 1,
    },
    screenTitle: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
      color: t.text,
    },
    screenSubtitle: {
      marginTop: 2,
      fontSize: 13,
      lineHeight: 18,
      color: t.textSecondary,
      fontWeight: '600',
    },
    versionPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: t.surfaceAlt,
      borderWidth: 1,
      borderColor: t.border,
    },
    versionPillText: {
      fontSize: 12,
      fontWeight: '800',
      color: t.textSecondary,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 12,
      borderRadius: 8,
      backgroundColor: t.errorBg,
      borderWidth: 1,
      borderColor: t.errorBorder,
    },
    errorBannerText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: t.errorText,
      fontWeight: '600',
    },
    successBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 12,
      borderRadius: 8,
      backgroundColor: t.successBg,
      borderWidth: 1,
      borderColor: t.successBorder,
    },
    successBannerText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: t.successText,
      fontWeight: '700',
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 12,
      borderRadius: 8,
      backgroundColor: t.warningBg,
      borderWidth: 1,
      borderColor: t.warningBorder,
    },
    warningBannerText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: t.warningText,
      fontWeight: '600',
    },
    section: {
      gap: 14,
      paddingTop: 4,
    },
    sectionTitle: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '800',
      color: t.text,
    },
    fieldGroup: {
      gap: 7,
    },
    label: {
      fontSize: 13,
      lineHeight: 18,
      color: t.textSecondary,
      fontWeight: '800',
    },
    input: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 8,
      paddingHorizontal: 13,
      paddingVertical: 11,
      fontSize: 16,
      color: t.text,
      backgroundColor: t.surface,
    },
    inputError: {
      borderColor: t.errorText,
      backgroundColor: t.errorBg,
    },
    textArea: {
      minHeight: 104,
      paddingTop: 12,
    },
    fieldError: {
      color: t.errorText,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    helperText: {
      fontSize: 12,
      lineHeight: 17,
      color: t.textTertiary,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    chipSelected: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    chipText: {
      color: t.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    chipTextSelected: {
      color: t.textOnPrimary,
    },
    inlineAction: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    inlineActionText: {
      color: t.primary,
      fontSize: 13,
      fontWeight: '800',
    },
    segmentedControl: {
      flexDirection: 'row',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceAlt,
      padding: 3,
    },
    segmentOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 6,
    },
    segmentOptionActive: {
      backgroundColor: t.primary,
    },
    segmentOptionText: {
      fontSize: 13,
      fontWeight: '800',
      color: t.text,
    },
    segmentOptionTextActive: {
      color: t.textOnPrimary,
    },
    locationInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    locationInput: {
      flex: 1,
    },
    clearLocationButton: {
      width: 44,
      height: 44,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
    },
    searchSpinner: {
      marginTop: 8,
    },
    suggestionsContainer: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 8,
      backgroundColor: t.surface,
      overflow: 'hidden',
    },
    suggestionItem: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    suggestionText: {
      fontSize: 14,
      lineHeight: 19,
      color: t.text,
    },
    mapWrapper: {
      marginTop: 4,
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    dateCol: {
      flex: 3,
    },
    timeCol: {
      flex: 2,
    },
    pickerField: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    pickerFieldText: {
      flex: 1,
      color: t.text,
      fontSize: 15,
      fontWeight: '600',
    },
    pickerPlaceholderText: {
      color: t.placeholder,
    },
    datePickerWrapper: {
      alignItems: 'center',
      backgroundColor: t.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.border,
    },
    inlineLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    constraintList: {
      gap: 8,
    },
    constraintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
    },
    constraintCopy: {
      flex: 1,
      gap: 2,
    },
    constraintType: {
      fontSize: 12,
      lineHeight: 16,
      color: t.textMuted,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    constraintInfo: {
      fontSize: 14,
      lineHeight: 20,
      color: t.text,
      fontWeight: '600',
    },
    constraintRemoveButton: {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.errorBg,
    },
    emptyRequirement: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: t.border,
      backgroundColor: t.surfaceAlt,
    },
    emptyRequirementText: {
      fontSize: 13,
      color: t.textSecondary,
      fontWeight: '600',
    },
    requirementDraft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    requirementTypeInput: {
      flex: 1,
    },
    requirementInfoInput: {
      flex: 2,
    },
    addRequirementButton: {
      width: 44,
      height: 44,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.primary,
    },
    saveButton: {
      minHeight: 50,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      backgroundColor: t.primary,
      marginTop: 8,
    },
    saveButtonText: {
      color: t.textOnPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    primaryButton: {
      minHeight: 48,
      paddingHorizontal: 18,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.primary,
      marginTop: 8,
    },
    primaryButtonText: {
      color: t.textOnPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    buttonDisabled: {
      opacity: 0.55,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: t.overlay,
      justifyContent: 'flex-end',
      padding: 16,
    },
    confirmSheet: {
      borderRadius: 8,
      backgroundColor: t.surface,
      padding: 18,
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    confirmIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.warningBg,
      borderWidth: 1,
      borderColor: t.warningBorder,
    },
    confirmTitle: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '800',
      color: t.text,
    },
    confirmBody: {
      fontSize: 14,
      lineHeight: 21,
      color: t.textSecondary,
      fontWeight: '600',
    },
    confirmChangeList: {
      gap: 10,
    },
    criticalChangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: t.warningBg,
      borderWidth: 1,
      borderColor: t.warningBorder,
    },
    criticalChangeText: {
      flex: 1,
      color: t.warningText,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '800',
    },
    changedFieldPills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    changedFieldPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: t.infoBg,
      borderWidth: 1,
      borderColor: t.infoBorder,
    },
    changedFieldPillText: {
      color: t.infoText,
      fontSize: 12,
      fontWeight: '800',
    },
    confirmActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    cancelConfirmButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    cancelConfirmText: {
      color: t.text,
      fontSize: 14,
      fontWeight: '800',
    },
    confirmSaveButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.primary,
    },
    confirmSaveText: {
      color: t.textOnPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
  });
}
