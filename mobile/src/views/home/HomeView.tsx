import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import HomeHeader from '@/components/home/HomeHeader';
import SearchSection from '@/components/home/SearchSection';
import EmptyState from '@/components/home/EmptyState';
import LoadingState from '@/components/home/LoadingState';
import EventCard from '@/components/events/EventCard';
import FiltersBottomSheet from '@/components/home/FiltersBottomSheet';
import EventMapView from '@/components/home/EventMapView';
import { useHomeViewModel } from '@/viewmodels/home/useHomeViewModel';
import LocationPickerPanel from '@/components/home/LocationPickerPanel';
import { useUnreadNotificationCount } from '@/viewmodels/notifications/useUnreadNotificationCount';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const REGION_DELTA_PER_KM = 0.009;
const MIN_DELTA = 0.02;

export default function HomeView() {
  const vm = useHomeViewModel();
  const { unreadCount, refresh: refreshUnreadCount } = useUnreadNotificationCount();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadCount();
    }, [refreshUnreadCount]),
  );

  const locationButtonRef = useRef<any>(null);
  const [locationPopupTop, setLocationPopupTop] = useState(140);

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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topSection}>
          <HomeHeader
            ref={locationButtonRef}
            locationLabel={vm.locationLabel}
            onPressLocation={handleOpenLocationPicker}
            onPressNotifications={() => router.push('/notifications' as Href)}
            unreadNotificationCount={unreadCount}
          />

          <SearchSection
            query={vm.searchText}
            onChangeQuery={vm.updateSearchText}
            onSubmitSearch={vm.submitSearch}
            onPressFilter={vm.openFilterModal}
          />

          <View style={styles.viewToggleRow}>
            <TouchableOpacity
              style={[
                styles.viewToggleButton,
                styles.viewToggleLeft,
                vm.viewMode === 'LIST' && styles.viewToggleActive,
              ]}
              onPress={() => vm.viewMode !== 'LIST' && vm.toggleViewMode()}
              accessibilityRole="button"
              accessibilityLabel="List view"
              accessibilityState={{ selected: vm.viewMode === 'LIST' }}
              testID="toggle-list"
            >
              <Text
                style={[
                  styles.viewToggleText,
                  vm.viewMode === 'LIST' && styles.viewToggleTextActive,
                ]}
              >
                List
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.viewToggleButton,
                styles.viewToggleRight,
                vm.viewMode === 'MAP' && styles.viewToggleActive,
              ]}
              onPress={() => vm.viewMode !== 'MAP' && vm.toggleViewMode()}
              accessibilityRole="button"
              accessibilityLabel="Map view"
              accessibilityState={{ selected: vm.viewMode === 'MAP' }}
              testID="toggle-map"
            >
              <Text
                style={[
                  styles.viewToggleText,
                  vm.viewMode === 'MAP' && styles.viewToggleTextActive,
                ]}
              >
                Map
              </Text>
            </TouchableOpacity>
          </View>

          {vm.apiError && vm.viewMode === 'LIST' ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{vm.apiError}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.listWrapper}>
          {vm.viewMode === 'MAP' ? (
            <EventMapView
              events={vm.events}
              isLoading={vm.isLoading}
              apiError={vm.apiError}
              region={mapRegion}
              onMarkerPress={(id) => router.push(`/event/${id}` as Href)}
            />
          ) : vm.isLoading ? (
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

function makeStyles(t: Theme) {
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
    viewToggleRow: {
      flexDirection: 'row',
      marginTop: 10,
      marginBottom: 2,
      alignSelf: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      overflow: 'hidden',
    },
    viewToggleButton: {
      paddingHorizontal: 24,
      paddingVertical: 8,
      backgroundColor: t.surface,
    },
    viewToggleLeft: {
      borderTopLeftRadius: 999,
      borderBottomLeftRadius: 999,
    },
    viewToggleRight: {
      borderTopRightRadius: 999,
      borderBottomRightRadius: 999,
    },
    viewToggleActive: {
      backgroundColor: t.primary,
    },
    viewToggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: t.textSecondary,
    },
    viewToggleTextActive: {
      color: t.textOnPrimary,
    },
  });
}
