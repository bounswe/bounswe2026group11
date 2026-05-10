import React, { useRef } from 'react';
import { StyleSheet, View, Text, Image, Modal, TouchableOpacity, ScrollView, PanResponder, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BadgeItem } from '@/models/profile';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const { height } = Dimensions.get('window');

interface BadgeDetailModalProps {
  badge: BadgeItem | null;
  visible: boolean;
  onClose: () => void;
}

export default function BadgeDetailModal({ badge, visible, onClose }: BadgeDetailModalProps) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  
  const panY = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5; // Swipe down to close
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(panY, {
            toValue: height,
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            onClose();
            panY.setValue(0);
          });
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  if (!badge) return null;

  const earnedDate = badge.earned_at 
    ? new Date(badge.earned_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Not yet earned';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose} 
        />
        <Animated.View 
          style={[
            styles.content,
            { transform: [{ translateY: panY }] }
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handleWrapper}>
            <View style={styles.handle} />
          </View>
          
          <View style={styles.scrollContent}>
            <View style={styles.iconContainer}>
              <View style={[styles.iconWrapper, !badge.earned && styles.lockedIcon]}>
                {badge.icon_url ? (
                  <Image source={{ uri: badge.icon_url }} style={styles.icon} />
                ) : (
                  <Text style={styles.emojiIcon}>{getEmojiForBadge(badge.slug)}</Text>
                )}
                {!badge.earned && (
                  <View style={styles.lockOverlay}>
                    <Ionicons name="lock-closed" size={32} color="rgba(255,255,255,0.8)" />
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.name}>{badge.name}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{badge.category || 'Achievement'}</Text>
            </View>

            <Text style={styles.description}>{badge.description}</Text>

            <View style={styles.earnedSection}>
              <Ionicons 
                name={badge.earned ? "checkmark-circle" : "time-outline"} 
                size={20} 
                color={badge.earned ? theme.successText : theme.textMuted} 
              />
              <Text style={[styles.earnedText, !badge.earned && styles.notEarnedText]}>
                {badge.earned 
                  ? (badge.earned_at ? `Earned on ${earnedDate}` : 'Earned') 
                  : 'Not yet earned'}
              </Text>
            </View>

            {!badge.earned && !!badge.progress_hint && (
              <View style={styles.progressHintBox}>
                <Text style={styles.progressHintTitle}>How to earn:</Text>
                <Text style={styles.progressHintText}>{badge.progress_hint}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: t.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handleWrapper: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.border,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  iconContainer: {
    marginBottom: 24,
    marginTop: 12,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: t.background,
    borderWidth: 4,
    borderColor: t.primaryAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  lockedIcon: {
    borderColor: t.border,
    opacity: 0.8,
  },
  icon: {
    width: 80,
    height: 80,
  },
  emojiIcon: {
    fontSize: 60,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: t.text,
    textAlign: 'center',
  },
  categoryBadge: {
    backgroundColor: t.background,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: t.border,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: t.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 10,
  },
  earnedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 8,
  },
  earnedText: {
    fontSize: 14,
    fontWeight: '600',
    color: t.successText,
  },
  notEarnedText: {
    color: t.textMuted,
  },
  progressHintBox: {
    backgroundColor: t.background,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginTop: 24,
    borderLeftWidth: 4,
    borderLeftColor: t.primaryAlt,
  },
  progressHintTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: t.text,
    marginBottom: 4,
  },
  progressHintText: {
    fontSize: 14,
    color: t.textSecondary,
    lineHeight: 20,
  },
  closeButton: {
    marginTop: 32,
    backgroundColor: t.primaryAlt,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
