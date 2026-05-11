import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BadgeItem } from '@/models/profile';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import BadgeDetailModal from './BadgeDetailModal';
import BadgeCatalogModal from './BadgeCatalogModal';

interface BadgeListProps {
  badges: BadgeItem[];
  showCatalogButton?: boolean;
  catalogVisible?: boolean;
  onToggleCatalog?: (visible: boolean) => void;
}

export default function BadgeList({ 
  badges, 
  showCatalogButton = true,
  catalogVisible: externalCatalogVisible,
  onToggleCatalog
}: BadgeListProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null);
  const [internalCatalogVisible, setInternalCatalogVisible] = useState(false);

  const isCatalogVisible = externalCatalogVisible !== undefined ? externalCatalogVisible : internalCatalogVisible;
  const setCatalogVisible = onToggleCatalog || setInternalCatalogVisible;

  if (badges.length === 0 && !showCatalogButton) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('publicProfile.empty.badges')}</Text>
      </View>
    );
  }

  return (
    <View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.container}
      >
        {badges.map((badge) => (
          <TouchableOpacity 
            key={badge.id || badge.slug} 
            style={styles.badgeCard}
            onPress={() => setSelectedBadge(badge)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrapper, !badge.earned && styles.lockedIcon]}>
              {badge.icon_url ? (
                <Image source={{ uri: badge.icon_url }} style={styles.icon} />
              ) : (
                <Text style={styles.emojiIcon}>{getEmojiForBadge(badge.slug)}</Text>
              )}
              {!badge.earned && (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.8)" />
                </View>
              )}
            </View>
            <Text style={styles.badgeName} numberOfLines={1}>{badge.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <BadgeDetailModal 
        badge={selectedBadge}
        visible={!!selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />

      <BadgeCatalogModal 
        visible={isCatalogVisible}
        onClose={() => setCatalogVisible(false)}
        earnedBadges={badges}
      />
    </View>
  );
}

function getEmojiForBadge(slug: string): string {
  const bySlug: Record<string, string> = {
    FIRST_STEPS: '👣',
    REGULAR: '🎟️',
    VETERAN: '🏅',
    EXPLORER: '🧭',
    HOST_DEBUT: '🎤',
    SUPER_HOST: '🌟',
    TOP_RATED: '⭐',
    FAVORITE_FINDER: '📍',
  };
  return bySlug[slug] || '🏅';
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingVertical: 10,
    gap: 16,
  },
  badgeCard: {
    width: 80,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: t.surface,
    borderWidth: 2,
    borderColor: t.primaryAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  lockedIcon: {
    borderColor: t.border,
    opacity: 0.6,
  },
  icon: {
    width: 40,
    height: 40,
  },
  emojiIcon: {
    fontSize: 28,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeName: {
    fontSize: 11,
    fontWeight: '600',
    color: t.text,
    textAlign: 'center',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    borderStyle: 'dashed',
    width: '100%',
  },
  emptyText: {
    fontSize: 14,
    color: t.textSecondary,
    fontWeight: '500',
  },
});
