import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LocationSuggestion } from '@/models/event';
import { formatEventLocation } from '@/utils/eventLocation';

interface SavedLocationOption {
  id: string;
  title: string;
  subtitle: string;
  suggestion: LocationSuggestion;
}

interface LocationPickerPanelProps {
  visible: boolean;
  query: string;
  suggestions: LocationSuggestion[];
  isSearching: boolean;
  selectedLocation: LocationSuggestion | null;
  anchorTop: number;
  defaultOption: {
    title: string;
    subtitle: string;
    suggestion: LocationSuggestion | null;
    isLoading: boolean;
  };
  favoriteOptions: SavedLocationOption[];
  isLoadingFavoriteLocations: boolean;
  favoriteLocationsError: string | null;
  onClose: () => void;
  onReset: () => void;
  onRetryFavoriteLocations: () => void;
  onChangeQuery: (value: string) => void;
  onSelectSavedLocation: (suggestion: LocationSuggestion) => void;
  onSelectSuggestion: (suggestion: LocationSuggestion) => void;
  onApply: () => void;
}

function isSelectedLocation(
  selectedLocation: LocationSuggestion | null,
  suggestion: LocationSuggestion | null,
): boolean {
  if (!selectedLocation || !suggestion) {
    return false;
  }

  return (
    selectedLocation.lat === suggestion.lat &&
    selectedLocation.lon === suggestion.lon
  );
}

function SavedLocationCard({
  title,
  subtitle,
  iconName,
  isSelected,
  isDisabled = false,
  onPress,
}: {
  title: string;
  subtitle: string;
  iconName: React.ComponentProps<typeof Feather>['name'];
  isSelected: boolean;
  isDisabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.savedOptionCard,
        isSelected && styles.savedOptionCardSelected,
        isDisabled && styles.savedOptionCardDisabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      <Feather
        name={isSelected ? 'check-circle' : iconName}
        size={18}
        color={isSelected ? '#111827' : '#6B7280'}
      />
      <View style={styles.savedOptionContent}>
        <Text style={styles.savedOptionTitle}>{title}</Text>
        <Text style={styles.savedOptionSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function LocationPickerPanel({
  visible,
  query,
  suggestions,
  isSearching,
  selectedLocation,
  anchorTop,
  defaultOption,
  favoriteOptions,
  isLoadingFavoriteLocations,
  favoriteLocationsError,
  onClose,
  onReset,
  onRetryFavoriteLocations,
  onChangeQuery,
  onSelectSavedLocation,
  onSelectSuggestion,
  onApply,
}: LocationPickerPanelProps) {
  const trimmedQuery = query.trim();
  const isSearchMode = trimmedQuery.length > 0;
  const searchStateText =
    trimmedQuery.length < 2
      ? 'Type at least 2 characters.'
      : 'No locations found.';

  const canApply = Boolean(selectedLocation);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.popup, { top: anchorTop }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Close location picker"
            >
              <Feather name="x" size={28} color="#111827" />
            </TouchableOpacity>

            <Text style={styles.title}>Choose Location</Text>

            <TouchableOpacity
              onPress={onReset}
              activeOpacity={0.85}
              style={styles.resetButton}
              accessibilityRole="button"
              accessibilityLabel="Reset location"
            >
              <Feather name="rotate-ccw" size={18} color="#111827" />
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Feather name="search" size={20} color="#6B7280" />
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              placeholder="Search for a location"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              autoCorrect={false}
            />
          </View>

          <View style={styles.listWrapper}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            >
              {isSearchMode ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Search Results</Text>

                  {isSearching ? (
                    <View style={styles.inlineStatusRow}>
                      <ActivityIndicator size="small" color="#111827" />
                      <Text style={styles.inlineStatusText}>Searching locations...</Text>
                    </View>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((item, index) => {
                      const isSelected = isSelectedLocation(selectedLocation, item);

                      return (
                        <TouchableOpacity
                          key={`${item.lat}-${item.lon}-${index}`}
                          style={[styles.searchResultItem, isSelected && styles.savedOptionCardSelected]}
                          onPress={() => onSelectSuggestion(item)}
                          activeOpacity={0.85}
                        >
                          <Feather
                            name={isSelected ? 'check-circle' : 'map-pin'}
                            size={18}
                            color={isSelected ? '#111827' : '#6B7280'}
                          />
                          <Text style={styles.searchResultText} numberOfLines={2}>
                            {formatEventLocation(item.display_name)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyText}>{searchStateText}</Text>
                  )}
                </View>
              ) : (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Ready To Use</Text>

                  <SavedLocationCard
                    title={defaultOption.title}
                    subtitle={defaultOption.subtitle}
                    iconName={defaultOption.isLoading ? 'loader' : 'home'}
                    isSelected={isSelectedLocation(
                      selectedLocation,
                      defaultOption.suggestion,
                    )}
                    isDisabled={defaultOption.isLoading || !defaultOption.suggestion}
                    onPress={() => {
                      if (defaultOption.suggestion) {
                        onSelectSavedLocation(defaultOption.suggestion);
                      }
                    }}
                  />

                  <View style={styles.favoriteHeaderRow}>
                    <Text style={styles.favoriteSectionTitle}>Favorite Locations</Text>
                    <Text style={styles.favoriteCountText}>
                      {favoriteOptions.length} / 3
                    </Text>
                  </View>

                  {isLoadingFavoriteLocations ? (
                    <View style={styles.inlineStatusRow}>
                      <ActivityIndicator size="small" color="#111827" />
                      <Text style={styles.inlineStatusText}>
                        Loading favorite locations...
                      </Text>
                    </View>
                  ) : favoriteLocationsError ? (
                    <View style={styles.messageCard}>
                      <Text style={styles.messageTitle}>
                        Unable to load favorite locations
                      </Text>
                      <Text style={styles.messageText}>{favoriteLocationsError}</Text>
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={onRetryFavoriteLocations}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.retryButtonText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : favoriteOptions.length === 0 ? (
                    <Text style={styles.emptyText}>
                      No favorite locations saved yet.
                    </Text>
                  ) : (
                    favoriteOptions.map((option) => (
                      <SavedLocationCard
                        key={option.id}
                        title={option.title}
                        subtitle={option.subtitle}
                        iconName="star"
                        isSelected={isSelectedLocation(
                          selectedLocation,
                          option.suggestion,
                        )}
                        onPress={() => onSelectSavedLocation(option.suggestion)}
                      />
                    ))
                  )}
                </View>
              )}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={[
              styles.applyButton,
              !canApply && styles.applyButtonDisabled,
            ]}
            onPress={onApply}
            activeOpacity={0.85}
            disabled={!canApply}
          >
            <Text style={styles.applyButtonText}>Apply Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    position: 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  popup: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  headerRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  searchBox: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  listWrapper: {
    maxHeight: 320,
    minHeight: 180,
  },
  listContent: {
    paddingBottom: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  savedOptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  savedOptionCardSelected: {
    borderColor: '#111827',
    backgroundColor: '#F9FAFB',
  },
  savedOptionCardDisabled: {
    opacity: 0.6,
  },
  savedOptionContent: {
    flex: 1,
  },
  savedOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  savedOptionSubtitle: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  favoriteHeaderRow: {
    marginTop: 6,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  favoriteSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  favoriteCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  inlineStatusRow: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
  },
  inlineStatusText: {
    fontSize: 14,
    color: '#4B5563',
  },
  messageCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 12,
  },
  messageTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#B91C1C',
  },
  retryButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  searchResultItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchResultText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 12,
  },
  applyButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
