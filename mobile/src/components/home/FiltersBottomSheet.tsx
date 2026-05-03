import React, { useCallback, useEffect, useRef, useState } from 'react';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  DiscoverEventsSortBy,
  EventCategory,
  HomeFilterPrivacyLevel,
  HomeFiltersDraft,
} from '@/models/event';

interface FiltersBottomSheetProps {
  visible: boolean;
  categories: readonly EventCategory[];
  draftFilters: HomeFiltersDraft;
  errorMessage?: string | null;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  onToggleCategory: (categoryId: number) => void;
  onTogglePrivacy: (privacy: HomeFilterPrivacyLevel) => void;
  onChangeStartDate: (value: string) => void;
  onChangeEndDate: (value: string) => void;
  onChangeRadius: (value: number) => void;
  onChangeSortBy: (
    value: Extract<DiscoverEventsSortBy, 'START_TIME' | 'DISTANCE'>,
  ) => void;
}

const CATEGORY_PREVIEW_COUNT = 6;
const SWIPE_CLOSE_THRESHOLD = 80;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SORT_OPTIONS: Array<{
  label: string;
  value: Extract<DiscoverEventsSortBy, 'START_TIME' | 'DISTANCE'>;
}> = [
  { label: 'Soonest', value: 'START_TIME' },
  { label: 'Nearest', value: 'DISTANCE' },
];

function formatDigitsToDate(digits: string): string {
  if (digits.length === 0) return '';
  const day = digits.slice(0, 2);
  if (digits.length <= 2) return day;
  const month = digits.slice(2, 4);
  if (digits.length <= 4) return `${day}.${month}`;
  const year = digits.slice(4, 8);
  return `${day}.${month}.${year}`;
}

function formatDateInput(current: string, previous: string): string {
  const digits = current.replace(/\D/g, '');
  const prevDigits = previous.replace(/\D/g, '');

  if (digits.length < prevDigits.length) {
    return formatDigitsToDate(digits);
  }

  return formatDigitsToDate(digits.slice(0, 8));
}

export default function FiltersBottomSheet({
  visible,
  categories,
  draftFilters,
  errorMessage,
  onClose,
  onReset,
  onApply,
  onToggleCategory,
  onTogglePrivacy,
  onChangeStartDate,
  onChangeEndDate,
  onChangeRadius,
  onChangeSortBy,
}: FiltersBottomSheetProps) {
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(
    null,
  );

  // Start off-screen so the sheet is hidden when Modal first mounts
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const animateClose = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [onClose, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        gestureState.dy > 10,
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy > SWIPE_CLOSE_THRESHOLD) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
          }).start();
        }
      },
    }),
  ).current;

  // Slide up when opening, reset state
  useEffect(() => {
    if (visible) {
      setCategoriesExpanded(false);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  const getCurrentPickerDate = useCallback(() => {
    const today = new Date();
    const targetText =
      activePicker === 'start' ? draftFilters.startDate : draftFilters.endDate;

    if (targetText && targetText.length === 10) {
      const parts = targetText.split('.');
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
    return today;
  }, [activePicker, draftFilters.startDate, draftFilters.endDate]);

  const handleValueChange = useCallback(
    (event: any, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setActivePicker(null);
      }
      if (!selectedDate) return;

      const prevDate = getCurrentPickerDate();
      
      const currentYear = prevDate.getFullYear();
      const currentMonth = prevDate.getMonth();
      const currentDay = prevDate.getDate();

      const newYear = selectedDate.getFullYear();
      const newMonth = selectedDate.getMonth();
      const newDay = selectedDate.getDate();

      const dayChanged = newDay !== currentDay;
      const monthChanged = newMonth !== currentMonth;
      const yearChanged = newYear !== currentYear;
      
      // Only close automatically if the user just tapped a different day in the current month.
      // If month or year changed (either via swipe or the month/year scroll wheel), leave it open.
      const onlyDayChanged = dayChanged && !monthChanged && !yearChanged;

      const day = String(newDay).padStart(2, '0');
      const month = String(newMonth + 1).padStart(2, '0');
      const year = String(newYear);
      const formatted = `${day}.${month}.${year}`;

      if (activePicker === 'start') {
        onChangeStartDate(formatted);
      } else if (activePicker === 'end') {
        onChangeEndDate(formatted);
      }

      if (Platform.OS === 'ios' && onlyDayChanged) {
        setActivePicker(null);
      }
    },
    [activePicker, onChangeStartDate, onChangeEndDate, getCurrentPickerDate],
  );

  const handleDismiss = useCallback(() => {
    setActivePicker(null);
  }, []);

  const getMinimumDatePickerDate = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (activePicker === 'end' && draftFilters.startDate?.length === 10) {
      const parts = draftFilters.startDate.split('.');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const parsedStartDate = new Date(y, m, d);
        if (!isNaN(parsedStartDate.getTime()) && parsedStartDate >= today) {
          return parsedStartDate;
        }
      }
    }
    return today;
  }, [activePicker, draftFilters.startDate]);



  const isPrivacySelected = (value: HomeFilterPrivacyLevel) =>
    draftFilters.privacyLevels.includes(value);

  const visibleCategories = categoriesExpanded
    ? categories
    : categories.slice(0, CATEGORY_PREVIEW_COUNT);

  const fromError = errorMessage?.startsWith('From') ? errorMessage : null;
  const toError = errorMessage?.startsWith('To') ? errorMessage : null;
  const generalError =
    errorMessage && !fromError && !toError ? errorMessage : null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={animateClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY }] }]}
          >
            {/* Drag handle area – swipe down to close */}
            <View {...panResponder.panHandlers} style={styles.handleZone}>
              <View style={styles.handle} />
            </View>

            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={animateClose}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Close filters"
              >
                <Feather name="x" size={28} color="#111827" />
              </TouchableOpacity>

              <Text style={styles.title}>Filters</Text>

              <TouchableOpacity
                onPress={onReset}
                activeOpacity={0.85}
                style={styles.resetButton}
                accessibilityRole="button"
                accessibilityLabel="Reset filters"
              >
                <Feather name="rotate-ccw" size={18} color="#111827" />
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sectionTitle}>Sort by</Text>
              <View style={styles.row}>
                {SORT_OPTIONS.map((option) => {
                  const isSelected = draftFilters.sortBy === option.value;

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        isSelected && styles.selectedOptionButton,
                      ]}
                      onPress={() => onChangeSortBy(option.value)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          isSelected && styles.selectedOptionButtonText,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>Categories</Text>
              <View style={styles.categoryWrap}>
                {visibleCategories.map((category) => {
                  const isSelected = draftFilters.categoryIds.includes(category.id);

                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.selectedChip,
                      ]}
                      onPress={() => onToggleCategory(category.id)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.selectedChipText,
                        ]}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {categories.length > CATEGORY_PREVIEW_COUNT ? (
                <TouchableOpacity
                  onPress={() => setCategoriesExpanded((prev) => !prev)}
                  activeOpacity={0.8}
                  style={styles.showMoreButton}
                >
                  <Text style={styles.showMoreText}>
                    {categoriesExpanded ? 'Show less' : 'Show more'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <Text style={styles.sectionTitle}>Privacy Level</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    isPrivacySelected('PUBLIC') && styles.selectedOptionButton,
                  ]}
                  onPress={() => onTogglePrivacy('PUBLIC')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      isPrivacySelected('PUBLIC') &&
                        styles.selectedOptionButtonText,
                    ]}
                  >
                    Public
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    isPrivacySelected('PROTECTED') &&
                      styles.selectedOptionButton,
                  ]}
                  onPress={() => onTogglePrivacy('PROTECTED')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      isPrivacySelected('PROTECTED') &&
                        styles.selectedOptionButtonText,
                    ]}
                  >
                    Protected
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>Date Range</Text>
              <View style={styles.row}>
                <View style={styles.dateColumn}>
                  <Text
                    style={[
                      styles.inputLabel,
                      fromError && styles.inputLabelError,
                    ]}
                  >
                    From
                  </Text>
                  <View style={styles.dateInputContainer}>
                    <TextInput
                      style={[
                        styles.dateInput,
                        fromError && styles.dateInputError,
                      ]}
                      placeholder="dd.mm.yyyy"
                      placeholderTextColor="#9CA3AF"
                      value={draftFilters.startDate}
                      onChangeText={(value) =>
                        onChangeStartDate(
                          formatDateInput(value, draftFilters.startDate),
                        )
                      }
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                    <TouchableOpacity
                      style={styles.calendarIconInside}
                      onPress={() =>
                        setActivePicker((prev) =>
                          prev === 'start' ? null : 'start',
                        )
                      }
                      activeOpacity={0.7}
                      accessibilityLabel="Pick start date"
                    >
                      <Feather name="calendar" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  {fromError ? (
                    <Text style={styles.fieldErrorText}>{fromError}</Text>
                  ) : null}
                </View>

                <View style={styles.dateColumn}>
                  <Text
                    style={[
                      styles.inputLabel,
                      toError && styles.inputLabelError,
                    ]}
                  >
                    To
                  </Text>
                  <View style={styles.dateInputContainer}>
                    <TextInput
                      style={[
                        styles.dateInput,
                        toError && styles.dateInputError,
                      ]}
                      placeholder="dd.mm.yyyy"
                      placeholderTextColor="#9CA3AF"
                      value={draftFilters.endDate}
                      onChangeText={(value) =>
                        onChangeEndDate(
                          formatDateInput(value, draftFilters.endDate),
                        )
                      }
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                    <TouchableOpacity
                      style={styles.calendarIconInside}
                      onPress={() =>
                        setActivePicker((prev) =>
                          prev === 'end' ? null : 'end',
                        )
                      }
                      activeOpacity={0.7}
                      accessibilityLabel="Pick end date"
                    >
                      <Feather name="calendar" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  {toError ? (
                    <Text style={styles.fieldErrorText}>{toError}</Text>
                  ) : null}
                </View>
              </View>

              {activePicker != null ? (
                <View style={styles.datePickerWrapper}>
                  <DateTimePicker
                    value={getCurrentPickerDate()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={getMinimumDatePickerDate()}
                    onChange={handleValueChange}
                  />
                </View>
              ) : null}

              <View style={styles.radiusHeader}>
                <Text style={styles.sectionTitle}>Distance Radius</Text>
                <Text style={styles.radiusValue}>{draftFilters.radiusKm} km</Text>
              </View>

              <Slider
                minimumValue={1}
                maximumValue={50}
                step={1}
                value={draftFilters.radiusKm}
                onValueChange={onChangeRadius}
                minimumTrackTintColor="#111827"
                maximumTrackTintColor="#D1D5DB"
                thumbTintColor="#111827"
                style={styles.slider}
              />

              <View style={styles.radiusRangeRow}>
                <Text style={styles.rangeText}>1 km</Text>
                <Text style={styles.rangeText}>50 km</Text>
              </View>

              {generalError ? (
                <Text style={styles.fieldErrorText}>{generalError}</Text>
              ) : null}

              <TouchableOpacity
                style={styles.applyButton}
                onPress={onApply}
                activeOpacity={0.85}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
    justifyContent: 'flex-end',
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '88%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 0,
  },
  handleZone: {
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 54,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  headerRow: {
    minHeight: 44,
    paddingHorizontal: 20,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  resetButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
    marginTop: 10,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 6,
  },
  categoryChip: {
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  selectedChip: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  selectedChipText: {
    color: '#FFFFFF',
  },
  showMoreButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 6,
  },
  showMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  optionButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  selectedOptionButton: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  selectedOptionButtonText: {
    color: '#FFFFFF',
  },
  dateColumn: {
    flex: 1,
  },
  dateInputContainer: {
    position: 'relative',
    justifyContent: 'center',
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
    marginBottom: 16,
    marginHorizontal: Platform.OS === 'ios' ? 0 : 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  inputLabelError: {
    color: '#DC2626',
  },
  dateInput: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    paddingLeft: 16,
    paddingRight: 46, // Space for the icon
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateInputError: {
    borderColor: '#FCA5A5',
    color: '#DC2626',
  },
  fieldErrorText: {
    marginTop: 6,
    color: '#DC2626',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radiusValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 10,
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 4,
  },
  radiusRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rangeText: {
    fontSize: 14,
    color: '#6B7280',
  },
  applyButton: {
    marginTop: 16,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
