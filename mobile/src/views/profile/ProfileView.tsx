import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, type Href, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProfileEventCard from '@/components/profile/ProfileEventCard';
import InvitationCard from '@/components/invitation/InvitationCard';
import { useAuth } from '@/contexts/AuthContext';
import { useLogoutViewModel } from '@/viewmodels/auth/useLogoutViewModel';
import { usePushNotificationPreference } from '@/viewmodels/notifications/usePushNotificationPreference';
import { useProfileViewModel } from '@/viewmodels/profile/useProfileViewModel';
import { formatEventLocation } from '@/utils/eventLocation';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import BadgeList from '@/components/profile/BadgeList';
import EquipmentList from '@/components/profile/EquipmentList';
import ShowcaseImageGrid from '@/components/profile/ShowcaseImageGrid';
import { EquipmentItem } from '@/models/profile';

type ProfileEventTab = 'hosted' | 'attended';
const INVITATION_PROFILE_PREVIEW_LIMIT = 1;

export default function ProfileView() {
  const { refreshToken, clearAuth } = useAuth();
  const vm = useProfileViewModel();
  const notificationSettings = usePushNotificationPreference();
  const [activeTab, setActiveTab] = useState<ProfileEventTab>('hosted');
  const { theme, isDark, setThemePreference } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [equipmentModalVisible, setEquipmentModalVisible] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentItem | null>(null);
  const [eqName, setEqName] = useState('');
  const [eqDesc, setEqDesc] = useState('');

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

  const gender = vm.profile?.gender;
  const genderLabel = gender
    ? gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase().replace(/_/g, ' ')
    : 'Gender not set';

  const birthDate = vm.profile?.birth_date;
  const birthDateLabel = birthDate
    ? birthDate.split('-').reverse().join('.')
    : 'Birth date not set';

  const phoneLabel = vm.profile?.phone_number || 'Phone not set';
  const locationLabel = vm.profile?.default_location_address
    ? formatEventLocation(vm.profile.default_location_address)
    : 'Location not set';

  const openAddEquipment = () => {
    setEditingEquipment(null);
    setEqName('');
    setEqDesc('');
    setEquipmentModalVisible(true);
  };

  const openEditEquipment = (item: EquipmentItem) => {
    setEditingEquipment(item);
    setEqName(item.name);
    setEqDesc(item.description || '');
    setEquipmentModalVisible(true);
  };

  const closeEquipmentModal = () => {
    Keyboard.dismiss();
    setEquipmentModalVisible(false);
  };

  const handleSaveEquipment = async () => {
    if (!eqName.trim()) return;
    Keyboard.dismiss();
    if (editingEquipment) {
      await vm.editEquipment(editingEquipment.id, eqName, eqDesc);
    } else {
      await vm.addEquipment(eqName, eqDesc);
    }
    setEquipmentModalVisible(false);
  };

  const renderHeader = () => {
    const previewInvitations = vm.invitations.slice(0, INVITATION_PROFILE_PREVIEW_LIMIT);
    const hasMoreInvitations = vm.invitationCount > INVITATION_PROFILE_PREVIEW_LIMIT;

    return (
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

          <View style={styles.section}>
            <View style={[styles.sectionHeader, { alignItems: 'flex-start' }]}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.sectionTitle}>Badges</Text>
                <Text style={styles.sectionSubtitle}>Achievements earned through hosting, participation, and social activity</Text>
              </View>
              <TouchableOpacity onPress={() => vm.setCatalogVisible(true)} style={{ marginTop: 2 }}>
                <Text style={styles.viewAllActionText}>View All Badges</Text>
              </TouchableOpacity>
            </View>
            <BadgeList 
              badges={vm.badges} 
              catalogVisible={vm.catalogVisible}
              onToggleCatalog={vm.setCatalogVisible}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.sectionTitle}>Invitations</Text>
                <Text style={styles.sectionSubtitle}>Private event invites awaiting your response</Text>
              </View>
              {vm.invitationCount > 0 ? (
                <View style={styles.sectionCountBadge}>
                  <Text style={styles.sectionCountText}>{vm.invitationCount}</Text>
                </View>
              ) : null}
            </View>

            {vm.invitationError ? (
              <View style={styles.sectionMessageCard}>
                <Text style={styles.sectionErrorText}>{vm.invitationError}</Text>
                <TouchableOpacity
                  onPress={vm.refresh}
                  style={styles.sectionRetryButton}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading invitations"
                >
                  <Text style={styles.sectionRetryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : previewInvitations.length > 0 ? (
              <>
                {previewInvitations.map((invitation) => (
                  <InvitationCard
                    key={invitation.invitation_id}
                    invitation={invitation}
                    onAccept={vm.handleAcceptInvitation}
                    onDecline={vm.handleDeclineInvitation}
                    onPress={(eventId) => router.push(`/event/${eventId}` as Href)}
                    isActionLoading={vm.isInvitationActionLoading === invitation.invitation_id}
                    compact
                  />
                ))}

                {hasMoreInvitations ? (
                  <TouchableOpacity
                    style={styles.viewAllInvitationsButton}
                    onPress={() => router.push('/profile/invitations' as Href)}
                    accessibilityRole="button"
                    accessibilityLabel="View all invitations"
                  >
                    <Text style={styles.viewAllInvitationsText}>
                      View all {vm.invitationCount} invitations
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={theme.primaryAlt} />
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              <View style={styles.sectionMessageCard}>
                <Text style={styles.sectionMessageText}>No pending invitations.</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Equipment</Text>
                <Text style={styles.sectionSubtitle}>Gear and essentials this member wants to highlight</Text>
              </View>
              <TouchableOpacity
                onPress={openAddEquipment}
                accessibilityRole="button"
                accessibilityLabel="Add equipment"
              >
                <Ionicons name="add-circle-outline" size={24} color={theme.primaryAlt} />
              </TouchableOpacity>
            </View>
            <EquipmentList 
              equipment={vm.equipment} 
              isOwner 
              onEdit={openEditEquipment} 
              onDelete={vm.removeEquipment} 
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.sectionTitle}>Showcase</Text>
                <Text style={styles.sectionSubtitle}>Moments, snapshots, and visual highlights shared on the profile</Text>
              </View>
              <TouchableOpacity onPress={vm.uploadShowcaseImage}>
                <Ionicons name="add-circle-outline" size={24} color={theme.primaryAlt} />
              </TouchableOpacity>
            </View>
            <ShowcaseImageGrid 
              images={vm.showcaseImages} 
              isOwner 
              onDelete={vm.removeShowcaseImage} 
            />
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

            <View style={styles.settingRow}>
              <View style={styles.menuRowLeft}>
                <Ionicons
                  name={isDark ? 'moon-outline' : 'sunny-outline'}
                  size={20}
                  color={theme.text}
                />
                <View style={styles.settingTextBlock}>
                  <Text style={styles.menuRowText}>Dark Mode</Text>
                  <Text style={styles.settingSubtitle}>
                    {isDark ? 'Dark theme is on' : 'Light theme is on'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={(enabled) =>
                  void setThemePreference(enabled ? 'dark' : 'light')
                }
                trackColor={{ false: theme.switchTrackFalse, true: theme.switchTrackTrue }}
                thumbColor={isDark ? theme.switchThumbTrue : theme.switchThumbFalse}
                ios_backgroundColor={theme.switchIosBg}
                accessibilityLabel="Toggle dark mode"
              />
            </View>

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
  };

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

      <Modal
        visible={equipmentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeEquipmentModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            testID="equipment-modal-dismiss-layer"
            style={styles.modalDismissLayer}
            onPress={Keyboard.dismiss}
          >
            <Pressable style={styles.modalContent} onPress={Keyboard.dismiss}>
              <Text style={styles.modalTitle}>
                {editingEquipment ? 'Edit Equipment' : 'Add Equipment'}
              </Text>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={eqName}
                onChangeText={setEqName}
                placeholder="e.g. Mountain Bike"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={eqDesc}
                onChangeText={setEqDesc}
                placeholder="Brief details about the item..."
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={closeEquipmentModal}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSave, !eqName.trim() && styles.modalSaveDisabled]}
                  onPress={handleSaveEquipment}
                  disabled={!eqName.trim() || vm.isActionLoading}
                >
                  {vm.isActionLoading ? (
                    <ActivityIndicator size="small" color={theme.textOnPrimary} />
                  ) : (
                    <Text style={styles.modalSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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
      color: t.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 28,
    },
    section: {
      marginBottom: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: t.text,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: t.textSecondary,
      marginTop: 2,
    },
    viewAllActionText: {
      fontSize: 13,
      fontWeight: '700',
      color: t.primaryAlt,
    },
    viewAllInvitationsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: t.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 12,
      marginTop: 2,
    },
    viewAllInvitationsText: {
      color: t.primaryAlt,
      fontSize: 14,
      fontWeight: '800',
    },
    sectionCountBadge: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.primaryAlt,
    },
    sectionCountText: {
      color: t.textOnPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    sectionMessageCard: {
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 16,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    sectionMessageText: {
      fontSize: 14,
      color: t.textSecondary,
      fontWeight: '500',
      textAlign: 'center',
    },
    sectionErrorText: {
      fontSize: 14,
      color: t.errorText,
      fontWeight: '500',
      textAlign: 'center',
    },
    sectionRetryButton: {
      backgroundColor: t.errorBorder,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
    },
    sectionRetryButtonText: {
      color: t.errorText,
      fontSize: 14,
      fontWeight: '700',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 20,
    },
    modalDismissLayer: {
      flex: 1,
      justifyContent: 'center',
    },
    modalContent: {
      backgroundColor: t.surface,
      borderRadius: 20,
      padding: 20,
      gap: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: t.text,
      marginBottom: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
    },
    input: {
      backgroundColor: t.background,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      padding: 12,
      color: t.text,
      fontSize: 16,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 8,
    },
    modalCancel: {
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    modalCancelText: {
      color: t.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
    modalSave: {
      backgroundColor: t.primaryAlt,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      minWidth: 80,
      alignItems: 'center',
    },
    modalSaveDisabled: {
      opacity: 0.5,
    },
    modalSaveText: {
      color: t.textOnPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
