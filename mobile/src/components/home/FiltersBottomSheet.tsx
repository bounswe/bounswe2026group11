import React from 'react';
import Slider from '@react-native-community/slider';
import {
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
import { Ionicons } from '@expo/vector-icons';
import {
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
}

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
}: FiltersBottomSheetProps) {
  const isPrivacySelected = (value: HomeFilterPrivacyLevel) =>
    draftFilters.privacyLevels.includes(value);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Close filters"
              >
                <Ionicons name="close" size={28} color="#111827" />
              </TouchableOpacity>

              <Text style={styles.title}>Filters</Text>

              <TouchableOpacity
                onPress={onReset}
                activeOpacity={0.8}
                style={styles.resetButton}
                accessibilityRole="button"
                accessibilityLabel="Reset filters"
              >
                <Ionicons name="refresh-outline" size={20} color="#111827" />
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sectionTitle}>Categories</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {categories.map((category) => {
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
              </ScrollView>

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
                  <Text style={styles.inputLabel}>From</Text>
                  <TextInput
                    style={styles.dateInput}
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
                </View>

                <View style={styles.dateColumn}>
                  <Text style={styles.inputLabel}>To</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="dd.mm.yyyy"
                    placeholderTextColor="#9CA3AF"
                    value={draftFilters.endDate}
                    onChangeText={(value) =>
                      onChangeEndDate(formatDateInput(value, draftFilters.endDate))
                    }
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                  />
                </View>
              </View>

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
                {errorMessage ? (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>{errorMessage}</Text>
                    </View>
                ) : null}

              <TouchableOpacity
                style={styles.applyButton}
                onPress={onApply}
                activeOpacity={0.85}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
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
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 54,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginBottom: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '600',
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
  categoryRow: {
    gap: 10,
    paddingBottom: 6,
  },
  categoryChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  selectedChip: {
    backgroundColor: '#111827',
  },
  selectedChipText: {
    color: '#FFFFFF',
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
  },
  optionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  selectedOptionButton: {
    backgroundColor: '#111827',
  },
  selectedOptionButtonText: {
    color: '#FFFFFF',
  },
  dateColumn: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  dateInput: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111827',
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
    errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    },
    errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 20,
    },
});