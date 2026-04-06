import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import ProfileEventCard from '@/components/profile/ProfileEventCard';
import { useFavoriteEventsViewModel } from '@/viewmodels/favorites/useFavoriteEventsViewModel';

export default function FavoriteEventsTab() {
  const vm = useFavoriteEventsViewModel();

  if (vm.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Loading favorites...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {vm.apiError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{vm.apiError}</Text>
        </View>
      ) : null}

      <FlatList
        data={vm.events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProfileEventCard
            title={item.title}
            imageUrl={item.image_url}
            categoryLabel={item.category ?? 'Event'}
            startTime={item.start_time}
            locationAddress={item.location_address ?? null}
            status={item.status}
            privacyLevel={item.privacy_level ?? null}
            onPress={() => router.push(`/event/${item.id}` as Href)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={vm.refresh}
        refreshing={vm.isRefreshing}
        onEndReachedThreshold={0.35}
        onEndReached={vm.loadMore}
        ListEmptyComponent={vm.apiError ? null : (
          <View style={styles.center}>
            <Ionicons name="heart-outline" size={40} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No favorite events yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the heart icon on an event to save it here.
            </Text>
          </View>
        )}
        ListFooterComponent={
          vm.isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#111827" />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: '#6B7280',
    fontSize: 15,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  footerLoader: {
    paddingVertical: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
