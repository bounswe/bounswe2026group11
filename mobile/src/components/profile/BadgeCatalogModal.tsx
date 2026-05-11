import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BadgeItem } from '@/models/profile';
import { getBadgeCatalog } from '@/services/profileService';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import BadgeDetailModal from './BadgeDetailModal';

interface BadgeCatalogModalProps {
  visible: boolean;
  onClose: () => void;
  earnedBadges: BadgeItem[];
}

export default function BadgeCatalogModal({ visible, onClose, earnedBadges }: BadgeCatalogModalProps) {
  const { token } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const [allBadges, setAllBadges] = useState<BadgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null);

  useEffect(() => {
    if (visible && token) {
      fetchCatalog();
    }
  }, [visible, token]);

  const fetchCatalog = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const result = await getBadgeCatalog(token);
      // Merge earned status
      const merged: BadgeItem[] = result.items.map(b => {
        const earnedMatch = earnedBadges.find(eb => eb.slug === b.slug);
        return {
          ...b,
          earned: !!earnedMatch && earnedMatch.earned,
          earned_at: earnedMatch?.earned_at || null,
          progress_hint: b.progress_hint || null
        };
      });
      setAllBadges(merged);
    } catch (err) {
      console.error('Failed to fetch badge catalog:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderBadgeItem = ({ item }: { item: BadgeItem }) => (
    <TouchableOpacity 
      style={styles.badgeCard} 
      onPress={() => setSelectedBadge(item)}
    >
      <View style={[styles.iconWrapper, !item.earned && styles.lockedIcon]}>
        {item.icon_url ? (
          <Image source={{ uri: item.icon_url }} style={styles.icon} />
        ) : (
          <Text style={styles.emojiIcon}>{getEmojiForBadge(item.slug)}</Text>
        )}
        {!item.earned && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.7)" />
          </View>
        )}
      </View>
      <Text style={styles.badgeName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.badgeStatus}>
        {item.earned ? t('publicProfile.badges.earned') : t('publicProfile.badges.locked')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="chevron-down" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('publicProfile.badges.catalogTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primaryAlt} />
          </View>
        ) : (
          <FlatList
            data={allBadges}
            keyExtractor={(item) => item.id || item.slug}
            renderItem={renderBadgeItem}
            numColumns={3}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
              <Text style={styles.emptyText}>{t('publicProfile.empty.badgeCatalog')}</Text>
            }
          />
        )}

        <BadgeDetailModal 
          badge={selectedBadge}
          visible={!!selectedBadge}
          onClose={() => setSelectedBadge(null)}
        />
      </View>
    </Modal>
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
    flex: 1,
    backgroundColor: t.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: t.surface,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: t.text,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  badgeCard: {
    flex: 1,
    maxWidth: '31%',
    alignItems: 'center',
    backgroundColor: t.surface,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: t.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  lockedIcon: {
    opacity: 0.6,
  },
  icon: {
    width: 40,
    height: 40,
  },
  emojiIcon: {
    fontSize: 32,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '700',
    color: t.text,
    textAlign: 'center',
  },
  badgeStatus: {
    fontSize: 10,
    color: t.textMuted,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: t.textSecondary,
  },
});
