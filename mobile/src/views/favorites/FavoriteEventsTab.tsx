import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import ProfileEventCard from '@/components/profile/ProfileEventCard';
import { useFavoriteEventsViewModel } from '@/viewmodels/favorites/useFavoriteEventsViewModel';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export default function FavoriteEventsTab() {
  const vm = useFavoriteEventsViewModel();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (vm.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.text} />
        <Text style={styles.loadingText}>{t('favorites.events.loading')}</Text>
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
            categoryLabel={t(`events.categories.${item.category}`, {
              defaultValue: item.category ?? t('events.categories.Event'),
            })}
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
            <Ionicons name="heart-outline" size={40} color={theme.border} />
            <Text style={styles.emptyTitle}>{t('favorites.events.emptyTitle')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('favorites.events.emptySubtitle')}
            </Text>
          </View>
        )}
        ListFooterComponent={
          vm.isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={theme.text} />
            </View>
          ) : null
        }
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
    errorBanner: {
      backgroundColor: t.errorBg,
      borderColor: t.errorBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    errorText: {
      color: t.errorText,
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
  });
}
