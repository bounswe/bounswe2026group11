import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NotificationItem } from '@/models/notification';
import { resolveNotificationRoute } from '@/utils/notificationRouting';
import { useNotificationsViewModel } from '@/viewmodels/notifications/useNotificationsViewModel';

function formatNotificationTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '';

  const diffMs = Date.now() - timestamp;
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) return 'Just now';
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)}m ago`;
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)}h ago`;
  if (diffMs < 7 * dayMs) return `${Math.floor(diffMs / dayMs)}d ago`;

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatNotificationType(type: string | null): string | null {
  if (!type) return null;

  return type
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

interface NotificationRowProps {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  onDelete: (notificationId: string) => void;
}

function NotificationRow({ item, onOpen, onDelete }: NotificationRowProps) {
  const typeLabel = formatNotificationType(item.type);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.notificationRow, !item.is_read && styles.unreadRow]}
      onPress={() => onOpen(item)}
      accessibilityRole="button"
      accessibilityLabel={`Open notification ${item.title}`}
    >
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={styles.notificationImage}
          accessibilityLabel=""
        />
      ) : (
        <View style={styles.notificationIcon}>
          <Ionicons name="notifications-outline" size={22} color="#0F172A" />
        </View>
      )}

      <View style={styles.notificationBody}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {!item.is_read ? <View style={styles.unreadDot} /> : null}
        </View>

        <Text style={styles.notificationText} numberOfLines={3}>
          {item.body}
        </Text>

        <View style={styles.notificationMetaRow}>
          {typeLabel ? (
            <Text style={styles.notificationType} numberOfLines={1}>
              {typeLabel}
            </Text>
          ) : null}
          <Text style={styles.notificationTime}>
            {formatNotificationTime(item.created_at)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.deleteButton}
        onPress={() => onDelete(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Delete notification ${item.title}`}
      >
        <Ionicons name="trash-outline" size={18} color="#64748B" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function NotificationsView() {
  const vm = useNotificationsViewModel();

  const openNotification = useCallback(
    (item: NotificationItem) => {
      void vm.markRead(item.id);

      const route = resolveNotificationRoute(item);
      if (route) {
        router.push(route as Href);
      }
    },
    [vm],
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <NotificationRow
        item={item}
        onOpen={openNotification}
        onDelete={(notificationId) => void vm.removeNotification(notificationId)}
      />
    ),
    [openNotification, vm],
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.82}
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>

          <View style={styles.titleBlock}>
            <Text style={styles.screenTitle}>Notifications</Text>
            <Text style={styles.screenSubtitle}>
              {vm.unreadCount === 0
                ? 'All caught up'
                : `${vm.unreadCount} unread`}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.82}
            style={[
              styles.markAllButton,
              vm.unreadCount === 0 && styles.markAllButtonDisabled,
            ]}
            onPress={() => void vm.markAllRead()}
            disabled={vm.unreadCount === 0}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
          >
            <Ionicons
              name="checkmark-done-outline"
              size={21}
              color={vm.unreadCount === 0 ? '#CBD5E1' : '#111827'}
            />
          </TouchableOpacity>
        </View>

        {vm.apiError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{vm.apiError}</Text>
          </View>
        ) : null}

        {vm.isLoading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="large" color="#111827" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : (
          <FlatList
            data={vm.notifications}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={vm.isRefreshing}
            onRefresh={vm.refresh}
            onEndReachedThreshold={0.35}
            onEndReached={vm.loadMore}
            ListEmptyComponent={
              vm.apiError ? null : (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="notifications-off-outline"
                    size={42}
                    color="#CBD5E1"
                  />
                  <Text style={styles.emptyTitle}>No notifications yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Event invitations and join request updates will appear here.
                  </Text>
                </View>
              )
            }
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  screenSubtitle: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  markAllButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllButtonDisabled: {
    backgroundColor: '#F8FAFC',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  loadingPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 15,
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 12,
  },
  unreadRow: {
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  notificationImage: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  notificationIcon: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBody: {
    flex: 1,
    minWidth: 0,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7',
  },
  notificationText: {
    marginTop: 4,
    color: '#475569',
    fontSize: 14,
    lineHeight: 19,
  },
  notificationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 9,
  },
  notificationType: {
    flex: 1,
    color: '#0369A1',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  notificationTime: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoader: {
    paddingVertical: 16,
  },
  emptyState: {
    paddingVertical: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 28,
  },
});
