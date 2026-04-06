import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import HomeHeader from '@/components/home/HomeHeader';
import SearchSection from '@/components/home/SearchSection';
import EmptyState from '@/components/home/EmptyState';
import LoadingState from '@/components/home/LoadingState';
import BottomTabBar from '@/components/common/BottomTabBar';
import EventCard from '@/components/events/EventCard';
import FiltersBottomSheet from '@/components/home/FiltersBottomSheet';
import { useHomeViewModel } from '@/viewmodels/home/useHomeViewModel';
import LocationPickerPanel from '@/components/home/LocationPickerPanel';

export default function HomeView() {
  const vm = useHomeViewModel();
  const hasMountedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (hasMountedRef.current) {
        void vm.silentRefresh();
      } else {
        hasMountedRef.current = true;
      }
    }, [vm.silentRefresh]),
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

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topSection}>
          <HomeHeader
            ref={locationButtonRef}
            locationLabel={vm.locationLabel}
            onPressLocation={handleOpenLocationPicker}
          />

          <SearchSection
            query={vm.searchText}
            onChangeQuery={vm.updateSearchText}
            onSubmitSearch={vm.submitSearch}
            onPressFilter={vm.openFilterModal}
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
                    <ActivityIndicator size="small" color="#111827" />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>

      <BottomTabBar />

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
      />

      <LocationPickerPanel
        visible={vm.isLocationModalOpen}
        query={vm.locationQuery}
        suggestions={vm.locationSuggestions}
        isSearching={vm.isSearchingLocation}
        selectedLocation={vm.pendingLocation}
        onClose={vm.closeLocationModal}
        onReset={vm.resetLocationDraft}
        onChangeQuery={vm.updateLocationQuery}
        onSelectSuggestion={vm.selectLocationSuggestion}
        onApply={vm.applySelectedLocation}
        anchorTop={locationPopupTop}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
  },
});
