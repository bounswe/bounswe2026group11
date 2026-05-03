import React, { useMemo } from 'react';
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
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

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
  theme,
  styles,
}: {
  title: string;
  subtitle: string;
  iconName: React.ComponentProps<typeof Feather>['name'];
  isSelected: boolean;
  isDisabled?: boolean;
  onPress: () => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
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
        color={isSelected ? theme.text : theme.textSecondary}
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
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

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
              <Feather name="x" size={28} color={theme.text} />
            </TouchableOpacity>

            <Text style={styles.title}>Choose Location</Text>

            <TouchableOpacity
              onPress={onReset}
              activeOpacity={0.85}
              style={styles.resetButton}
              accessibilityRole="button"
              accessibilityLabel="Reset location"
            >
              <Feather name="rotate-ccw" size={18} color={theme.text} />
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Feather name="search" size={20} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              placeholder="Search for a location"
              placeholderTextColor={theme.placeholder}
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
                      <ActivityIndicator size="small" color={theme.text} />
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
                            color={isSelected ? theme.text : theme.textSecondary}
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
                    theme={theme}
                    styles={styles}
                  />

                  <View style={styles.favoriteHeaderRow}>
                    <Text style={styles.favoriteSectionTitle}>Favorite Locations</Text>
                    <Text style={styles.favoriteCountText}>
                      {favoriteOptions.length} / 3
                    </Text>
                  </View>

                  {isLoadingFavoriteLocations ? (
                    <View style={styles.inlineStatusRow}>
                      <ActivityIndicator size="small" color={theme.text} />
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
                        theme={theme}
                        styles={styles}
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

function makeStyles(t: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      position: 'relative',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.overlayLight,
    },
    popup: {
      position: 'absolute',
      left: 20,
      right: 20,
      backgroundColor: t.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: t.border,
      padding: 16,
      shadowColor: '#000',
      shadowOpacity: 0.12,
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
      color: t.text,
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: t.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    resetText: {
      fontSize: 14,
      fontWeight: '600',
      color: t.text,
    },
    searchBox: {
      height: 52,
      borderRadius: 16,
      backgroundColor: t.surfaceVariant,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 14,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: t.text,
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
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    savedOptionCard: {
      backgroundColor: t.surface,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
    },
    savedOptionCardSelected: {
      borderColor: t.text,
      backgroundColor: t.surfaceVariant,
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
      color: t.text,
      marginBottom: 4,
    },
    savedOptionSubtitle: {
      fontSize: 13,
      color: t.textMuted,
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
      color: t.text,
    },
    favoriteCountText: {
      fontSize: 12,
      fontWeight: '600',
      color: t.textSecondary,
    },
    inlineStatusRow: {
      minHeight: 56,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 12,
    },
    inlineStatusText: {
      fontSize: 14,
      color: t.textMuted,
    },
    messageCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.errorBorder,
      backgroundColor: t.errorBg,
      padding: 12,
    },
    messageTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: t.errorText,
      marginBottom: 4,
    },
    messageText: {
      fontSize: 13,
      lineHeight: 18,
      color: t.errorText,
    },
    retryButton: {
      marginTop: 10,
      alignSelf: 'flex-start',
      backgroundColor: t.surface,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.errorBorder,
    },
    retryButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: t.errorText,
    },
    searchResultItem: {
      backgroundColor: t.surface,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
    },
    searchResultText: {
      flex: 1,
      fontSize: 14,
      color: t.text,
      lineHeight: 20,
    },
    emptyText: {
      textAlign: 'center',
      color: t.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      paddingVertical: 12,
    },
    applyButton: {
      height: 52,
      borderRadius: 16,
      backgroundColor: t.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyButtonDisabled: {
      backgroundColor: t.textTertiary,
    },
    applyButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: t.textOnPrimary,
    },
  });
}
