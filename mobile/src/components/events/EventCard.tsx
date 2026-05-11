import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { EventSummary } from '@/models/event';
import { getFavoriteCountForDisplay } from '@/utils/eventFavoriteCount';
import { formatEventDateLabel } from '@/utils/eventDate';
import { formatEventLocation } from '@/utils/eventLocation';
import { getEventCategoryPresentation } from '@/utils/eventCategoryPresentation';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface EventCardProps {
  event: EventSummary;
  onPress?: (eventId: string) => void;
}

function formatPrivacyLabel(value: EventSummary['privacy_level']) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default function EventCard({ event, onPress }: EventCardProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const categoryPresentation = getEventCategoryPresentation(
    event.category_name,
    isDark,
  );

  const favoriteCount = getFavoriteCountForDisplay(event);
  const ratingLabel =
    event.host_score.final_score != null && event.host_score.hosted_event_rating_count > 0
      ? `${event.host_score.final_score.toFixed(1)} (${event.host_score.hosted_event_rating_count})`
      : t('profile.new');

  const hostRatingLabel =
    ratingLabel === t('profile.new')
      ? t('events.detail.newHost')
      : t('events.detail.hostRatingLabel', { rating: ratingLabel });

  const participantLabel =
    event.capacity != null
      ? `${event.approved_participant_count}/${event.capacity}`
      : String(event.approved_participant_count);
  const accessibleSummary = `${event.title}. ${categoryPresentation.label}. ${formatPrivacyLabel(event.privacy_level)} event. ${formatEventDateLabel(event.start_time, event.end_time)}. ${formatEventLocation(event.location_address)}. ${participantLabel} participants. ${hostRatingLabel}.`;

  const level = event.privacy_level;
  let badgeBg = theme.badgePublicBg;
  let badgeText = theme.badgePublicText;
  let iconName: 'globe' | 'lock' = 'globe';
  let iconColor = theme.badgePublicText;

  if (level === 'PROTECTED') {
    badgeBg = theme.badgeProtectedBg;
    badgeText = theme.badgeProtectedText;
    iconName = 'lock';
    iconColor = theme.badgeProtectedText;
  } else if (level === 'PRIVATE') {
    badgeBg = theme.badgePrivateBg;
    badgeText = theme.badgePrivateText;
    iconName = 'lock';
    iconColor = theme.badgePrivateText;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onPress?.(event.id)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={accessibleSummary}
    >
      <View style={styles.imageContainer}>
        {event.image_url ? (
          <Image
            source={{ uri: event.image_url }}
            style={styles.image}
            resizeMode="cover"
            accessible={false}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={34} color={theme.textTertiary} />
          </View>
        )}

        <View style={styles.imageOverlay}>
          <View style={styles.imageTopRow}>
            <View style={styles.audienceContainer}>
              {event.child_friendly && (
                <View style={[styles.audienceBadge, { backgroundColor: theme.surface }]}>
                  <MaterialIcons name="child-care" size={14} color={theme.primary} />
                </View>
              )}
              {event.family_oriented && (
                <View style={[styles.audienceBadge, { backgroundColor: theme.surface }]}>
                  <MaterialIcons name="family-restroom" size={14} color={theme.primary} />
                </View>
              )}
            </View>
            <View style={[styles.visibilityBadge, { backgroundColor: badgeBg }]}>
              <Feather name={iconName} size={12} color={iconColor} />
              <Text style={[styles.visibilityBadgeText, { color: badgeText }]}>
                {t(`events.privacy.${level}`)}
              </Text>
            </View>
          </View>

          <View style={styles.imageBottomRow}>
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: categoryPresentation.color },
              ]}
            >
              <Text
                style={[
                  styles.categoryBadgeText,
                  { color: categoryPresentation.textColor },
                ]}
                numberOfLines={1}
              >
                {categoryPresentation.emoji} {categoryPresentation.label}
              </Text>
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
            <Feather name="map-pin" size={18} color={theme.textSecondary} />
            <Text style={styles.metaText}>
              {formatEventLocation(event.location_address)}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Feather name="clock" size={17} color={theme.textSecondary} />
            <Text style={styles.metaText}>
              {formatEventDateLabel(event.start_time, event.end_time)}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Feather name="users" size={18} color={theme.textTertiary} />
            <Text style={styles.statText}>{participantLabel}</Text>
          </View>

          <View style={styles.statItem}>
            <Feather name="heart" size={18} color={theme.textMuted} />
            <Text style={styles.statText}>{favoriteCount}</Text>
          </View>

          <View style={styles.statItem}>
            <MaterialCommunityIcons name="account-star" size={20} color={theme.textMuted} />
            <Text style={styles.ratingText}>{hostRatingLabel}</Text>
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
    audienceContainer: {
      flexDirection: 'row',
      gap: 6,
    },
    audienceBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    imageBottomRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    visibilityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    visibilityBadgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    categoryBadge: {
      maxWidth: '100%',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
    },
    categoryBadgeText: {
      fontSize: 13,
      fontWeight: '700',
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 18,
      backgroundColor: t.surface,
    },
    title: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '700',
      color: t.text,
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
      color: t.textSecondary,
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
      color: t.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    ratingText: {
      color: t.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
