import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { EventSummary } from '@/models/event';
import { formatEventDateLabel } from '@/utils/eventDate';
import { formatEventLocation } from '@/utils/eventLocation';

interface EventCardProps {
  event: EventSummary;
  onPress?: (eventId: string) => void;
}

function formatPrivacyLabel(value: EventSummary['privacy_level']) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default function EventCard({ event, onPress }: EventCardProps) {
  const capacity = event.capacity ?? 300;
  const favoriteCount = event.favorite_count ?? 0;
  const ratingLabel =
    event.host_score.final_score != null
      ? event.host_score.final_score.toFixed(1)
      : 'New';

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onPress?.(event.id)}
      style={styles.card}
    >
      <View style={styles.imageContainer}>
        {event.image_url ? (
          <Image
            source={{ uri: event.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={34} color="#9CA3AF" />
          </View>
        )}

        <View style={styles.imageOverlay}>
          <View style={styles.imageTopRow}>
            <View style={styles.topSpacer} />
            <View style={styles.visibilityBadge}>
              <Text style={styles.visibilityBadgeText}>
                {formatPrivacyLabel(event.privacy_level)}
              </Text>
            </View>
          </View>

          <View style={styles.imageBottomRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{event.category_name}</Text>
            </View>
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
            <Text style={styles.metaText}>
              {formatEventLocation(event.location_address)}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Feather name="clock" size={17} color="#6B7280" />
            <Text style={styles.metaText}>
              {formatEventDateLabel(event.start_time)}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={18} color="#94A3B8" />
            <Text style={styles.statText}>
              {event.approved_participant_count}/{capacity}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons
              name={event.is_favorited ? 'heart' : 'heart-outline'}
              size={18}
              color="#4B5563"
            />
            <Text style={styles.statText}>{favoriteCount}</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="star" size={18} color="#4B5563" />
            <Text style={styles.ratingText}>{ratingLabel}</Text>
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
  imageContainer: {
    height: 210,
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    flex: 1,
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