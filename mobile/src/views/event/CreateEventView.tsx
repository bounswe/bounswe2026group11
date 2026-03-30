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
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useLogoutViewModel } from '@/viewmodels/auth/useLogoutViewModel';
import {
  useCreateEventViewModel,
  CATEGORIES,
  CATEGORY_PREVIEW_COUNT,
  PRIVACY_OPTIONS,
  CONSTRAINT_TYPES,
  CONSTRAINT_TYPE_LIMITS,
  ConstraintType,
  formatTimeInput,
  formatDateInput,
  TITLE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from '@/viewmodels/event/useCreateEventViewModel';

export default function CreateEventView() {
  const vm = useCreateEventViewModel();
  const { token, refreshToken, clearAuth } = useAuth();
  const { isLoggingOut, logoutError, handleLogout } = useLogoutViewModel(
    refreshToken,
    () => {
      clearAuth();
      router.replace('/' as Href);
    },
  );

  const handleCreate = async () => {
    await vm.handleSubmit(token ?? '');
  };

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
          <TouchableOpacity
            onPress={handleLogout}
            disabled={isLoggingOut || vm.isLoading}
            style={styles.logoutButton}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Text style={styles.logoutText}>Logout</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Error Banner */}
        {logoutError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{logoutError}</Text>
          </View>
        )}

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

        {/* Image */}
        <View style={styles.fieldGroup}>
          <TouchableOpacity style={styles.imageUploadArea}>
            <MaterialIcons name="add-photo-alternate" size={36} color="#9CA3AF" />
            <Text style={styles.imageUploadText}>Add Event Image</Text>
          </TouchableOpacity>
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
            <ActivityIndicator size="small" color="#2563EB" style={styles.searchSpinner} />
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
              <TextInput
                style={[
                  styles.input,
                  vm.errors.startDateTime && styles.inputError,
                ]}
                placeholder="dd.mm.yyyy"
                placeholderTextColor="#9CA3AF"
                value={vm.formData.startDate}
                onChangeText={(v) =>
                  vm.updateField('startDate', formatDateInput(v, vm.formData.startDate))
                }
                keyboardType="numbers-and-punctuation"
                editable={!vm.isLoading}
              />
            </View>
            <View style={styles.dateTimeColSmall}>
              <Text style={styles.label}>{' '}</Text>
              <TextInput
                style={[
                  styles.input,
                  vm.errors.startDateTime && styles.inputError,
                ]}
                placeholder="HH:mm"
                placeholderTextColor="#9CA3AF"
                value={vm.formData.startTime}
                onChangeText={(v) => vm.updateField('startTime', formatTimeInput(v, vm.formData.startTime))}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                editable={!vm.isLoading}
              />
            </View>
          </View>
          {vm.errors.startDateTime && (
            <Text style={styles.fieldError}>{vm.errors.startDateTime}</Text>
          )}
        </View>

        {/* End Date/Time */}
        <View style={styles.fieldGroup}>
          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeCol}>
              <Text style={styles.label}>End</Text>
              <TextInput
                style={[
                  styles.input,
                  vm.errors.endDateTime && styles.inputError,
                ]}
                placeholder="dd.mm.yyyy"
                placeholderTextColor="#9CA3AF"
                value={vm.formData.endDate}
                onChangeText={(v) =>
                  vm.updateField('endDate', formatDateInput(v, vm.formData.endDate))
                }
                keyboardType="numbers-and-punctuation"
                editable={!vm.isLoading}
              />
            </View>
            <View style={styles.dateTimeColSmall}>
              <Text style={styles.label}>{' '}</Text>
              <TextInput
                style={[
                  styles.input,
                  vm.errors.endDateTime && styles.inputError,
                ]}
                placeholder="HH:mm"
                placeholderTextColor="#9CA3AF"
                value={vm.formData.endTime}
                onChangeText={(v) => vm.updateField('endTime', formatTimeInput(v, vm.formData.endTime))}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                editable={!vm.isLoading}
              />
            </View>
          </View>
          {vm.errors.endDateTime && (
            <Text style={styles.fieldError}>{vm.errors.endDateTime}</Text>
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
            (vm.isLoading || isLoggingOut) && styles.buttonDisabled,
          ]}
          onPress={handleCreate}
          disabled={vm.isLoading || isLoggingOut}
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
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  logoutButton: {
    minWidth: 72,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingLeft: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
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
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipUsed: {
    backgroundColor: '#E0E7FF',
    borderColor: '#A5B4FC',
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
    color: '#4338CA',
  },
  showMoreBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  showMoreText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '500',
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
    backgroundColor: '#2563EB',
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
    backgroundColor: '#2563EB',
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
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 8,
  },
  tagChipText: {
    fontSize: 13,
    color: '#2563EB',
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
    backgroundColor: '#2563EB',
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
