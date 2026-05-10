import React from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { EventDetailApprovedParticipant } from '@/models/event';
import { useTheme, type Theme } from '@/theme';

const FEEDBACK_MIN_LENGTH = 10;
const FEEDBACK_MAX_LENGTH = 100;

function getFeedbackValidationMessage(message: string): string | null {
  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length < FEEDBACK_MIN_LENGTH) {
    return `Feedback must be at least ${FEEDBACK_MIN_LENGTH} characters.`;
  }

  if (trimmed.length > FEEDBACK_MAX_LENGTH) {
    return `Feedback must be ${FEEDBACK_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}

function renderStars(rating: number): string {
  return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function StarRatingInput({
  value,
  onChange,
  disabled,
  styles,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(star)}
            disabled={disabled}
            activeOpacity={0.7}
            style={styles.starButton}
          >
            <Text style={[styles.starIcon, active && styles.starIconActive]}>★</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ParticipantRow({
  participant,
  canRateParticipants,
  ratingLoadingId,
  ratingError,
  onSubmitRating,
  onDismissRatingError,
  onCloseModal,
  theme,
  styles,
}: {
  participant: EventDetailApprovedParticipant;
  canRateParticipants: boolean;
  ratingLoadingId: string | null;
  ratingError: { participantUserId: string; message: string } | null;
  onSubmitRating: (participantUserId: string, rating: number, message?: string) => void;
  onDismissRatingError: () => void;
  onCloseModal: () => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  const existingRating = participant.host_rating;
  const [isEditing, setIsEditing] = React.useState(false);
  const [rating, setRating] = React.useState(existingRating?.rating ?? 0);
  const [message, setMessage] = React.useState(existingRating?.message ?? '');
  const ratingStampRef = React.useRef<string | null>(
    existingRating ? `${existingRating.id}:${existingRating.updated_at}` : null,
  );
  const isLoading = ratingLoadingId === participant.user.id;
  const rowError =
    ratingError?.participantUserId === participant.user.id ? ratingError.message : null;
  const validationMessage = getFeedbackValidationMessage(message);
  const trimmedLength = message.trim().length;

  React.useEffect(() => {
    setRating(existingRating?.rating ?? 0);
    setMessage(existingRating?.message ?? '');
  }, [existingRating?.id, existingRating?.message, existingRating?.rating]);

  React.useEffect(() => {
    const nextStamp = existingRating ? `${existingRating.id}:${existingRating.updated_at}` : null;
    const previousStamp = ratingStampRef.current;

    if (
      isEditing &&
      nextStamp &&
      previousStamp !== nextStamp &&
      !isLoading &&
      !rowError
    ) {
      setIsEditing(false);
    }

    ratingStampRef.current = nextStamp;
  }, [existingRating?.id, existingRating?.updated_at, isEditing, isLoading, rowError]);

  return (
    <View style={styles.participantCard}>
      <TouchableOpacity 
        style={styles.participantRow}
        onPress={() => {
          onCloseModal();
          router.push(`/user/${participant.user.id}` as Href);
        }}
        activeOpacity={0.7}
      >
        {participant.user.avatar_url ? (
          <Image
            source={{ uri: participant.user.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Feather name="user" size={20} color={theme.textTertiary} />
          </View>
        )}

        <View style={styles.info}>
          <View style={styles.userTopline}>
            <Text style={styles.name}>
              {participant.user.display_name || participant.user.username}
            </Text>
            {participant.user.final_score != null ? (
              <Text style={styles.userScore}>
                ★ {participant.user.final_score.toFixed(1)} ({participant.user.rating_count})
              </Text>
            ) : null}
          </View>
          <Text style={styles.username}>@{participant.user.username}</Text>

          <View style={styles.ratingSummaryBlock}>
            {existingRating ? (
              <>
                <Text style={styles.ratingBadge}>
                  {renderStars(existingRating.rating)} {existingRating.rating}/5
                </Text>
                {existingRating.message ? (
                  <Text style={styles.ratingMessage}>"{existingRating.message}"</Text>
                ) : null}
                <Text style={styles.ratingUpdatedAt}>
                  Last updated {formatShortDate(existingRating.updated_at)}
                </Text>
              </>
            ) : (
              <Text style={styles.ratingEmpty}>You haven't rated this participant yet</Text>
            )}
          </View>
        </View>

        {canRateParticipants ? (
          <TouchableOpacity
            style={styles.rateButton}
            onPress={() => {
              onDismissRatingError();
              setIsEditing((prev) => !prev);
            }}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.rateButtonText}>
              {isEditing ? 'Close' : existingRating ? 'Edit Rating' : 'Rate'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {isEditing ? (
        <View style={styles.inlineEditor}>
          <Text style={styles.inlineEditorTitle}>
            Rate {participant.user.display_name || participant.user.username}
          </Text>
          <Text style={styles.inlineEditorSubtitle}>1 to 5 stars</Text>

          <StarRatingInput
            value={rating}
            onChange={setRating}
            disabled={isLoading}
            styles={styles}
          />

          <TextInput
            style={[
              styles.ratingTextArea,
              styles.ratingTextAreaInline,
              validationMessage && styles.ratingTextAreaError,
            ]}
            value={message}
            onChangeText={setMessage}
            placeholder="Optional note about reliability, communication, or overall experience."
            placeholderTextColor={theme.placeholder}
            maxLength={FEEDBACK_MAX_LENGTH}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!isLoading}
          />

          <View style={styles.ratingMeta}>
            <Text style={[styles.ratingCharCount, validationMessage && styles.ratingValidationText]}>
              {trimmedLength}/{FEEDBACK_MAX_LENGTH}
            </Text>
            <Text style={styles.ratingHelper}>
              Optional, but must be at least {FEEDBACK_MIN_LENGTH} characters if provided.
            </Text>
          </View>

          {validationMessage ? (
            <Text style={styles.ratingValidationText}>{validationMessage}</Text>
          ) : null}

          {rowError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{rowError}</Text>
            </View>
          ) : null}

          <View style={styles.inlineActions}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (isLoading || rating === 0 || Boolean(validationMessage)) && styles.submitButtonDisabled,
              ]}
              disabled={isLoading || rating === 0 || Boolean(validationMessage)}
              onPress={() => onSubmitRating(participant.user.id, rating, message)}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.textOnPrimary} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {existingRating ? 'Save Changes' : 'Submit Rating'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelInlineButton}
              disabled={isLoading}
              onPress={() => {
                onDismissRatingError();
                setRating(existingRating?.rating ?? 0);
                setMessage(existingRating?.message ?? '');
                setIsEditing(false);
              }}
            >
              <Text style={styles.cancelInlineButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

interface ParticipantListModalProps {
  visible: boolean;
  participants: EventDetailApprovedParticipant[];
  loading: boolean;
  hasMore: boolean;
  canRateParticipants?: boolean;
  ratingWindowMessage?: string | null;
  ratingLoadingId?: string | null;
  ratingError?: { participantUserId: string; message: string } | null;
  onLoadMore: () => void;
  onSubmitRating?: (participantUserId: string, rating: number, message?: string) => void;
  onDismissRatingError?: () => void;
  onClose: () => void;
}

export default function ParticipantListModal({
  visible,
  participants,
  loading,
  hasMore,
  canRateParticipants = false,
  ratingWindowMessage = null,
  ratingLoadingId = null,
  ratingError = null,
  onLoadMore,
  onSubmitRating,
  onDismissRatingError,
  onClose,
}: ParticipantListModalProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);
  const panY = React.useRef(new Animated.Value(0)).current;

  const resetPositionAnim = Animated.spring(panY, {
    toValue: 0,
    useNativeDriver: true,
  });

  const closeAnim = Animated.timing(panY, {
    toValue: 1000,
    duration: 200,
    useNativeDriver: true,
  });

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 10,
      onPanResponderMove: Animated.event([null, { dy: panY }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          closeAnim.start(() => onClose());
        } else {
          resetPositionAnim.start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (visible) {
      panY.setValue(0);
    }
  }, [visible, panY]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateY: panY }] },
          ]}
        >
          <View {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Attendees ({participants.length})</Text>
              {ratingWindowMessage ? (
                <Text style={styles.subtitle}>{ratingWindowMessage}</Text>
              ) : canRateParticipants ? (
                <Text style={styles.subtitle}>You can leave post-event ratings for participants.</Text>
              ) : null}
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={participants}
            keyExtractor={(item) => item.participation_id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <ParticipantRow
                participant={item}
                canRateParticipants={canRateParticipants}
                ratingLoadingId={ratingLoadingId}
                ratingError={ratingError}
                onSubmitRating={(participantUserId, rating, message) => {
                  onSubmitRating?.(participantUserId, rating, message);
                }}
                onDismissRatingError={() => onDismissRatingError?.()}
                onCloseModal={onClose}
                theme={theme}
                styles={styles}
              />
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>{loading ? 'Loading attendees...' : 'No attendees yet.'}</Text>
            }
            ListFooterComponent={
              hasMore ? (
                <TouchableOpacity style={styles.loadMoreBtn} onPress={onLoadMore}>
                  <Text style={styles.loadMoreText}>Load more</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: t.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: t.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
    minHeight: '40%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.borderStrong,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: t.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: t.textSecondary,
    maxWidth: 280,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    paddingBottom: 40,
  },
  participantCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: t.surfaceVariant,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: t.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    marginLeft: 12,
    flex: 1,
  },
  userTopline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: t.text,
  },
  userScore: {
    fontSize: 12,
    color: t.warningText,
    fontWeight: '500',
  },
  username: {
    fontSize: 14,
    color: t.textSecondary,
    marginTop: 2,
  },
  ratingSummaryBlock: {
    marginTop: 10,
    gap: 8,
  },
  ratingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: t.warningBg,
    borderWidth: 1,
    borderColor: t.warningBorder,
    color: t.warningText,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  ratingEmpty: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: t.surfaceAlt,
    borderWidth: 1,
    borderColor: t.border,
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  ratingMessage: {
    color: t.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  ratingUpdatedAt: {
    color: t.textTertiary,
    fontSize: 12,
  },
  rateButton: {
    marginLeft: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.borderStrong,
    backgroundColor: t.surface,
  },
  rateButtonText: {
    color: t.text,
    fontSize: 13,
    fontWeight: '700',
  },
  inlineEditor: {
    marginTop: 14,
    marginLeft: 60,
    padding: 14,
    borderRadius: 16,
    backgroundColor: t.surfaceAlt,
    borderWidth: 1,
    borderColor: t.border,
    gap: 12,
  },
  inlineEditorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: t.text,
  },
  inlineEditorSubtitle: {
    fontSize: 13,
    color: t.textSecondary,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  starButton: {
    padding: 2,
  },
  starIcon: {
    fontSize: 28,
    color: t.borderStrong,
  },
  starIconActive: {
    color: t.warningText,
  },
  ratingTextArea: {
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 12,
    padding: 12,
    backgroundColor: t.surface,
    color: t.text,
    fontSize: 14,
    lineHeight: 22,
  },
  ratingTextAreaInline: {
    minHeight: 84,
  },
  ratingTextAreaError: {
    borderColor: t.errorBorder,
  },
  ratingMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  ratingCharCount: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textMuted,
  },
  ratingHelper: {
    fontSize: 12,
    lineHeight: 18,
    color: t.textMuted,
    flex: 1,
  },
  ratingValidationText: {
    fontSize: 13,
    color: t.errorText,
  },
  errorBanner: {
    backgroundColor: t.errorBg,
    borderWidth: 1,
    borderColor: t.errorBorder,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  errorBannerText: {
    color: t.errorText,
    fontSize: 14,
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  submitButton: {
    minWidth: 170,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: t.primary,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: t.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  cancelInlineButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.borderStrong,
    backgroundColor: 'transparent',
  },
  cancelInlineButtonText: {
    color: t.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: t.textSecondary,
    marginTop: 32,
    fontSize: 15,
  },
  loadMoreBtn: {
    marginTop: 16,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: t.infoBg,
  },
  loadMoreText: {
    color: t.infoText,
    fontWeight: '600',
  },
  });
}
