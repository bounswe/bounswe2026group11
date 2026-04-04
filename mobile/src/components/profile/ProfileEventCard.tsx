import React from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { formatEventDateLabel } from '@/utils/eventDate';

interface ProfileEventCardProps {
  title: string;
  imageUrl?: string | null;
  categoryLabel: string;
  startTime: string;
  endTime?: string | null;
  onPress: () => void;
}

export default function ProfileEventCard({
  title,
  imageUrl,
  categoryLabel,
  startTime,
  endTime,
  onPress,
}: ProfileEventCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={28} color="#9CA3AF" />
          </View>
        )}

        <View style={styles.imageOverlay}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.metaRow}>
          <Feather name="clock" size={16} color="#6B7280" />
          <Text style={styles.metaText}>
            {formatEventDateLabel(startTime, endTime)}
          </Text>
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
    height: 180,
    backgroundColor: '#E5E7EB',
    position: 'relative',
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
    padding: 14,
    justifyContent: 'flex-end',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
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
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
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
});
