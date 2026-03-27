import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { EventSummary } from '@/models/event';
import { formatEventDateLabel } from '@/utils/eventDate';

interface EventCardProps {
  event: EventSummary;
  onPress?: (eventId: string) => void;
}

export default function EventCard({ event, onPress }: EventCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onPress?.(event.id)}
      style={styles.card}
    >
      <View
        style={[styles.imagePlaceholder, { backgroundColor: event.imageAccent }]}
      >
        <View style={styles.imageTopRow}>
          <View style={styles.topSpacer} />
          <View style={styles.visibilityBadge}>
            <Text style={styles.visibilityBadgeText}>{event.visibility}</Text>
          </View>
        </View>

        <View style={styles.imageBottomRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{event.category}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={styles.metaGroup}>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={18} color="#6B7280" />
            <Text style={styles.metaText}>{event.locationName}</Text>
          </View>

          <View style={styles.metaRow}>
            <Feather name="clock" size={17} color="#6B7280" />
            <Text style={styles.metaText}>
              {formatEventDateLabel(event.startTime)}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={18} color="#94A3B8" />
            <Text style={styles.statText}>
              {event.attendeeCount}/{event.capacity}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={18} color="#4B5563" />
            <Text style={styles.statText}>{event.favoriteCount}</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="star" size={18} color="#4B5563" />
            <Text style={styles.ratingText}>{event.rating.toFixed(1)}</Text>
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
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  imagePlaceholder: {
    height: 210,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    justifyContent: 'space-between',
  },
  imageTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topSpacer: {
    width: 1,
    height: 1,
  },
  imageBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  visibilityBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  visibilityBadgeText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  categoryBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  metaGroup: {
    marginBottom: 14,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    marginLeft: 8,
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
  ratingText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
});