import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeHeader from '@/components/home/HomeHeader';
import SemLogo from '@/components/common/SemLogo';
import SearchSection from '@/components/home/SearchSection';
import EmptyState from '@/components/home/EmptyState';
import LoadingState from '@/components/home/LoadingState';
import EventCard from '@/components/events/EventCard';
import FiltersBottomSheet from '@/components/home/FiltersBottomSheet';
import EventMapView from '@/components/home/EventMapView';
import { useHomeViewModel } from '@/viewmodels/home/useHomeViewModel';
import LocationPickerPanel from '@/components/home/LocationPickerPanel';
import { useUnreadNotificationCount } from '@/viewmodels/notifications/useUnreadNotificationCount';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const REGION_DELTA_PER_KM = 0.009;
const MIN_DELTA = 0.02;

export default function HomeView() {
  const vm = useHomeViewModel();
  const { unreadCount, refresh: refreshUnreadCount } = useUnreadNotificationCount();
  const { theme, isDark, setThemePreference } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);
  const isMapMode = vm.viewMode === 'MAP';
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadCount();
    }, [refreshUnreadCount]),
  );

  const locationButtonRef = useRef<any>(null);
  const [locationPopupTop, setLocationPopupTop] = useState(140);

  const handleThemeToggle = useCallback(() => {
    void setThemePreference(isDark ? 'light' : 'dark');
  }, [isDark, setThemePreference]);

  const handleOpenLocationPicker = () => {
    if (locationButtonRef.current?.measureInWindow) {
      locationButtonRef.current.measureInWindow(
        (_x: number, y: number, _width: number, height: number) => {
          setLocationPopupTop(y + height + 8);
          vm.openLocationModal();
        },
      );
      return;
    }

    vm.openLocationModal();
  };

  const mapRegion = useMemo(() => {
    const delta = Math.max(
      vm.filterDraft.radiusKm * REGION_DELTA_PER_KM * 2,
      MIN_DELTA,
    );
    return {
      latitude: vm.activeLocation.lat,
      longitude: vm.activeLocation.lon,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [vm.activeLocation, vm.filterDraft.radiusKm]);

  return (
    <SafeAreaView
      edges={isMapMode ? [] : ['top', 'left', 'right']}
      style={styles.safeArea}
    >
      {isMapMode ? (
        <>
          <EventMapView
            events={vm.events}
            isLoading={vm.isLoading}
            apiError={vm.apiError}
            region={mapRegion}
            onMarkerPress={(id) => router.push(`/event/${id}` as Href)}
            headerTopInset={insets.top}
          />

          {/* Floating overlay — search, location and list toggle above the map */}
          <View
            style={[styles.mapOverlay, { top: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            {/* Row 1: logo + bell + theme toggle */}
            <View style={styles.mapOverlayRow}>
              <SemLogo height={46} color={theme.text} />

              <View style={styles.mapOverlayRowSpacer} />

              <TouchableOpacity
                style={styles.mapIconBtn}
                onPress={() => router.push('/notifications' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Open notifications"
              >
                <Feather name="bell" size={18} color={theme.text} />
                {unreadCount > 0 ? <View style={styles.mapIconBadge} /> : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mapIconBtn}
                onPress={handleThemeToggle}
                accessibilityRole="button"
                accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <Feather name={isDark ? 'sun' : 'moon'} size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View ref={locationButtonRef} collapsable={false}>
              <TouchableOpacity
                style={styles.mapLocationPill}
                onPress={handleOpenLocationPicker}
                accessibilityRole="button"
                accessibilityLabel="Select location"
              >
                <Feather name="map-pin" size={16} color={styles.mapLocationIconColor.color} />
                <Text style={styles.mapLocationText} numberOfLines={1}>
                  {vm.locationLabel}
                </Text>
                <Feather name="chevron-down" size={16} color={styles.mapLocationIconColor.color} />
              </TouchableOpacity>
            </View>

            {/* Row 2: search bar + filter + list button */}
            <View style={styles.mapSearchRow}>
              <View style={styles.mapSearchContainer}>
                <Feather
                  name="search"
                  size={18}
                  color={theme.textSecondary}
                  style={styles.mapSearchIcon}
                />
                <TextInput
                  value={vm.searchText}
                  onChangeText={vm.updateSearchText}
                  onSubmitEditing={vm.submitSearch}
                  placeholder={t('home.searchPlaceholder')}
                  placeholderTextColor={theme.placeholder}
                  style={styles.mapSearchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>

              <TouchableOpacity
                style={styles.mapFilterBtn}
                onPress={vm.openFilterModal}
                accessibilityRole="button"
                accessibilityLabel="Open filters"
                testID="map-filter-btn"
              >
                <Feather name="sliders" size={19} color={styles.mapLocationIconColor.color} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mapFilterBtn}
                onPress={vm.toggleViewMode}
                accessibilityRole="button"
                accessibilityLabel="Switch to list view"
                testID="toggle-list"
              >
                <Feather name="list" size={20} color={styles.mapLocationIconColor.color} />
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.container}>
          <View style={styles.topSection}>
            <HomeHeader
              isDark={isDark}
              onPressThemeToggle={handleThemeToggle}
              onPressNotifications={() => router.push('/notifications' as Href)}
              unreadNotificationCount={unreadCount}
            />

            {/* Location row */}
            <View ref={locationButtonRef} collapsable={false} style={styles.locationRow}>
              <TouchableOpacity
                style={styles.locationPill}
                onPress={handleOpenLocationPicker}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Select location"
              >
                <Feather name="map-pin" size={18} color={isDark ? theme.text : theme.textOnPrimary} />
                <Text style={styles.locationPillText} numberOfLines={1}>
                  {vm.locationLabel}
                </Text>
                <Feather name="chevron-down" size={18} color={isDark ? theme.text : theme.textOnPrimary} />
              </TouchableOpacity>
            </View>

            <SearchSection
              query={vm.searchText}
              onChangeQuery={vm.updateSearchText}
              onSubmitSearch={vm.submitSearch}
              onPressFilter={vm.openFilterModal}
              onPressMapView={() => {
                if (vm.viewMode !== 'MAP') vm.toggleViewMode();
              }}
            />

            {vm.apiError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{vm.apiError}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.listWrapper}>
            {vm.isLoading ? (
              <LoadingState />
            ) : (
              <FlatList
                data={vm.events}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <EventCard
                    event={item}
                    onPress={(id) => router.push(`/event/${id}` as Href)}
                  />
                )}
                showsVerticalScrollIndicator={false}
                onEndReachedThreshold={0.35}
                onEndReached={vm.loadMoreEvents}
                onRefresh={vm.refreshEvents}
                refreshing={vm.isRefreshing}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={<EmptyState />}
                ListFooterComponent={
                  vm.isLoadingMore ? (
                    <View style={styles.footerLoader}>
                      <ActivityIndicator size="small" color={theme.text} />
                    </View>
                  ) : null
                }
              />
            )}
          </View>
        </View>
      )}

      <FiltersBottomSheet
        visible={vm.isFilterModalOpen}
        categories={vm.categories}
        draftFilters={vm.filterDraft}
        errorMessage={vm.filterError}
        onClose={vm.closeFilterModal}
        onReset={vm.resetFilterDraft}
        onApply={vm.applyFilterDraft}
        onToggleCategory={vm.toggleDraftCategory}
        onTogglePrivacy={vm.toggleDraftPrivacy}
        onChangeStartDate={vm.updateDraftStartDate}
        onChangeEndDate={vm.updateDraftEndDate}
        onChangeRadius={vm.updateDraftRadiusKm}
        onChangeSortBy={vm.updateDraftSortBy}
        onToggleChildFriendly={vm.toggleDraftChildFriendly}
        onToggleFamilyOriented={vm.toggleDraftFamilyOriented}
      />

      <LocationPickerPanel
        visible={vm.isLocationModalOpen}
        query={vm.locationQuery}
        suggestions={vm.locationSuggestions}
        isSearching={vm.isSearchingLocation}
        selectedLocation={vm.pendingLocation}
        onClose={vm.closeLocationModal}
        onReset={vm.resetLocationDraft}
        onRetryFavoriteLocations={vm.retryFavoriteLocations}
        onChangeQuery={vm.updateLocationQuery}
        onSelectSavedLocation={vm.selectSavedLocationOption}
        onSelectSuggestion={vm.selectLocationSuggestion}
        onApply={vm.applySelectedLocation}
        anchorTop={locationPopupTop}
        defaultOption={vm.defaultLocationOption}
        favoriteOptions={vm.favoriteLocationOptions}
        isLoadingFavoriteLocations={vm.isLoadingFavoriteLocations}
        favoriteLocationsError={vm.favoriteLocationsError}
      />
    </SafeAreaView>
  );
}

function makeStyles(t: Theme, isDark: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: 20,
    },
    topSection: {
      paddingTop: 8,
    },
    locationRow: {
      marginBottom: 14,
    },
    locationPill: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 26,
      backgroundColor: isDark ? t.surface : t.primary,
      borderWidth: 1,
      borderColor: t.border,
      width: '100%',
    },
    locationPillText: {
      color: isDark ? t.text : t.textOnPrimary,
      fontSize: 16,
      fontWeight: '700',
      fontStyle: 'italic',
      flex: 1,
    },
    listWrapper: {
      flex: 1,
      marginTop: 6,
    },
    listContent: {
      paddingBottom: 20,
    },
    footerLoader: {
      paddingVertical: 16,
    },
    errorBanner: {
      backgroundColor: t.errorBg,
      borderColor: t.errorBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginTop: 8,
      marginBottom: 8,
    },
    errorBannerText: {
      color: t.errorText,
      fontSize: 14,
    },
    // ── full-screen map floating overlay ─────────────────────────────────────
    mapOverlay: {
      position: 'absolute',
      left: 14,
      right: 14,
      zIndex: 20,
      gap: 6,
    },
    mapOverlayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    mapOverlayRowSpacer: {
      flex: 1,
    },
    mapLocationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 46,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 23,
      backgroundColor: isDark ? t.surface : t.primary,
      borderWidth: 1,
      borderColor: t.border,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 5,
      elevation: 4,
    },
    mapLocationText: {
      color: isDark ? t.text : t.textOnPrimary,
      fontSize: 15,
      fontWeight: '700',
      fontStyle: 'italic',
      flex: 1,
    },
    mapLocationIconColor: {
      color: isDark ? t.text : t.textOnPrimary,
    },
    mapIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    mapIconBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.notificationBadge,
    },
    mapSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    mapSearchContainer: {
      flex: 1,
      height: 46,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
      borderRadius: 15,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.11,
      shadowRadius: 5,
      elevation: 4,
    },
    mapSearchIcon: {
      marginRight: 8,
    },
    mapSearchInput: {
      flex: 1,
      fontSize: 14,
      color: t.text,
      paddingVertical: 0,
    },
    mapFilterBtn: {
      width: 46,
      height: 46,
      borderRadius: 15,
      backgroundColor: isDark ? t.surface : t.primary,
      borderWidth: isDark ? 1 : 0,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 5,
      elevation: 4,
    },
  });
}
