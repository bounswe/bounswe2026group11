import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ReceivedInvitation } from '@/models/invitation';
import { formatEventDateLabel } from '@/utils/eventDate';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface InvitationCardProps {
  invitation: ReceivedInvitation;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onPress?: (eventId: string) => void;
  isActionLoading?: boolean;
}

export default function InvitationCard({
  invitation,
  onAccept,
  onDecline,
  onPress,
  isActionLoading,
}: InvitationCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { event, host, message } = invitation;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.92}
        style={styles.mainContent}
        onPress={() => onPress?.(event.id)}
      >
        <View style={styles.imageWrapper}>
          {event.image_url ? (
            <Image
              source={{ uri: event.image_url }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Feather name="calendar" size={28} color={theme.textTertiary} />
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.statusBadgeRow}>
              <View style={[styles.statusBadge, { backgroundColor: theme.badgePrivateBg }]}>
                <Text style={[styles.statusBadgeText, { color: theme.badgePrivateText }]}>
                  Invited
                </Text>
              </View>

              <View style={[styles.privacyBadge, { backgroundColor: theme.badgePrivateBg }]}>
                <Feather name="lock" size={10} color={theme.badgePrivateText} />
                <Text style={[styles.privacyBadgeText, { color: theme.badgePrivateText }]}>
                  Private
                </Text>
              </View>
            </View>

            <View style={styles.hostPill}>
              <Feather name="user" size={12} color={theme.textMuted} />
              <Text style={styles.hostPillText} numberOfLines={1}>
                {host.display_name || host.username}
              </Text>
            </View>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>

          <View style={styles.metaGroup}>
            <View style={styles.metaRow}>
              <Feather name="clock" size={16} color={theme.textMuted} />
              <Text style={styles.metaText}>
                {formatEventDateLabel(event.start_time)}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Feather name="map-pin" size={16} color={theme.textMuted} />
              <Text style={styles.metaText}>
                Location available on event page
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {message && (
        <View style={styles.messageBox}>
          <Text style={styles.messageLabel}>Note from host:</Text>
          <Text style={styles.messageText}>"{message}"</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={() => onDecline(invitation.invitation_id)}
          disabled={isActionLoading}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => onAccept(invitation.invitation_id)}
          disabled={isActionLoading}
        >
          {isActionLoading ? (
            <ActivityIndicator size="small" color={theme.textOnPrimary} />
          ) : (
            <Text style={styles.acceptButtonText}>Accept</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.surface,
      borderRadius: 24,
      padding: 14,
      marginBottom: 16,
      shadowColor: '#0F172A',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    mainContent: {
      flexDirection: 'row',
      gap: 14,
    },
    imageWrapper: {
      width: 108,
      height: 128,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: t.imagePlaceholder,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imagePlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.imagePlaceholder,
    },
    content: {
      flex: 1,
      justifyContent: 'space-between',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    statusBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    privacyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    privacyBadgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    hostPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.surfaceVariant,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    hostPillText: {
      color: t.textMuted,
      fontSize: 11,
      fontWeight: '700',
      maxWidth: 70,
    },
    title: {
      marginTop: 10,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '800',
      color: t.text,
    },
    metaGroup: {
      marginTop: 12,
      gap: 8,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    metaText: {
      flex: 1,
      color: t.textMuted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500',
    },
    messageBox: {
      backgroundColor: t.surfaceVariant,
      borderRadius: 16,
      padding: 12,
      marginTop: 14,
      borderWidth: 1,
      borderColor: t.border,
    },
    messageLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    messageText: {
      fontSize: 13,
      color: t.textMuted,
      fontStyle: 'italic',
      lineHeight: 18,
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 14,
    },
    actionButton: {
      flex: 1,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    declineButton: {
      backgroundColor: t.errorBg,
      borderWidth: 1,
      borderColor: t.errorBorder,
    },
    declineButtonText: {
      color: t.errorText,
      fontWeight: '700',
      fontSize: 14,
    },
    acceptButton: {
      backgroundColor: t.primary,
    },
    acceptButtonText: {
      color: t.textOnPrimary,
      fontWeight: '700',
      fontSize: 14,
    },
  });
}
