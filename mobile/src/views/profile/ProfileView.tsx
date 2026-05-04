import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, type Href, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProfileEventCard from '@/components/profile/ProfileEventCard';
import { useAuth } from '@/contexts/AuthContext';
import { useLogoutViewModel } from '@/viewmodels/auth/useLogoutViewModel';
import { usePushNotificationPreference } from '@/viewmodels/notifications/usePushNotificationPreference';
import { useProfileViewModel } from '@/viewmodels/profile/useProfileViewModel';
import { formatEventLocation } from '@/utils/eventLocation';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ProfileEventTab = 'hosted' | 'attended';

export default function ProfileView() {
  const { refreshToken, clearAuth } = useAuth();
  const vm = useProfileViewModel();
  const notificationSettings = usePushNotificationPreference();
  const [activeTab, setActiveTab] = useState<ProfileEventTab>('hosted');
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { isLoggingOut, logoutError, handleLogout } = useLogoutViewModel(
    refreshToken,
    () => {
      clearAuth();
      router.replace('/' as Href);
    },
  );

  useFocusEffect(
    useCallback(() => {
      void vm.refresh();
    }, [vm.refresh]),
  );

  const activeEvents = useMemo(
    () => (activeTab === 'hosted' ? vm.hostedEvents : vm.attendedEvents),
    [activeTab, vm.attendedEvents, vm.hostedEvents],
  );

  const genderLabel = vm.profile?.gender
    ? vm.profile.gender.charAt(0) +
      vm.profile.gender.slice(1).toLowerCase().replace(/_/g, ' ')
    : 'Gender not set';
  const birthDateLabel = vm.profile?.birth_date
    ? vm.profile.birth_date.split('-').reverse().join('.')
    : 'Birth date not set';
  const phoneLabel = vm.profile?.phone_number || 'Phone not set';
  const locationLabel = vm.profile?.default_location_address
    ? formatEventLocation(vm.profile.default_location_address)
    : 'Location not set';

  const renderHeader = () => (
    <View>
      <Text style={styles.screenTitle}>Profile</Text>

      {vm.apiError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{vm.apiError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={vm.refresh}
            accessibilityRole="button"
            accessibilityLabel="Retry loading profile"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {logoutError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{logoutError}</Text>
        </View>
      ) : null}

      {vm.imageError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{vm.imageError}</Text>
        </View>
      ) : null}

      {vm.imageUploadSuccessMessage ? (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>{vm.imageUploadSuccessMessage}</Text>
        </View>
      ) : null}

      {vm.profile ? (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <TouchableOpacity
                onPress={vm.pickAvatar}
                activeOpacity={0.9}
                style={styles.avatarButton}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                {vm.profile.avatar_url ? (
                  <Image
                    source={{ uri: vm.profile.avatar_url }}
                    style={styles.avatar}
                    accessibilityLabel="Profile photo"
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>{vm.avatarInitial}</Text>
                  </View>
                )}

                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera-outline" size={16} color={theme.textOnPrimary} />
                </View>

                {vm.isUploadingAvatar ? (
                  <View style={styles.avatarUploadOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : null}
              </TouchableOpacity>

              <View style={styles.summaryTextBlock}>
                <Text
                  style={styles.primaryName}
                  numberOfLines={2}
                  accessibilityLabel="Display name"
                >
                  {vm.primaryName}
                </Text>
                {vm.secondaryName ? (
                  <Text
                    style={styles.secondaryName}
                    numberOfLines={1}
                    accessibilityLabel="Username"
                  >
                    @{vm.secondaryName}
                  </Text>
                ) : null}
                {vm.profile.bio ? (
                  <Text style={styles.bioText} numberOfLines={2}>
                    {vm.profile.bio}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.summaryInfoSection}>
              <View style={styles.summaryInfoRow}>
                <Ionicons name="mail-outline" size={18} color={theme.text} />
                <Text style={styles.summaryInfoText} numberOfLines={1}>
                  {vm.profile.email}
                </Text>
              </View>

              <View style={styles.summaryInfoRow}>
                <Ionicons name="call-outline" size={18} color={theme.text} />
                <Text style={styles.summaryInfoText} numberOfLines={1}>
                  {phoneLabel}
                </Text>
              </View>

              <View style={styles.summaryInfoRow}>
                <Ionicons name="person-outline" size={18} color={theme.text} />
                <Text style={styles.summaryInfoText} numberOfLines={1}>
                  {genderLabel}
                </Text>
              </View>

              <View style={styles.summaryInfoRow}>
                <Ionicons name="calendar-outline" size={18} color={theme.text} />
                <Text style={styles.summaryInfoText} numberOfLines={1}>
                  {birthDateLabel}
                </Text>
              </View>

              <View style={styles.summaryInfoRow}>
                <Ionicons name="location-outline" size={18} color={theme.text} />
                <Text style={styles.summaryInfoText} numberOfLines={2}>
                  {locationLabel}
                </Text>
              </View>
            </View>

            <View style={styles.statsSection}>
              <Text style={styles.statsSectionTitle}>Ratings</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{vm.overallRatingLabel}</Text>
                  <Text style={styles.statLabel}>Overall</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{vm.hostRatingLabel}</Text>
                  <Text style={styles.statLabel}>Host</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{vm.participantRatingLabel}</Text>
                  <Text style={styles.statLabel}>Participant</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => router.push('/profile/edit' as Href)}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
            >
              <View style={styles.menuRowLeft}>
                <Ionicons name="create-outline" size={20} color={theme.text} />
                <Text style={styles.menuRowText}>Edit Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => router.push('/notifications' as Href)}
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
            >
              <View style={styles.menuRowLeft}>
                <Ionicons name="notifications-outline" size={20} color={theme.text} />
                <Text style={styles.menuRowText}>Notifications</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <View style={styles.settingRow}>
              <View style={styles.menuRowLeft}>
                <Ionicons name="phone-portrait-outline" size={20} color={theme.text} />
                <View style={styles.settingTextBlock}>
                  <Text style={styles.menuRowText}>Push Notifications</Text>
                  <Text style={styles.settingSubtitle}>
                    Receive alerts on this device
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationSettings.pushNotificationsEnabled}
                onValueChange={(enabled) =>
                  void notificationSettings.setPushNotificationsEnabled(enabled)
                }
                disabled={
                  notificationSettings.isHydrating ||
                  notificationSettings.isSaving
                }
                trackColor={{ false: theme.switchTrackFalse, true: theme.switchTrackTrue }}
                thumbColor={
                  notificationSettings.pushNotificationsEnabled
                    ? theme.switchThumbTrue
                    : theme.switchThumbFalse
                }
                ios_backgroundColor={theme.switchIosBg}
                accessibilityLabel="Toggle push notifications"
              />
            </View>

            {notificationSettings.errorMessage ? (
              <Text style={styles.settingError}>
                {notificationSettings.errorMessage}
              </Text>
            ) : null}

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => router.push('/profile/change-password' as Href)}
              accessibilityRole="button"
              accessibilityLabel="Change password"
            >
              <View style={styles.menuRowLeft}>
                <Ionicons name="key-outline" size={20} color={theme.text} />
                <Text style={styles.menuRowText}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleLogout}
              disabled={isLoggingOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <View style={styles.menuRowLeft}>
                <Ionicons name="log-out-outline" size={20} color={theme.errorText} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </View>
              {isLoggingOut ? (
                <ActivityIndicator size="small" color={theme.errorText} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={styles.tabButton}
              onPress={() => setActiveTab('hosted')}
              accessibilityRole="button"
              accessibilityLabel="Show hosted events"
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'hosted' && styles.tabTextActive,
                ]}
              >
                Hosted ({vm.hostedCount})
              </Text>
              <View
                style={[
                  styles.tabIndicator,
                  activeTab === 'hosted' && styles.tabIndicatorActive,
                ]}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabButton}
              onPress={() => setActiveTab('attended')}
              accessibilityRole="button"
              accessibilityLabel="Show attended events"
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'attended' && styles.tabTextActive,
                ]}
              >
                Attended ({vm.attendedCount})
              </Text>
              <View
                style={[
                  styles.tabIndicator,
                  activeTab === 'attended' && styles.tabIndicatorActive,
                ]}
              />
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        {vm.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.text} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : (
          <FlatList
            data={vm.profile ? activeEvents : []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ProfileEventCard
                title={item.title}
                imageUrl={item.image_url}
                categoryLabel={item.category_label}
                startTime={item.start_time}
                status={item.status}
                privacyLevel={item.privacy_level}
                onPress={() => router.push(`/event/${item.id}` as Href)}
              />
            )}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={
              vm.profile ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={32} color={theme.border} />
                  <Text style={styles.emptyTitle}>No {activeTab} events yet</Text>
                  <Text style={styles.emptySubtitle}>
                    {activeTab === 'hosted'
                      ? 'Events you create will show up here.'
                      : 'Events you join will show up here.'}
                  </Text>
                </View>
              ) : null
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onRefresh={vm.refresh}
            refreshing={false}
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
    listContent: {
      paddingBottom: 24,
    },
    screenTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: t.text,
      paddingTop: 16,
      paddingBottom: 18,
    },
    errorBanner: {
      backgroundColor: t.errorBg,
      borderColor: t.errorBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    errorBannerText: {
      color: t.errorText,
      fontSize: 14,
    },
    successBanner: {
      backgroundColor: t.successBg,
      borderColor: t.successBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    successBannerText: {
      color: t.successText,
      fontSize: 14,
      fontWeight: '600',
    },
    retryButton: {
      marginTop: 8,
      alignSelf: 'flex-start',
      backgroundColor: t.errorBorder,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 8,
    },
    retryButtonText: {
      color: t.errorText,
      fontSize: 14,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      paddingVertical: 64,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 12,
      color: t.textSecondary,
      fontSize: 15,
    },
    summaryCard: {
      backgroundColor: t.surface,
      borderRadius: 22,
      padding: 18,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
      marginBottom: 18,
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    avatarButton: {
      position: 'relative',
    },
    avatar: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: t.imagePlaceholder,
    },
    avatarPlaceholder: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: t.imagePlaceholder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 30,
      fontWeight: '700',
      color: t.text,
    },
    avatarEditBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.primaryAlt,
      borderWidth: 2,
      borderColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarUploadOverlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 38,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryTextBlock: {
      flex: 1,
      marginLeft: 14,
    },
    primaryName: {
      fontSize: 17,
      fontWeight: '700',
      color: t.text,
    },
    secondaryName: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textMuted,
      marginTop: 2,
    },
    bioText: {
      fontSize: 14,
      lineHeight: 20,
      color: t.textMuted,
      marginTop: 8,
    },
    summaryInfoSection: {
      gap: 10,
      marginBottom: 20,
    },
    summaryInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    summaryInfoText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: t.textMuted,
      fontWeight: '500',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      gap: 10,
    },
    statsSection: {
      gap: 10,
    },
    statsSectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: t.text,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    statItem: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 14,
      backgroundColor: t.background,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      gap: 3,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
      textAlign: 'center',
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: t.textMuted,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.2,
    },
    menuCard: {
      backgroundColor: t.surface,
      borderRadius: 22,
      paddingHorizontal: 18,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
      marginBottom: 20,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 18,
    },
    menuRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    menuRowText: {
      color: t.text,
      fontSize: 17,
      fontWeight: '600',
    },
    signOutText: {
      color: t.errorText,
      fontSize: 17,
      fontWeight: '600',
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 18,
    },
    settingTextBlock: {
      flex: 1,
    },
    settingSubtitle: {
      color: t.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 3,
    },
    settingError: {
      color: t.errorText,
      fontSize: 13,
      lineHeight: 18,
      marginTop: -6,
      marginBottom: 12,
    },
    menuDivider: {
      height: 1,
      backgroundColor: t.divider,
    },
    tabRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      marginBottom: 18,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
    },
    tabText: {
      fontSize: 16,
      fontWeight: '600',
      color: t.textTertiary,
      paddingBottom: 12,
    },
    tabTextActive: {
      color: t.text,
    },
    tabIndicator: {
      height: 3,
      width: '100%',
      backgroundColor: 'transparent',
      borderRadius: 999,
    },
    tabIndicatorActive: {
      backgroundColor: t.primaryAlt,
    },
    emptyState: {
      paddingVertical: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      marginTop: 14,
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
    },
    emptySubtitle: {
      marginTop: 8,
      fontSize: 14,
      color: t.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 28,
    },
  });
}
