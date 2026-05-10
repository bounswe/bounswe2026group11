import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePublicProfileViewModel } from '@/viewmodels/profile/usePublicProfileViewModel';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import BadgeList from '@/components/profile/BadgeList';
import EquipmentList from '@/components/profile/EquipmentList';
import ShowcaseImageGrid from '@/components/profile/ShowcaseImageGrid';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vm = usePublicProfileViewModel(id);
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (vm.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.text} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (vm.error || !vm.profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.errorText} />
          <Text style={styles.errorText}>{vm.error || 'Profile not found'}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const profile = vm.profile;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.customHeader}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.customHeaderBack}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.customHeaderTitle} numberOfLines={1}>
          {profile.display_name || profile.username}
        </Text>
        <View style={{ width: 48 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <View style={styles.avatarSection}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{vm.avatarInitial}</Text>
              </View>
            )}
            <View style={styles.nameBlock}>
              <Text style={styles.primaryName}>{vm.primaryName}</Text>
              <Text style={styles.secondaryName}>@{profile.username}</Text>
            </View>
          </View>
          
          {profile.bio ? (
            <Text style={styles.bioText}>{profile.bio}</Text>
          ) : null}

          <View style={styles.ratingCard}>
            <View style={styles.ratingLeft}>
              <Ionicons 
                name="star" 
                size={28} 
                color={isDark ? "#FFFFFF" : theme.text} 
              />
              <Text style={styles.ratingValue}>{vm.overallRatingLabel}</Text>
            </View>
            <View style={styles.ratingRight}>
              <Text style={styles.ratingCount}>
                {profile.host_rating_count + profile.participant_rating_count} ratings collected
              </Text>
              <Text style={styles.ratingBreakdown}>
                Host: {profile.host_rating_count} · Part: {profile.participant_rating_count}
              </Text>
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
            <View>
              <Text style={styles.sectionTitle}>Equipment</Text>
              <Text style={styles.sectionSubtitle}>Gear and essentials this member wants to highlight</Text>
            </View>
          </View>
          <EquipmentList equipment={profile.equipment} isOwner={false} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Showcase</Text>
              <Text style={styles.sectionSubtitle}>Moments, snapshots, and visual highlights shared on the profile</Text>
            </View>
          </View>
          <ShowcaseImageGrid images={profile.showcase_images || []} isOwner={false} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: t.background,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 4,
    backgroundColor: t.background,
  },
  customHeaderBack: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: t.text,
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: t.textSecondary,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: t.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: t.primaryAlt,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: t.surface,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 24,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: t.imagePlaceholder,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: t.imagePlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: t.text,
  },
  nameBlock: {
    marginLeft: 16,
    flex: 1,
  },
  primaryName: {
    fontSize: 22,
    fontWeight: '800',
    color: t.text,
  },
  secondaryName: {
    fontSize: 15,
    color: t.textMuted,
    marginTop: 2,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: t.textSecondary,
    marginBottom: 20,
  },
  ratingCard: {
    backgroundColor: t.surface, // Use theme surface color
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: t.border,
  },
  ratingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  ratingValue: {
    fontSize: 28,
    fontWeight: '800',
    color: t.text,
    marginLeft: 8,
  },
  ratingCount: {
    fontSize: 14,
    fontWeight: '600',
    color: t.text,
    marginBottom: 2,
  },
  ratingBreakdown: {
    fontSize: 12,
    color: t.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: t.text,
    paddingLeft: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: t.textSecondary,
    paddingLeft: 4,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: t.primaryAlt,
  },
});
