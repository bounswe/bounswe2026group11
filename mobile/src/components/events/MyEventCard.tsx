import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { MyEventBadge, MyEventSummary } from '@/models/event';
import { formatEventDateLabel } from '@/utils/eventDate';
import { formatEventLocation } from '@/utils/eventLocation';
import {
  formatEventStatusLabel,
  getEventStatusBadgeColors,
} from '@/utils/eventStatus';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { getTicketStatusBadgeColors } from '@/utils/ticketStatus';

interface MyEventCardProps {
  event: MyEventSummary;
  onPress?: (eventId: string) => void;
}

function getAttendeeLabel(count?: number | null) {
  if (count == null) {
    return 'N/A';
  }
  return String(count);
}

function getLocationLabel(address?: string | null) {
  if (!address) {
    return 'Location available on event page';
  }
  return formatEventLocation(address);
}

export default function MyEventCard({ event, onPress }: MyEventCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  function formatPrivacyLabel(value: string) {
    return value.charAt(0) + value.slice(1).toLowerCase();
  }

  const getPrivacyDisplay = (level: string) => {
    switch (level) {
      case 'PROTECTED':
        return {
          backgroundColor: theme.badgeProtectedBg,
          textColor: theme.badgeProtectedText,
          icon: 'lock',
        };
      case 'PRIVATE':
        return {
          backgroundColor: theme.badgePrivateBg,
          textColor: theme.badgePrivateText,
          icon: 'lock',
        };
      default:
        return {
          backgroundColor: theme.badgePublicBg,
          textColor: theme.badgePublicText,
          icon: 'globe',
        };
    }
  };

  const { backgroundColor, textColor, icon: privacyIcon } = getPrivacyDisplay(event.privacy_level);
  const privacyColors = { backgroundColor, textColor };

  function getBadgeStyle(
    type: MyEventBadge['type'],
    ticketStatus?: MyEventSummary['ticket_status'],
  ) {
    if (type === 'HOST') {
      return {
        container: styles.contextBadgeHost,
        text: styles.contextBadgeTextHost,
        iconColor: '#4338CA',
      };
    }

    if (type === 'TICKET') {
      const colors = ticketStatus
        ? getTicketStatusBadgeColors(ticketStatus)
        : { backgroundColor: theme.successBg, textColor: theme.successText };

      return {
        container: [styles.contextBadgeTicket, { backgroundColor: colors.backgroundColor }],
        text: [styles.contextBadgeTextTicket, { color: colors.textColor }],
        iconColor: colors.textColor,
      };
    }

    return {
      container: styles.contextBadgeInvited,
      text: styles.contextBadgeTextInvited,
      iconColor: '#B45309',
    };
  }

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={styles.card}
      onPress={() => onPress?.(event.id)}
    >
      <View style={styles.imageWrapper}>
        {event.image_url ? (
          <Image source={{ uri: event.image_url }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={28} color={theme.borderStrong} />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.statusBadgeRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: privacyColors.backgroundColor },
              ]}
            >
              <Feather 
                name={privacyIcon as any} 
                size={12} 
                color={privacyColors.textColor} 
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: privacyColors.textColor },
                ]}
              >
                {formatPrivacyLabel(event.privacy_level)}
              </Text>
            </View>
          </View>

          <View style={styles.attendeePill}>
            <Feather name="users" size={14} color={theme.textMuted} />
            <Text style={styles.attendeePillText}>
              {getAttendeeLabel(event.approved_participant_count)}
            </Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        {event.badges.length > 0 ? (
          <View style={styles.badgeRow}>
            {event.badges.map((badge) => {
              const badgeStyle = getBadgeStyle(badge.type, event.ticket_status);

              return (
                <View
                  key={`${event.id}-${badge.type}-${badge.label}`}
                  style={[styles.contextBadge, badgeStyle.container]}
                >
                  {badge.type === 'TICKET' ? (
                    <MaterialIcons
                      name="qr-code-2"
                      size={14}
                      color={badgeStyle.iconColor as any}
                    />
                  ) : null}
                  <Text style={[styles.contextBadgeText, badgeStyle.text]}>
                    {badge.label}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

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
              {getLocationLabel(event.location_address)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.surface,
      borderRadius: 24,
      padding: 14,
      marginBottom: 16,
      flexDirection: 'row',
      gap: 14,
      shadowColor: '#0F172A',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
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
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    attendeePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.surfaceVariant,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    attendeePillText: {
      color: t.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    title: {
      marginTop: 10,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '800',
      color: t.text,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    contextBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    contextBadgeHost: {
      backgroundColor: '#E0E7FF',
    },
    contextBadgeTicket: {
      backgroundColor: '#DCFCE7',
    },
    contextBadgeInvited: {
      backgroundColor: '#FEF3C7',
    },
    contextBadgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    contextBadgeTextHost: {
      color: '#4338CA',
    },
    contextBadgeTextTicket: {
      color: '#166534',
    },
    contextBadgeTextInvited: {
      color: '#B45309',
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
  });
}
