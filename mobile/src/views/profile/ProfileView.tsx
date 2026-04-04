import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, type Href, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomTabBar from '@/components/common/BottomTabBar';
import ProfileEventCard from '@/components/profile/ProfileEventCard';
import { useAuth } from '@/contexts/AuthContext';
import { useLogoutViewModel } from '@/viewmodels/auth/useLogoutViewModel';
import { useProfileViewModel } from '@/viewmodels/profile/useProfileViewModel';

type ProfileEventTab = 'hosted' | 'attended';

export default function ProfileView() {
  const { refreshToken, clearAuth } = useAuth();
  const vm = useProfileViewModel();
  const [activeTab, setActiveTab] = useState<ProfileEventTab>('hosted');
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
  const locationLabel = vm.profile?.default_location_address || 'Location not set';

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

      {vm.profile ? (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
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

              <View style={styles.summaryTextBlock}>
                <Text
                  style={styles.primaryName}
                  numberOfLines={2}
                  accessibilityLabel="Display name"
                >
                  {vm.primaryName}
                  {vm.secondaryName ? (
                    <Text style={styles.inlineUsername}>
                      {' '}
                      ({vm.secondaryName})
                    </Text>
                  ) : null}
                </Text>
                {vm.profile.bio ? (
                  <Text style={styles.bioText} numberOfLines={2}>
                    {vm.profile.bio}
                  </Text>
                ) : vm.secondaryName ? (
                  <Text
                    style={styles.secondaryName}
                    numberOfLines={1}
                    accessibilityLabel="Username"
                  >
                    @{vm.secondaryName}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.summaryInfoSection}>
              <View style={styles.summaryInfoRow}>
                <Ionicons name="mail-outline" size={18} color="#111827" />
                <Text style={styles.summaryInfoText} numberOfLines={1}>
                  {vm.profile.email}
                </Text>
              </View>

              <View style={styles.summaryInfoRow}>
                <Ionicons name="call-outline" size={18} color="#111827" />
                <Text style={styles.summaryInfoText} numberOfLines={1}>
                  {phoneLabel}
                </Text>
              </View>

              <View style={styles.summaryInfoRow}>
                <Ionicons name="person-outline" size={18} color="#111827" />
                <Text style={styles.summaryInfoText} numberOfLines={1}>
                  {genderLabel}
                </Text>
              </View>

              <View style={styles.summaryInfoRow}>
                <Ionicons name="calendar-outline" size={18} color="#111827" />
                <Text style={styles.summaryInfoText} numberOfLines={1}>
                  {birthDateLabel}
                </Text>
              </View>

              <View style={styles.summaryInfoRow}>
                <Ionicons name="location-outline" size={18} color="#111827" />
                <Text style={styles.summaryInfoText} numberOfLines={2}>
                  {locationLabel}
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{vm.hostedCount}</Text>
                <Text style={styles.statLabel}>Hosted</Text>
              </View>

              <View style={styles.statItem}>
                <Text style={styles.statValue}>{vm.attendedCount}</Text>
                <Text style={styles.statLabel}>Attended</Text>
              </View>

              <View style={styles.statItem}>
                <Text style={styles.statValue}>{vm.hostedCount + vm.attendedCount}</Text>
                <Text style={styles.statLabel}>Total</Text>
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
                <Ionicons name="create-outline" size={20} color="#111827" />
                <Text style={styles.menuRowText}>Edit Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
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
                <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </View>
              {isLoggingOut ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
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
            <ActivityIndicator size="large" color="#0F172A" />
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
                endTime={item.end_time}
                onPress={() => router.push(`/event/${item.id}` as Href)}
              />
            )}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={
              vm.profile ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={32} color="#CBD5E1" />
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

      <BottomTabBar />
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
  listContent: {
    paddingBottom: 24,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    paddingTop: 16,
    paddingBottom: 18,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
  },
  retryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#DC2626',
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
    color: '#6B7280',
    fontSize: 15,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
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
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
  },
  summaryTextBlock: {
    flex: 1,
    marginLeft: 14,
  },
  primaryName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  inlineUsername: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  secondaryName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 4,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    marginTop: 4,
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
    color: '#475569',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
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
    color: '#111827',
    fontSize: 17,
    fontWeight: '600',
  },
  signOutText: {
    color: '#DC2626',
    fontSize: 17,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    paddingBottom: 12,
  },
  tabTextActive: {
    color: '#111827',
  },
  tabIndicator: {
    height: 3,
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 999,
  },
  tabIndicatorActive: {
    backgroundColor: '#0F172A',
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
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 28,
  },
});
