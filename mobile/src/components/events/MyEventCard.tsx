import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MyEventBadge, MyEventSummary } from '@/models/event';
import { formatEventDateLabel } from '@/utils/eventDate';
import { formatEventLocation } from '@/utils/eventLocation';
import {
  formatEventStatusLabel,
  getEventStatusBadgeColors,
} from '@/utils/eventStatus';

interface MyEventCardProps {
  event: MyEventSummary;
  onPress?: (eventId: string) => void;
}

function getBadgeStyle(type: MyEventBadge['type']) {
  if (type === 'HOST') {
    return {
      container: styles.contextBadgeHost,
      text: styles.contextBadgeTextHost,
    };
  }

  if (type === 'TICKET') {
    return {
      container: styles.contextBadgeTicket,
      text: styles.contextBadgeTextTicket,
    };
  }

  return {
    container: styles.contextBadgeInvited,
    text: styles.contextBadgeTextInvited,
  };
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
  const statusColors = getEventStatusBadgeColors(event.status);

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
            <Feather name="calendar" size={28} color="#94A3B8" />
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

            {(() => {
              const level = event.privacy_level;
              let badgeStyle = styles.privacyBadgePublic;
              let textStyle = styles.privacyBadgeTextPublic;
              let iconName: 'globe' | 'lock' = 'globe';
              let iconColor = '#1E40AF';

              if (level === 'PROTECTED') {
                badgeStyle = styles.privacyBadgeProtected;
                textStyle = styles.privacyBadgeTextProtected;
                iconName = 'lock';
                iconColor = '#92400E';
              } else if (level === 'PRIVATE') {
                badgeStyle = styles.privacyBadgePrivate;
                textStyle = styles.privacyBadgeTextPrivate;
                iconName = 'lock';
                iconColor = '#5B21B6';
              }

              return (
                <View style={[styles.privacyBadge, badgeStyle]}>
                  <Feather name={iconName} size={10} color={iconColor} />
                  <Text style={[styles.privacyBadgeText, textStyle]}>
                    {level ? level.charAt(0) + level.slice(1).toLowerCase() : ''}
                  </Text>
                </View>
              );
            })()}
          </View>

          <View style={styles.attendeePill}>
            <Feather name="users" size={14} color="#334155" />
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
              const badgeStyle = getBadgeStyle(badge.type);

              return (
                <View
                  key={`${event.id}-${badge.type}-${badge.label}`}
                  style={[styles.contextBadge, badgeStyle.container]}
                >
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
            <Feather name="clock" size={16} color="#64748B" />
            <Text style={styles.metaText}>
              {formatEventDateLabel(event.start_time)}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Feather name="map-pin" size={16} color="#64748B" />
            <Text style={styles.metaText}>
              {getLocationLabel(event.location_address)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#E2E8F0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
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
  privacyBadgePublic: {
    backgroundColor: '#DBEAFE',
  },
  privacyBadgeProtected: {
    backgroundColor: '#FEF3C7',
  },
  privacyBadgePrivate: {
    backgroundColor: '#EDE9FE',
  },
  privacyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  privacyBadgeTextPublic: {
    color: '#1E40AF',
  },
  privacyBadgeTextProtected: {
    color: '#92400E',
  },
  privacyBadgeTextPrivate: {
    color: '#5B21B6',
  },
  attendeePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  attendeePillText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    marginTop: 10,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    color: '#0F172A',
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
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
