import React, { useMemo } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { formatEventDateLabel } from '@/utils/eventDate';
import { formatEventLocation } from '@/utils/eventLocation';
import {
  formatEventStatusLabel,
  getEventStatusBadgeColors,
} from '@/utils/eventStatus';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface ProfileEventCardProps {
  title: string;
  imageUrl?: string | null;
  categoryLabel: string;
  startTime: string;
  locationAddress?: string | null;
  status: string;
  privacyLevel: 'PUBLIC' | 'PROTECTED' | 'PRIVATE' | null;
  onPress: () => void;
}

function formatPrivacyLabel(value: NonNullable<ProfileEventCardProps['privacyLevel']>) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default function ProfileEventCard({
  title,
  imageUrl,
  categoryLabel,
  startTime,
  locationAddress,
  status,
  privacyLevel,
  onPress,
}: ProfileEventCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const statusColors = getEventStatusBadgeColors(status);

  let privacyBg = theme.badgePublicBg;
  let privacyText = theme.badgePublicText;
  let privacyIconName: 'globe' | 'lock' = 'globe';
  let privacyIconColor = theme.badgePublicText;

  if (privacyLevel === 'PROTECTED') {
    privacyBg = theme.badgeProtectedBg;
    privacyText = theme.badgeProtectedText;
    privacyIconName = 'lock';
    privacyIconColor = theme.badgeProtectedText;
  } else if (privacyLevel === 'PRIVATE') {
    privacyBg = theme.badgePrivateBg;
    privacyText = theme.badgePrivateText;
    privacyIconName = 'lock';
    privacyIconColor = theme.badgePrivateText;
  }

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
            <Feather name="image" size={28} color={theme.textTertiary} />
          </View>
        )}

        <View style={styles.imageOverlay}>
          <View style={styles.imageTopRow}>
            {privacyLevel ? (
              <View style={[styles.visibilityBadge, { backgroundColor: privacyBg }]}>
                <Feather
                  name={privacyIconName}
                  size={12}
                  color={privacyIconColor}
                />
                <Text style={[styles.visibilityBadgeText, { color: privacyText }]}>
                  {formatPrivacyLabel(privacyLevel)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.imageBottomRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
            </View>

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
                {formatEventStatusLabel(status)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.metaGroup}>
          {locationAddress ? (
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={16} color={theme.textSecondary} />
              <Text style={styles.metaText}>
                {formatEventLocation(locationAddress)}
              </Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <Feather name="clock" size={16} color={theme.textSecondary} />
            <Text style={styles.metaText}>
              {formatEventDateLabel(startTime)}
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
      backgroundColor: t.imagePlaceholder,
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
      backgroundColor: t.imagePlaceholder,
    },
    imageOverlay: {
      ...StyleSheet.absoluteFillObject,
      padding: 14,
      justifyContent: 'space-between',
    },
    imageTopRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      gap: 8,
    },
    imageBottomRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
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
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    statusBadgeText: {
      fontSize: 12,
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
      color: t.text,
      marginBottom: 10,
    },
    metaGroup: {
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
  });
}
