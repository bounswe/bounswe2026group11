import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FavoriteLocation } from '@/models/favorite';
import { LocationSuggestion } from '@/models/event';
import { useFavoriteLocationsViewModel } from '@/viewmodels/favorites/useFavoriteLocationsViewModel';
import { formatEventLocation } from '@/utils/eventLocation';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

function LocationCard({
  location,
  onRemove,
  isRemoving,
  theme,
  styles,
  t,
}: {
  location: FavoriteLocation;
  onRemove: (id: string) => Promise<void>;
  isRemoving: boolean;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const handleRemove = () => {
    Alert.alert(
      t('favorites.locations.removeTitle'),
      t('favorites.locations.removeMessage', { name: location.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => onRemove(location.id),
        },
      ],
    );
  };

  return (
    <View style={styles.locationCard}>
      <View style={styles.locationIcon}>
        <Ionicons name="location" size={22} color="#6366F1" />
      </View>
      <View style={styles.locationContent}>
        <Text
          style={styles.locationName}
          testID={`favorite-location-name-${location.name}`}
        >
          {location.name}
        </Text>
        <Text style={styles.locationAddress} numberOfLines={2}>
          {formatEventLocation(location.address)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={handleRemove}
        style={[styles.removeButton, isRemoving && styles.removeButtonDisabled]}
        disabled={isRemoving}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {isRemoving ? (
          <ActivityIndicator size="small" color={theme.errorText} />
        ) : (
          <Feather name="trash-2" size={18} color={theme.errorText} />
        )}
      </TouchableOpacity>
    </View>
  );
}

function AddLocationModal({
  visible,
  name,
  locationQuery,
  suggestions,
  isSearching,
  selectedSuggestion,
  error,
  isSubmitting,
  onClose,
  onChangeName,
  onChangeQuery,
  onSelectSuggestion,
  onSubmit,
  theme,
  styles,
  t,
}: {
  visible: boolean;
  name: string;
  locationQuery: string;
  suggestions: LocationSuggestion[];
  isSearching: boolean;
  selectedSuggestion: LocationSuggestion | null;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onChangeName: (value: string) => void;
  onChangeQuery: (value: string) => void;
  onSelectSuggestion: (suggestion: LocationSuggestion) => void;
  onSubmit: () => Promise<void>;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.modalSafeArea}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('favorites.locations.addTitle')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Feather name="x" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>{t('favorites.locations.name')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('favorites.locations.namePlaceholder')}
              placeholderTextColor={theme.placeholder}
              value={name}
              onChangeText={onChangeName}
              maxLength={50}
              testID="favorite-location-name-input"
            />

            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
              {t('favorites.locations.address')}
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('favorites.locations.addressPlaceholder')}
              placeholderTextColor={theme.placeholder}
              value={locationQuery}
              onChangeText={onChangeQuery}
              testID="favorite-location-address-input"
            />

            {isSearching ? (
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={styles.searchingText}>{t('common.search')}</Text>
              </View>
            ) : null}

            {suggestions.length > 0 && !selectedSuggestion ? (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((s, index) => (
                  <TouchableOpacity
                    key={`${s.lat}-${s.lon}-${index}`}
                    style={styles.suggestionItem}
                    onPress={() => onSelectSuggestion(s)}
                    testID={`favorite-location-suggestion-${index}`}
                  >
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={theme.textSecondary}
                    />
                    <Text style={styles.suggestionText} numberOfLines={2}>
                      {s.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {selectedSuggestion ? (
              <View style={styles.selectedBanner}>
                <Ionicons name="checkmark-circle" size={20} color={theme.successText} />
                <Text style={styles.selectedText} numberOfLines={2}>
                  {formatEventLocation(selectedSuggestion.display_name)}
                </Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveButton,
                isSubmitting && styles.saveButtonDisabled,
              ]}
              onPress={onSubmit}
              disabled={isSubmitting}
              testID="favorite-location-save-button"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.textOnPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>{t('favorites.locations.save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export default function FavoriteLocationsTab() {
  const vm = useFavoriteLocationsViewModel();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (vm.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.text} />
        <Text style={styles.loadingText}>{t('favorites.locations.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.countText}>
          {t('favorites.locations.count', { count: vm.locations.length, max: 3 })}
        </Text>
        <TouchableOpacity
          style={[styles.addButton, !vm.canAddMore && styles.addButtonDisabled]}
          onPress={vm.openAddModal}
          disabled={!vm.canAddMore}
          testID="favorite-location-add-button"
        >
          <Feather
            name="plus"
            size={18}
            color={vm.canAddMore ? theme.textOnPrimary : theme.textTertiary}
          />
          <Text
            style={[
              styles.addButtonText,
              !vm.canAddMore && styles.addButtonTextDisabled,
            ]}
          >
            {t('favorites.locations.add')}
          </Text>
        </TouchableOpacity>
      </View>

      {vm.apiError && vm.locations.length > 0 ? (
        <View style={styles.topErrorBanner}>
          <Text style={styles.errorText}>{vm.apiError}</Text>
        </View>
      ) : null}

      {vm.locations.length >= 3 ? (
        <View style={styles.limitBanner}>
          <Ionicons name="information-circle" size={18} color={theme.warningText} />
          <Text style={styles.limitText}>
            {t('favorites.locations.limitReached')}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={vm.locations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LocationCard
            location={item}
            onRemove={vm.removeLocation}
            isRemoving={vm.removingLocationId === item.id}
            theme={theme}
            styles={styles}
            t={t}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={vm.refresh}
        refreshing={vm.isRefreshing}
        ListEmptyComponent={
          vm.apiError ? (
            <View style={styles.emptyCenter}>
              <Ionicons name="alert-circle-outline" size={40} color={theme.border} />
              <Text style={styles.emptyTitle}>{t('favorites.locations.errorTitle')}</Text>
              <Text style={styles.emptySubtitle}>{vm.apiError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={vm.refresh}
                accessibilityLabel={t('favorites.locations.retry')}
              >
                <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyCenter}>
              <Ionicons name="location-outline" size={40} color={theme.border} />
              <Text style={styles.emptyTitle}>{t('favorites.locations.emptyTitle')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('favorites.locations.emptySubtitle')}
              </Text>
            </View>
          )
        }
      />

      <AddLocationModal
        visible={vm.isAddModalOpen}
        name={vm.addName}
        locationQuery={vm.addLocationQuery}
        suggestions={vm.addSuggestions}
        isSearching={vm.isSearchingSuggestions}
        selectedSuggestion={vm.selectedSuggestion}
        error={vm.addError}
        isSubmitting={vm.isSubmittingAdd}
        onClose={vm.closeAddModal}
        onChangeName={vm.setAddName}
        onChangeQuery={vm.setAddLocationQuery}
        onSelectSuggestion={vm.selectSuggestion}
        onSubmit={vm.submitAdd}
        theme={theme}
        styles={styles}
        t={t}
      />
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    center: {
      paddingVertical: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 12,
      color: t.textSecondary,
      fontSize: 15,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    countText: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.primaryAlt,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
    },
    addButtonDisabled: {
      backgroundColor: t.border,
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: t.textOnPrimary,
    },
    addButtonTextDisabled: {
      color: t.textTertiary,
    },
    limitBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.warningBg,
      borderColor: t.warningBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    limitText: {
      fontSize: 13,
      color: t.warningText,
      flex: 1,
    },
    listContent: {
      paddingBottom: 20,
    },
    locationCard: {
      backgroundColor: t.surface,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    locationIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: t.infoBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locationContent: {
      flex: 1,
      marginLeft: 14,
      marginRight: 8,
    },
    locationName: {
      fontSize: 16,
      fontWeight: '700',
      color: t.text,
      marginBottom: 4,
    },
    locationAddress: {
      fontSize: 13,
      color: t.textSecondary,
      lineHeight: 18,
    },
    removeButton: {
      padding: 6,
    },
    removeButtonDisabled: {
      opacity: 0.6,
    },
    emptyCenter: {
      paddingVertical: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
      marginTop: 12,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: t.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
    topErrorBanner: {
      backgroundColor: t.errorBg,
      borderColor: t.errorBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    errorBanner: {
      backgroundColor: t.errorBg,
      borderColor: t.errorBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginTop: 14,
    },
    errorText: {
      color: t.errorText,
      fontSize: 14,
    },
    retryButton: {
      marginTop: 16,
      backgroundColor: t.primaryAlt,
      borderRadius: 12,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    retryButtonText: {
      color: t.textOnPrimary,
      fontSize: 14,
      fontWeight: '700',
    },

    // Modal styles
    modalSafeArea: {
      flex: 1,
      backgroundColor: t.surface,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: t.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.surface,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: t.text,
    },
    modalClose: {
      padding: 4,
    },
    modalBody: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
      marginBottom: 8,
    },
    textInput: {
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: t.text,
    },
    searchingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
    },
    searchingText: {
      fontSize: 14,
      color: t.textSecondary,
    },
    suggestionsContainer: {
      marginTop: 8,
      backgroundColor: t.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      overflow: 'hidden',
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.surfaceAlt,
    },
    suggestionText: {
      fontSize: 14,
      color: t.textSecondary,
      flex: 1,
    },
    selectedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.successBg,
      borderColor: t.successBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      marginTop: 14,
    },
    selectedText: {
      fontSize: 14,
      color: t.successText,
      flex: 1,
    },
    modalFooter: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: t.border,
      backgroundColor: t.surface,
    },
    cancelButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.surface,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: t.textSecondary,
    },
    saveButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: t.primaryAlt,
    },
    saveButtonDisabled: {
      opacity: 0.7,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: t.textOnPrimary,
    },
  });
}
