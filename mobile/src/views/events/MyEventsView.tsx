import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import MyEventCard from '@/components/events/MyEventCard';
import InvitationCard from '@/components/invitation/InvitationCard';
import { useMyEventsViewModel } from '@/viewmodels/event/useMyEventsViewModel';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface StatePanelProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

function StatePanel({
  icon,
  title,
  subtitle,
  actionLabel,
  onPressAction,
  theme,
  styles,
}: StatePanelProps & { theme: Theme; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.statePanel}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={24} color={theme.text} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateSubtitle}>{subtitle}</Text>

      {actionLabel && onPressAction ? (
        <TouchableOpacity
          accessibilityLabel={actionLabel}
          activeOpacity={0.85}
          onPress={onPressAction}
          style={styles.stateAction}
        >
          <Text style={styles.stateActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function MyEventsView() {
  const vm = useMyEventsViewModel();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  useFocusEffect(
    React.useCallback(() => {
      void vm.reload();
    }, [vm.reload]),
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>My Events</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{vm.hostedCount}</Text>
              <Text style={styles.summaryLabel}>Hosting</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{vm.attendedCount}</Text>
              <Text style={styles.summaryLabel}>Attending</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabsRow}>
          {vm.statusTabs.map((tab) => {
            const active = tab.value === vm.activeStatus;

            return (
              <TouchableOpacity
                key={tab.value}
                accessibilityLabel={`Show ${tab.label} events`}
                activeOpacity={0.9}
                onPress={() => vm.setActiveStatus(tab.value)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                <Text style={[styles.tabCount, active && styles.tabCountActive]}>
                  {tab.count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.content}>
          {vm.isLoading ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator size="large" color={theme.text} />
              <Text style={styles.loadingText}>Loading your events...</Text>
            </View>
          ) : vm.errorMessage ? (
            <StatePanel
              icon="alert-circle"
              title="Unable to load your events"
              subtitle={vm.errorMessage}
              actionLabel={vm.canRetry ? 'Try again' : undefined}
              onPressAction={vm.canRetry ? () => void vm.reload() : undefined}
              theme={theme}
              styles={styles}
            />
          ) : vm.activeStatus === 'INVITATIONS' && vm.invitations.length === 0 ? (
            <StatePanel
              icon="mail"
              title={vm.emptyTitle}
              subtitle={vm.emptySubtitle}
              theme={theme}
              styles={styles}
            />
          ) : vm.activeStatus !== 'INVITATIONS' && vm.visibleEvents.length === 0 ? (
            <StatePanel
              icon="calendar"
              title={vm.emptyTitle}
              subtitle={vm.emptySubtitle}
              theme={theme}
              styles={styles}
            />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            >
              {vm.activeStatus === 'INVITATIONS' ? (
                vm.invitations.map((invitation) => (
                  <InvitationCard
                    key={invitation.invitation_id}
                    invitation={invitation}
                    onAccept={() => vm.handleAccept(invitation.invitation_id)}
                    onDecline={() => vm.handleDecline(invitation.invitation_id)}
                    onPress={(eventId) => router.push(`/event/${eventId}` as Href)}
                    isActionLoading={vm.isActionLoading === invitation.invitation_id}
                  />
                ))
              ) : (
                vm.visibleEvents.map((event) => (
                  <MyEventCard
                    key={event.id}
                    event={event}
                    onPress={(eventId) => router.push(`/event/${eventId}` as Href)}
                  />
                ))
              )}
            </ScrollView>
          )}
        </View>
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
    headerSection: {
      paddingTop: 14,
    },
    title: {
      fontSize: 30,
      fontWeight: '800',
      color: t.text,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 18,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: t.surface,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: t.border,
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: '800',
      color: t.text,
    },
    summaryLabel: {
      marginTop: 4,
      fontSize: 10,
      fontWeight: '600',
      color: t.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    tabsRow: {
      flexDirection: 'row',
      backgroundColor: t.surfaceAlt,
      borderRadius: 18,
      padding: 5,
      marginTop: 20,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 14,
      gap: 4,
    },
    tabActive: {
      backgroundColor: t.surface,
      shadowColor: t.text,
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    tabText: {
      fontSize: 12,
      fontWeight: '700',
      color: t.textMuted,
    },
    tabTextActive: {
      color: t.text,
    },
    tabCount: {
      fontSize: 12,
      fontWeight: '700',
      color: t.textTertiary,
    },
    tabCountActive: {
      color: t.text,
    },
    content: {
      flex: 1,
      marginTop: 18,
    },
    listContent: {
      paddingBottom: 24,
    },
    loadingPanel: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 48,
    },
    loadingText: {
      marginTop: 12,
      color: t.textMuted,
      fontSize: 15,
    },
    statePanel: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingBottom: 48,
    },
    stateIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: t.infoBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    stateTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: t.text,
      textAlign: 'center',
    },
    stateSubtitle: {
      marginTop: 10,
      color: t.textMuted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
    },
    stateAction: {
      marginTop: 20,
      backgroundColor: t.primaryAlt,
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    stateActionText: {
      color: t.textOnPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
