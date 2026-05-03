import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useInvitationsViewModel } from '@/viewmodels/invitation/useInvitationsViewModel';
import InvitationCard from '@/components/invitation/InvitationCard';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export default function InvitationsView() {
  const vm = useInvitationsViewModel();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <MaterialIcons name="mail-outline" size={48} color={theme.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>No invitations yet</Text>
      <Text style={styles.emptySubtitle}>
        Private event invites from your friends and hosts will appear here.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invitations</Text>
        <View style={styles.headerRight} />
      </View>

      {vm.isLoading && vm.invitations.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : vm.error && vm.invitations.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color={theme.errorText} />
          <Text style={styles.errorText}>{vm.error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={vm.fetchInvitations}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={vm.invitations}
          keyExtractor={(item) => item.invitation_id}
          renderItem={({ item }) => (
            <InvitationCard
              invitation={item}
              onAccept={vm.handleAccept}
              onDecline={vm.handleDecline}
              isActionLoading={vm.isActionLoading === item.invitation_id}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={vm.isLoading}
              onRefresh={vm.fetchInvitations}
              colors={['#6366F1']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: t.surface,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
    },
    headerRight: {
      width: 32,
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    listContent: {
      padding: 16,
      flexGrow: 1,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 100,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: t.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: t.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 32,
    },
    errorText: {
      fontSize: 16,
      color: t.textSecondary,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 24,
    },
    retryButton: {
      backgroundColor: '#6366F1',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 16,
    },
  });
}
