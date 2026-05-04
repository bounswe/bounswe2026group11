import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MyEventBadge, MyEventSummary } from '@/models/event';
import { formatEventDateLabel } from '@/utils/eventDate';
import { formatEventLocation } from '@/utils/eventLocation';
import {
  formatEventStatusLabel,
  getEventStatusBadgeColors,
} from '@/utils/eventStatus';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

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

  const statusColors = getEventStatusBadgeColors(event.status);

  const level = event.privacy_level;
  let privacyBg = theme.badgePublicBg;
  let privacyText = theme.badgePublicText;
  let privacyIconName: 'globe' | 'lock' = 'globe';
  let privacyIconColor = theme.badgePublicText;

  if (level === 'PROTECTED') {
    privacyBg = theme.badgeProtectedBg;
    privacyText = theme.badgeProtectedText;
    privacyIconName = 'lock';
    privacyIconColor = theme.badgeProtectedText;
  } else if (level === 'PRIVATE') {
    privacyBg = theme.badgePrivateBg;
    privacyText = theme.badgePrivateText;
    privacyIconName = 'lock';
    privacyIconColor = theme.badgePrivateText;
  }

  function getBadgeColors(type: MyEventBadge['type']) {
    if (type === 'HOST') return { bg: theme.badgeHostBg, text: theme.badgeHostText };
    if (type === 'TICKET') return { bg: theme.badgeTicketBg, text: theme.badgeTicketText };
    return { bg: theme.badgeInvitedBg, text: theme.badgeInvitedText };
  }

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.card}
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
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColors.backgroundColor },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: statusColors.textColor },
                ]}
              >
                {formatEventStatusLabel(event.status)}
              </Text>
            </View>

            <View style={[styles.privacyBadge, { backgroundColor: privacyBg }]}>
              <Feather name={privacyIconName} size={10} color={privacyIconColor} />
              <Text style={[styles.privacyBadgeText, { color: privacyText }]}>
                {level ? level.charAt(0) + level.slice(1).toLowerCase() : ''}
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
              const colors = getBadgeColors(badge.type);

              return (
                <View
                  key={`${event.id}-${badge.type}-${badge.label}`}
                  style={[styles.contextBadge, { backgroundColor: colors.bg }]}
                >
                  <Text style={[styles.contextBadgeText, { color: colors.text }]}>
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
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    contextBadgeText: {
      fontSize: 12,
      fontWeight: '700',
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
