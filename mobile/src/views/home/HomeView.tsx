import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import HomeHeader from '@/components/home/HomeHeader';
import SearchSection from '@/components/home/SearchSection';
import EmptyState from '@/components/home/EmptyState';
import LoadingState from '@/components/home/LoadingState';
import BottomTabBar from '@/components/common/BottomTabBar';
import EventCard from '@/components/events/EventCard';
import FiltersBottomSheet from '@/components/home/FiltersBottomSheet';
import { useHomeViewModel } from '@/viewmodels/home/useHomeViewModel';

export default function HomeView() {
  const vm = useHomeViewModel();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topSection}>
          <HomeHeader
            locationLabel={vm.locationLabel}
            notificationCount={vm.notificationCount}
            onPressLocation={() => router.replace('/home' as Href)}
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
                    <ActivityIndicator size="small" color="#2563EB" />
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