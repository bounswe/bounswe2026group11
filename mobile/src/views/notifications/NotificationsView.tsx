import React, { useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  SectionList,
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
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

function formatNotificationTime(value: string): string {
  const now = new Date();
  const date = new Date(value);
  const diffMs = now.getTime() - date.getTime();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  if (diffMs < minuteMs) return 'Just now';
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)}m ago`;
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)}h ago`;
  if (diffMs < 7 * dayMs) return `${Math.floor(diffMs / dayMs)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface NotificationRowProps {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  onDelete: (notificationId: string) => void;
  theme: Theme;
}

function NotificationRow({ item, onOpen, onDelete, theme }: NotificationRowProps) {
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const presentation = getNotificationPresentation(item);
  const isDedicated = isDedicatedParticipationNotification(item.type);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.notificationRow, !item.is_read && styles.unreadRow, isDedicated && styles.notificationRowDedicated]}
      onPress={() => onOpen(item)}
    >
      <View style={[styles.notificationIcon, isDedicated && { backgroundColor: presentation.accentBackgroundColor }]}>
        <Ionicons name={presentation.iconName as any} size={22} color={isDedicated ? presentation.accentColor : theme.text} />
      </View>
      <View style={styles.notificationBody}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle} numberOfLines={1}>{presentation.title ?? item.title}</Text>
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>
        {presentation.badgeLabel && (
          <View style={[styles.typePill, { backgroundColor: presentation.accentBackgroundColor }]}>
            <Text style={[styles.typePillText, { color: presentation.accentColor }]}>{presentation.badgeLabel}</Text>
          </View>
        )}
        <Text style={styles.notificationText} numberOfLines={3}>{presentation.summary}</Text>
        <View style={styles.notificationMetaRow}>
          {presentation.actionLabel && (
            <Text style={[styles.notificationType, isDedicated && { color: presentation.accentColor }]}>{presentation.actionLabel}</Text>
          )}
          <Text style={styles.notificationTime}>{formatNotificationTime(item.created_at)}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item.id)}>
        <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function NotificationsView() {
  const vm = useNotificationsViewModel();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const hasFocusedOnceRef = useRef(false);

  useFocusEffect(useCallback(() => {
    if (hasFocusedOnceRef.current) void vm.refresh();
    else hasFocusedOnceRef.current = true;
  }, [vm.refresh]));

  const sections = useMemo(() => {
    if (vm.notifications.length === 0) return [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayKey = t('notifications.today');
    const earlierKey = t('notifications.earlier');
    const groups: { [key: string]: NotificationItem[] } = { [todayKey]: [], [earlierKey]: [] };
    vm.notifications.forEach(item => {
      const d = new Date(item.created_at);
      const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (itemDate === today) groups[todayKey].push(item);
      else groups[earlierKey].push(item);
    });
    return Object.entries(groups).filter(([_, items]) => items.length > 0).map(([title, data]) => ({ title, data }));
  }, [vm.notifications, t]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.titleBlock}>
            <Text style={styles.screenTitle}>{t('notifications.title')}</Text>
            <Text style={styles.screenSubtitle}>
              {vm.unreadCount === 0
                ? t('notifications.allCaughtUp')
                : t('notifications.unreadCount', { count: vm.unreadCount })}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.markAllButton, vm.unreadCount === 0 && styles.markAllButtonDisabled]}
            onPress={() => void vm.markAllRead()}
            disabled={vm.unreadCount === 0}
            accessibilityLabel="Mark all notifications as read"
          >
            <Ionicons name="checkmark-done-outline" size={21} color={vm.unreadCount === 0 ? theme.border : theme.text} />
          </TouchableOpacity>
        </View>

        {vm.apiError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{vm.apiError}</Text>
          </View>
        )}

        {vm.isLoading && !vm.isRefreshing ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>{t('notifications.loading')}</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <NotificationRow item={item} onOpen={item => {
              void vm.markRead(item.id);
              const r = resolveNotificationRoute(item);
              if (r) router.push(r as Href);
            }} onDelete={id => void vm.removeNotification(id)} theme={theme} />}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
              </View>
            )}
            contentContainerStyle={[styles.listContent, sections.length === 0 && { flex: 1 }]}
            stickySectionHeadersEnabled={false}
            refreshing={vm.isRefreshing}
            onRefresh={vm.refresh}
            onEndReached={vm.loadMore}
            ListEmptyComponent={
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyStateIconCircle}>
                  <Ionicons name="notifications-outline" size={48} color={theme.primary} />
                </View>
                <Text style={styles.emptyTitle}>{t('notifications.emptyTitle')}</Text>
                <Text style={styles.emptySubtitle}>{t('notifications.emptySubtitle')}</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.background },
    container: { flex: 1, paddingHorizontal: 20 },
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingBottom: 18, gap: 12 },
    backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
    titleBlock: { flex: 1 },
    screenTitle: { fontSize: 28, fontWeight: '800', color: t.text },
    screenSubtitle: { marginTop: 2, color: t.textMuted, fontSize: 14, fontWeight: '600' },
    markAllButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
    markAllButtonDisabled: { backgroundColor: t.background },
    errorBanner: { backgroundColor: t.errorBg, borderColor: t.errorBorder, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
    errorText: { color: t.errorText, fontSize: 14 },
    loadingPanel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
    loadingText: { marginTop: 12, color: t.textMuted, fontSize: 15 },
    listContent: { paddingBottom: 24, gap: 10 },
    notificationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 18, padding: 12 },
    notificationRowDedicated: { borderColor: t.borderStrong },
    unreadRow: { borderColor: t.unreadBorder, backgroundColor: t.unreadBg },
    notificationIcon: { width: 54, height: 54, borderRadius: 12, backgroundColor: t.infoBg, alignItems: 'center', justifyContent: 'center' },
    notificationBody: { flex: 1, minWidth: 0, gap: 5 },
    notificationHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    notificationTitle: { flex: 1, color: t.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.unreadDot },
    typePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    typePillText: { fontSize: 11, fontWeight: '800' },
    notificationText: { color: t.textSecondary, fontSize: 14, lineHeight: 19 },
    notificationMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
    notificationType: { flex: 1, color: t.infoText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
    notificationTime: { color: t.textMuted, fontSize: 12, fontWeight: '700' },
    deleteButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
    emptyStateIconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 22, fontWeight: '800', color: t.text },
    emptySubtitle: { marginTop: 10, fontSize: 15, lineHeight: 22, color: t.textMuted, textAlign: 'center', paddingHorizontal: 40 },
    sectionHeader: { backgroundColor: t.background, paddingTop: 24, paddingBottom: 10 },
    sectionHeaderText: { fontSize: 16, fontWeight: '800', color: t.textMuted, textTransform: 'uppercase', letterSpacing: 1.2 },
  });
}
