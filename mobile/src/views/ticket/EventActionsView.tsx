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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useEventActionsViewModel } from '@/viewmodels/ticket/useEventActionsViewModel';
import { formatEventDateLabel } from '@/utils/eventDate';
import { formatEventLocation } from '@/utils/eventLocation';
import EventCategoryChip from '@/components/events/EventCategoryChip';
import { useTheme, type Theme } from '@/theme';

interface EventActionsViewProps {
  eventId: string;
}

export default function EventActionsView({ eventId }: EventActionsViewProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const vm = useEventActionsViewModel(eventId);

  const handlePrimaryAction = React.useCallback(() => {
    if (vm.canScanTicket) {
      router.push(`/event/${eventId}/scan-ticket` as Href);
      return;
    }

    if (vm.canOpenTicket && vm.ticket) {
      router.push(`/ticket/${vm.ticket.ticket_id}` as Href);
    }
  }, [eventId, vm.canOpenTicket, vm.canScanTicket, vm.ticket]);

  if (vm.isLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.loadingPanel}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading event details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (vm.errorMessage || !vm.event) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.container}>
          <TouchableOpacity
            accessibilityLabel="Go back"
            activeOpacity={0.8}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={26} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Unable to open this event</Text>
            <Text style={styles.errorText}>
              {vm.errorMessage ?? 'Something went wrong while loading event actions.'}
            </Text>
            <TouchableOpacity
              accessibilityLabel="Try again"
              activeOpacity={0.85}
              onPress={() => void vm.reload()}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const { event } = vm;
  const hostName = event.host.display_name?.trim() || event.host.username;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              accessibilityLabel="Go back"
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={26} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Event Details</Text>
          </View>

          <View style={styles.heroCard}>
            {event.image_url ? (
              <Image source={{ uri: event.image_url }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]}>
                <Feather name="calendar" size={32} color={theme.textTertiary} />
              </View>
            )}
          </View>

          <Text style={styles.eventTitle}>{event.title}</Text>

          {event.category ? (
            <View style={styles.categoryChipWrap}>
              <EventCategoryChip
                categoryName={event.category.name}
                testID="event-actions-category-chip"
              />
            </View>
          ) : null}

          <View style={styles.metaGroup}>
            <View style={styles.metaRow}>
              <Feather name="calendar" size={21} color={theme.textSecondary} />
              <Text style={styles.metaText}>
                {formatEventDateLabel(event.start_time, event.end_time)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={21} color={theme.textSecondary} />
              <Text style={styles.metaText}>
                {formatEventLocation(event.location.address)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Feather name="users" size={21} color={theme.textSecondary} />
              <Text style={styles.metaText}>
                {event.approved_participant_count}
                {event.capacity ? ` participants / ${event.capacity}` : ' participants'}
              </Text>
            </View>
          </View>

          {event.description ? (
            <Text style={styles.descriptionText}>{event.description}</Text>
          ) : null}

          <View style={styles.hostCard}>
            <View style={styles.hostAvatar}>
              <Text style={styles.hostAvatarText}>{hostName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.hostInfo}>
              <Text style={styles.hostName}>{hostName}</Text>
              <Text style={styles.hostLabel}>Event host</Text>
            </View>
          </View>

          {vm.primaryActionLabel ? (
            <TouchableOpacity
              accessibilityLabel={vm.primaryActionLabel}
              activeOpacity={0.9}
              onPress={handlePrimaryAction}
              style={styles.primaryButton}
            >
              <Feather
                name={vm.canScanTicket ? 'camera' : 'grid'}
                size={20}
                color={theme.textOnPrimary}
              />
              <Text style={styles.primaryButtonText}>{vm.primaryActionLabel}</Text>
            </TouchableOpacity>
          ) : null}

          {vm.canEditEvent ? (
            <TouchableOpacity
              accessibilityLabel="Edit event"
              activeOpacity={0.9}
              onPress={() => router.push(`/event/${eventId}/edit` as Href)}
              style={styles.editButton}
            >
              <Feather name="edit-3" size={20} color={theme.textOnPrimary} />
              <Text style={styles.editButtonText}>Edit Event</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            accessibilityLabel="View full event"
            activeOpacity={0.9}
            onPress={() => router.push(`/event/${eventId}` as Href)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>View Full Event</Text>
            <Ionicons name="chevron-forward" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.background,
    },
    scrollContent: {
      paddingBottom: 32,
    },
    container: {
      paddingHorizontal: 24,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      paddingTop: 12,
      paddingBottom: 18,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: t.text,
    },
    backButton: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
    },
    heroCard: {
      overflow: 'hidden',
      borderRadius: 28,
      backgroundColor: t.surfaceAlt,
    },
    heroImage: {
      width: '100%',
      aspectRatio: 2.1,
    },
    heroPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventTitle: {
      marginTop: 24,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
      color: t.text,
    },
    categoryChipWrap: {
      marginTop: 14,
    },
    metaGroup: {
      marginTop: 24,
      gap: 16,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    metaText: {
      flex: 1,
      fontSize: 17,
      lineHeight: 24,
      fontWeight: '500',
      color: t.textSecondary,
    },
    descriptionText: {
      marginTop: 26,
      fontSize: 17,
      lineHeight: 28,
      color: t.textSecondary,
      fontWeight: '500',
    },
    hostCard: {
      marginTop: 28,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 18,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    hostAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceAlt,
    },
    hostAvatarText: {
      fontSize: 20,
      fontWeight: '700',
      color: t.text,
    },
    hostInfo: {
      flex: 1,
    },
    hostName: {
      fontSize: 16,
      fontWeight: '700',
      color: t.text,
    },
    hostLabel: {
      marginTop: 2,
      fontSize: 13,
      color: t.textSecondary,
    },
    primaryButton: {
      marginTop: 24,
      minHeight: 66,
      borderRadius: 22,
      backgroundColor: t.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    primaryButtonText: {
      fontSize: 18,
      fontWeight: '800',
      color: t.textOnPrimary,
    },
    editButton: {
      marginTop: 14,
      minHeight: 58,
      borderRadius: 18,
      backgroundColor: t.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    editButtonText: {
      fontSize: 17,
      fontWeight: '800',
      color: t.textOnPrimary,
    },
    secondaryButton: {
      marginTop: 18,
      minHeight: 66,
      borderRadius: 22,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.borderStrong,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    secondaryButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
    },
    loadingPanel: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
    },
    loadingText: {
      fontSize: 16,
      color: t.textSecondary,
    },
    errorPanel: {
      marginTop: 48,
      borderRadius: 24,
      backgroundColor: t.surfaceVariant,
      padding: 24,
    },
    errorTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: t.text,
    },
    errorText: {
      marginTop: 12,
      fontSize: 16,
      lineHeight: 24,
      color: t.textSecondary,
    },
    retryButton: {
      marginTop: 20,
      alignSelf: 'flex-start',
      borderRadius: 16,
      backgroundColor: t.primary,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    retryButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: t.textOnPrimary,
    },
  });
}
