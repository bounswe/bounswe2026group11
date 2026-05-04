import React, { useCallback, useMemo, useRef } from 'react';
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
import { router, useFocusEffect, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NotificationItem } from '@/models/notification';
import {
  getNotificationPresentation,
  isDedicatedParticipationNotification,
} from '@/utils/notificationPresentation';
import { resolveNotificationRoute } from '@/utils/notificationRouting';
import { useNotificationsViewModel } from '@/viewmodels/notifications/useNotificationsViewModel';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

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

interface NotificationRowProps {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  onDelete: (notificationId: string) => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}

function NotificationRow({ item, onOpen, onDelete, theme, styles }: NotificationRowProps) {
  const presentation = getNotificationPresentation(item);
  const isDedicated = isDedicatedParticipationNotification(item.type);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[
        styles.notificationRow,
        !item.is_read && styles.unreadRow,
        isDedicated && styles.notificationRowDedicated,
      ]}
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
        <View
          style={[
            styles.notificationIcon,
            isDedicated && {
              backgroundColor: presentation.accentBackgroundColor,
            },
          ]}
        >
          <Ionicons
            name={presentation.iconName as any}
            size={22}
            color={isDedicated ? presentation.accentColor : theme.text}
          />
        </View>
      )}

      <View style={styles.notificationBody}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {!item.is_read ? <View style={styles.unreadDot} /> : null}
        </View>

        {presentation.badgeLabel ? (
          <View
            style={[
              styles.typePill,
              { backgroundColor: presentation.accentBackgroundColor },
            ]}
          >
            <Text
              style={[
                styles.typePillText,
                { color: presentation.accentColor },
              ]}
            >
              {presentation.badgeLabel}
            </Text>
          </View>
        ) : null}

        {presentation.eventTitle ? (
          <Text style={styles.notificationEventTitle} numberOfLines={2}>
            {presentation.eventTitle}
          </Text>
        ) : null}

        <Text style={styles.notificationText} numberOfLines={3}>
          {presentation.summary}
        </Text>

        {presentation.metadata.length > 0 ? (
          <View style={styles.notificationMetadataBlock}>
            {presentation.metadata.map((line) => (
              <Text
                key={`${item.id}-${line}`}
                style={styles.notificationMetadata}
                numberOfLines={1}
              >
                {line}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.notificationMetaRow}>
          {presentation.actionLabel ? (
            <Text
              style={[
                styles.notificationType,
                isDedicated && { color: presentation.accentColor },
              ]}
              numberOfLines={1}
            >
              {presentation.actionLabel}
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
        <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function NotificationsView() {
  const vm = useNotificationsViewModel();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const hasFocusedOnceRef = useRef(false);

  // Stability for refresh to prevent infinite loops
  const refreshNotifications = useCallback(() => {
    if (hasFocusedOnceRef.current) {
      void vm.refresh();
    } else {
      hasFocusedOnceRef.current = true;
    }
  }, [vm.refresh]); // Only depend on the refresh function if stable

  useFocusEffect(refreshNotifications);

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
        theme={theme}
        styles={styles}
      />
    ),
    [openNotification, vm, theme, styles],
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
            <Ionicons name="chevron-back" size={24} color={theme.text} />
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
              color={vm.unreadCount === 0 ? theme.border : theme.text}
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
            <ActivityIndicator size="large" color={theme.text} />
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
                    color={theme.border}
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
                  <ActivityIndicator size="small" color={theme.text} />
                </View>
              ) : null
            }
          />
        )}
      </View>
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
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleBlock: {
      flex: 1,
    },
    screenTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: t.text,
    },
    screenSubtitle: {
      marginTop: 2,
      color: t.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    markAllButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markAllButtonDisabled: {
      backgroundColor: t.background,
    },
    errorBanner: {
      backgroundColor: t.errorBg,
      borderColor: t.errorBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    errorText: {
      color: t.errorText,
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
      color: t.textMuted,
      fontSize: 15,
    },
    listContent: {
      paddingBottom: 24,
      gap: 10,
    },
    notificationRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      padding: 12,
    },
    notificationRowDedicated: {
      borderColor: t.borderStrong,
    },
    unreadRow: {
      borderColor: t.unreadBorder,
      backgroundColor: t.unreadBg,
    },
    notificationImage: {
      width: 54,
      height: 54,
      borderRadius: 12,
      backgroundColor: t.imagePlaceholder,
    },
    notificationIcon: {
      width: 54,
      height: 54,
      borderRadius: 12,
      backgroundColor: t.infoBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationBody: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    notificationHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    notificationTitle: {
      flex: 1,
      color: t.text,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 20,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.unreadDot,
    },
    typePill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    typePillText: {
      fontSize: 11,
      fontWeight: '800',
    },
    notificationEventTitle: {
      color: t.text,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 20,
    },
    notificationText: {
      color: t.textSecondary,
      fontSize: 14,
      lineHeight: 19,
    },
    notificationMetadataBlock: {
      gap: 2,
    },
    notificationMetadata: {
      color: t.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
    },
    notificationMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 9,
    },
    notificationType: {
      flex: 1,
      color: t.infoText,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    notificationTime: {
      color: t.textMuted,
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
      color: t.text,
    },
    emptySubtitle: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: t.textMuted,
      textAlign: 'center',
      paddingHorizontal: 28,
    },
  });
}
