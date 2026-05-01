import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useEventDetailViewModel } from '@/viewmodels/event/useEventDetailViewModel';
import { formatEventDateLabel, getAutoCompletionDaysLeft } from '@/utils/eventDate';
import {
  formatEventStatusLabel,
  getEventStatusBadgeColors,
} from '@/utils/eventStatus';
import { formatEventLocation } from '@/utils/eventLocation';
import { EventDetail } from '@/models/event';
import JoinRequestsModal from '@/components/events/JoinRequestsModal';
import ParticipantListModal from '@/components/events/ParticipantListModal';

interface EventDetailViewProps {
  eventId: string;
}

function PrivacyBadge({ level }: { level: EventDetail['privacy_level'] }) {
  const label = level ? level.charAt(0) + level.slice(1).toLowerCase() : '';

  let badgeStyle = styles.badgePublic;
  let textStyle = styles.badgeTextPublic;
  let iconName: 'globe' | 'lock' = 'globe';
  let iconColor = '#1E40AF';

  if (level === 'PROTECTED') {
    badgeStyle = styles.badgeProtected;
    textStyle = styles.badgeTextProtected;
    iconName = 'lock';
    iconColor = '#92400E';
  } else if (level === 'PRIVATE') {
    badgeStyle = styles.badgePrivate;
    textStyle = styles.badgeTextPrivate;
    iconName = 'lock';
    iconColor = '#5B21B6';
  }

  return (
    <View style={[styles.badge, badgeStyle]}>
      <Feather name={iconName} size={12} color={iconColor} />
      <Text style={[styles.badgeText, textStyle]}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return null;
  const statusColors = getEventStatusBadgeColors(status);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: statusColors.backgroundColor },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color: statusColors.textColor },
        ]}
      >
        {formatEventStatusLabel(status)}
      </Text>
    </View>
  );
}

const FEEDBACK_MIN_LENGTH = 10;
const FEEDBACK_MAX_LENGTH = 100;

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatLongDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

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
  const rounded = Math.max(0, Math.min(5, Math.round(rating || 0)));
  return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
}

function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.ratingStarRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <TouchableOpacity
            key={star}
            style={styles.ratingStarButton}
            onPress={() => onChange(star)}
            activeOpacity={0.75}
            disabled={disabled}
          >
            <Text style={[styles.ratingStarIcon, active && styles.ratingStarIconActive]}>★</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ParticipantRatingSection({
  event,
  loading,
  error,
  onSubmit,
  onDismissError,
}: {
  event: EventDetail;
  loading: boolean;
  error: string | null;
  onSubmit: (rating: number, message?: string) => void;
  onDismissError: () => void;
}) {
  const existingRating = event.viewer_event_rating;
  const [rating, setRating] = React.useState(existingRating?.rating ?? 0);
  const [message, setMessage] = React.useState(existingRating?.message ?? '');
  const [isEditing, setIsEditing] = React.useState(existingRating == null);
  const ratingStampRef = React.useRef<string | null>(
    existingRating ? `${existingRating.id}:${existingRating.updated_at}` : null,
  );

  React.useEffect(() => {
    setRating(existingRating?.rating ?? 0);
    setMessage(existingRating?.message ?? '');

    const nextStamp = existingRating ? `${existingRating.id}:${existingRating.updated_at}` : null;
    const previousStamp = ratingStampRef.current;

    if (!nextStamp) {
      setIsEditing(true);
    } else if (previousStamp !== null && nextStamp !== previousStamp && !loading && !error) {
      setIsEditing(false);
    } else if (previousStamp === null && !loading && !error) {
      setIsEditing(false);
    }

    ratingStampRef.current = nextStamp;
  }, [existingRating?.id, existingRating?.message, existingRating?.rating, existingRating?.updated_at, loading, error]);

  const feedbackError = getFeedbackValidationMessage(message);
  const trimmedLength = message.trim().length;
  const isJoinedParticipant =
    !event.viewer_context.is_host &&
    event.viewer_context.participation_status === 'JOINED' &&
    event.status === 'COMPLETED';
  const isEligibleParticipant = isJoinedParticipant && event.rating_window.is_active;

  if (!isJoinedParticipant) {
    return null;
  }

  return (
    <>
      <View style={styles.divider} />
      <View style={styles.section}>
        <View style={styles.ratingCard}>
          <View style={styles.ratingCardHeader}>
            <View style={styles.ratingCardHeaderCopy}>
              <Text style={styles.ratingKicker}>Post-event feedback</Text>
              <Text style={styles.ratingTitle}>
                {existingRating ? 'Update your rating for the host' : 'How was this event?'}
              </Text>
            </View>
            <Text style={styles.ratingDeadline}>
              {event.rating_window.is_active
                ? `Open until ${formatShortDate(event.rating_window.closes_at)}`
                : `Closed ${formatShortDate(event.rating_window.closes_at)}`}
            </Text>
          </View>

          <Text style={styles.ratingCopy}>
            Rate the experience from 1 to 5 stars. You can optionally leave a short message for the host.
          </Text>

          {!event.rating_window.is_active ? (
            <View style={styles.ratingInfoBanner}>
              <Feather name="info" size={16} color="#92400E" />
              <Text style={styles.ratingInfoBannerText}>
                The feedback window closed on {formatLongDateTime(event.rating_window.closes_at)}.
              </Text>
            </View>
          ) : null}

          {isEligibleParticipant && existingRating && !isEditing ? (
            <View style={styles.ratingReadonly}>
              <Text style={styles.ratingSummaryChip}>
                {existingRating.rating}/5 · {renderStars(existingRating.rating)}
              </Text>

              {existingRating.message ? (
                <Text style={styles.ratingReadonlyMessage}>"{existingRating.message}"</Text>
              ) : null}

              <View style={styles.ratingActionRow}>
                <Text style={styles.ratingExistingNote}>
                  Last updated {formatShortDate(existingRating.updated_at)}
                </Text>
                <TouchableOpacity
                  style={styles.ratingEditButton}
                  onPress={() => {
                    onDismissError();
                    setIsEditing(true);
                  }}
                >
                  <Text style={styles.ratingEditButtonText}>Edit Rating</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : isEligibleParticipant ? (
            <>
              <View style={styles.ratingSelectionRow}>
                <StarRatingInput value={rating} onChange={setRating} disabled={loading} />
                <Text style={[styles.ratingSelectionSummary, rating > 0 && styles.ratingSelectionSummaryActive]}>
                  {rating > 0 ? `${rating}/5 · ${renderStars(rating)}` : 'Select a star rating'}
                </Text>
              </View>

              <Text style={styles.ratingFieldLabel}>Message</Text>
              <TextInput
                style={[styles.ratingTextArea, feedbackError && styles.ratingTextAreaError]}
                placeholder="Share what stood out, how the event felt, or anything the host should know."
                placeholderTextColor="#9CA3AF"
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={FEEDBACK_MAX_LENGTH}
                editable={!loading}
              />

              <View style={styles.ratingMeta}>
                <Text style={[styles.ratingCharCount, feedbackError && styles.ratingValidationText]}>
                  {trimmedLength}/{FEEDBACK_MAX_LENGTH}
                </Text>
                <Text style={styles.ratingHelper}>
                  Optional. If you write one, keep it between {FEEDBACK_MIN_LENGTH} and {FEEDBACK_MAX_LENGTH} characters.
                </Text>
              </View>

              {feedbackError ? (
                <Text style={styles.ratingValidationText}>{feedbackError}</Text>
              ) : null}

              {error ? (
                <View style={styles.inlineErrorBanner}>
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              ) : null}

              {existingRating ? (
                <Text style={styles.ratingExistingNote}>
                  Last updated {formatShortDate(existingRating.updated_at)}. Submitting again overwrites the existing rating.
                </Text>
              ) : null}

              <View style={styles.ratingActionRow}>
                <TouchableOpacity
                  style={[
                    styles.ratingSubmitButton,
                    (loading || rating === 0 || Boolean(feedbackError)) && styles.ratingSubmitButtonDisabled,
                  ]}
                  disabled={loading || rating === 0 || Boolean(feedbackError)}
                  onPress={() => onSubmit(rating, message)}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.ratingSubmitButtonText}>
                      {existingRating ? 'Update Rating' : 'Submit Rating'}
                    </Text>
                  )}
                </TouchableOpacity>

                {existingRating ? (
                  <TouchableOpacity
                    style={styles.ratingCancelButton}
                    disabled={loading}
                    onPress={() => {
                      onDismissError();
                      setRating(existingRating.rating);
                      setMessage(existingRating.message ?? '');
                      setIsEditing(false);
                    }}
                  >
                    <Text style={styles.ratingCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          ) : null}
        </View>
      </View>
    </>
  );
}

export default function EventDetailView({ eventId }: EventDetailViewProps) {
  const vm = useEventDetailViewModel(eventId);

  const renderActionButton = () => {
    if (!vm.event) return null;

    const { status, privacy_level } = vm.event;
    const status_ = vm.participationStatus;
    const isActive = status === 'ACTIVE';

    if (vm.event.viewer_context.is_host) {
      return (
        <View style={styles.statusChip}>
          <Feather name="star" size={16} color="#7C3AED" />
          <Text style={styles.statusChipTextPurple}>You are hosting this event</Text>
        </View>
      );
    }

    if (status_ === 'LEAVED' || vm.actionState === 'success_left') {
      // Pre-start leave: backend allows rejoin, so fall through to join/request buttons
      const eventNotStarted = new Date() < new Date(vm.event.start_time);
      if (!eventNotStarted) {
        return (
          <View style={styles.statusChip}>
            <Ionicons name="log-out-outline" size={16} color="#6B7280" />
            <Text style={styles.statusChipTextGray}>You left this event</Text>
          </View>
        );
      }
      // fall through to show join/request-to-join buttons below
    }

    if (status_ === 'JOINED' || vm.actionState === 'success_joined') {
      const attendedLabel =
        vm.event.status === 'COMPLETED' ? 'You attended this event' : "You're attending";

      return (
        <View>
          <View style={styles.statusChip}>
            <Ionicons name="checkmark-circle" size={16} color="#059669" />
            <Text style={styles.statusChipTextGreen}>{attendedLabel}</Text>
          </View>
          {vm.canLeave && (
            <TouchableOpacity
              style={[styles.leaveButton, vm.actionState === 'leaving' && styles.actionButtonLoading]}
              onPress={() => {
                Alert.alert(
                  'Leave Event',
                  'Are you sure you want to leave this event?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: vm.handleLeaveEvent },
                  ],
                );
              }}
              disabled={vm.actionState === 'leaving'}
              activeOpacity={0.8}
            >
              {vm.actionState === 'leaving' ? (
                <ActivityIndicator color="#DC2626" size="small" />
              ) : (
                <>
                  <Ionicons name="exit-outline" size={18} color="#DC2626" />
                  <Text style={styles.leaveButtonText}>Leave Event</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (status_ === 'PENDING' || vm.actionState === 'success_requested') {
      return (
        <View style={styles.statusChip}>
          <Feather name="clock" size={16} color="#D97706" />
          <Text style={styles.statusChipTextAmber}>Request sent — awaiting approval</Text>
        </View>
      );
    }

    if (status_ === 'INVITED') {
      return (
        <View style={styles.statusChip}>
          <Feather name="mail" size={16} color="#111827" />
          <Text style={styles.statusChipTextBlue}>You&apos;re invited</Text>
        </View>
      );
    }

    if (!isActive) return null;

    if (vm.constraintViolation) {
      return (
        <View style={[styles.actionButton, styles.actionButtonDisabled]}>
          <Feather name="lock" size={18} color="#9CA3AF" />
          <Text style={[styles.actionButtonTextDisabled, styles.actionButtonConstraintText]}>
            {vm.constraintViolation}
          </Text>
        </View>
      );
    }

    if (privacy_level === 'PUBLIC') {
      if (vm.isQuotaFull) {
        return (
          <View style={[styles.actionButton, styles.actionButtonDisabled]}>
            <Feather name="users" size={18} color="#9CA3AF" />
            <Text style={styles.actionButtonTextDisabled}>Event is Full</Text>
          </View>
        );
      }
      return (
        <TouchableOpacity
          style={[styles.actionButton, vm.actionState === 'joining' && styles.actionButtonLoading]}
          onPress={vm.handleJoin}
          disabled={vm.actionState === 'joining'}
          activeOpacity={0.8}
        >
          {vm.actionState === 'joining' ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Feather name="log-in" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Join Event</Text>
            </>
          )}
        </TouchableOpacity>
      );
    }

    if (privacy_level === 'PROTECTED') {
      return (
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonProtected]}
          onPress={vm.openJoinRequestModal}
          activeOpacity={0.8}
        >
          <Feather name="send" size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Request to Join</Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  if (vm.isLoading) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#111827" />
      </SafeAreaView>
    );
  }

  if (vm.apiError || !vm.event) {
    const isPrivateOrMissing = vm.apiError?.includes('private') || vm.apiError?.includes('not exist');
    
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <View style={styles.errorContainer}>
          <View 
            style={styles.errorIconCircle}
            testID={isPrivateOrMissing ? "error-icon-lock" : "error-icon-alert"}
          >
            <Feather 
              name={isPrivateOrMissing ? "lock" : "alert-circle"} 
              size={32} 
              color={isPrivateOrMissing ? "#5B21B6" : "#9CA3AF"} 
            />
          </View>
          <Text style={styles.errorTitle}>
            {isPrivateOrMissing ? 'Event Inaccessible' : 'Something went wrong'}
          </Text>
          <Text style={styles.errorMessage}>
            {vm.apiError ?? 'The event you are looking for could not be found.'}
          </Text>
          
          <TouchableOpacity style={styles.retryButton} onPress={vm.retry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.backLinkButton} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go Back to Discovery</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { event } = vm;
  const ratingLabel =
    event.host_score.final_score != null
      ? `${event.host_score.final_score.toFixed(1)} (${event.host_score.hosted_event_rating_count})`
      : 'New host';
  const hostDisplayName = event.host.display_name ?? event.host.username;
  const capacityLabel =
    event.capacity != null
      ? `${event.approved_participant_count} / ${event.capacity}`
      : `${event.approved_participant_count}`;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Event Details
        </Text>

        <TouchableOpacity style={styles.headerIconBtn} onPress={vm.handleToggleFavorite}>
          <MaterialIcons
            name={vm.isFavorited ? 'favorite' : 'favorite-border'}
            size={22}
            color={vm.isFavorited ? '#EF4444' : '#111827'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image */}
        <View style={styles.heroContainer}>
          {event.image_url ? (
            <Image
              source={{ uri: event.image_url }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Feather name="image" size={48} color="#9CA3AF" />
            </View>
          )}
          <View style={styles.heroBadgeRow}>
            <PrivacyBadge level={event.privacy_level} />
            <StatusBadge status={event.status} />
          </View>
        </View>

        {/* Auto-completion warning for in-progress events without an end date */}
        {(() => {
          const daysLeft = getAutoCompletionDaysLeft(event.status, event.start_time, event.end_time);
          if (daysLeft == null) return null;
          return (
            <View style={styles.warningBanner}>
              <Feather name="alert-triangle" size={16} color="#D97706" />
              <Text style={styles.warningBannerText}>
                This event will be automatically completed in {daysLeft} day{daysLeft !== 1 ? 's' : ''} due to inactivity.
              </Text>
            </View>
          );
        })()}

        {/* Core info */}
        <View style={styles.section}>
          {event.category && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{event.category.name}</Text>
            </View>
          )}

          <Text style={styles.eventTitle}>{event.title}</Text>

          {/* Date */}
          <View style={styles.metaRow}>
            <Feather name="clock" size={16} color="#6B7280" />
            <Text style={styles.metaText}>
              {formatEventDateLabel(event.start_time, event.end_time)}
            </Text>
          </View>

          {/* Location */}
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={16} color="#6B7280" />
            <Text style={styles.metaText}>
              {formatEventLocation(event.location.address)}
            </Text>
          </View>

          {/* Participants */}
          <View style={styles.metaRow}>
            <Feather name="users" size={16} color="#6B7280" />
            <Text style={styles.metaText}>
              {capacityLabel} participant{event.approved_participant_count !== 1 ? 's' : ''}
              {event.capacity != null ? ' (capacity)' : ''}
            </Text>
          </View>

          {/* Favorites */}
          <View style={styles.metaRow}>
            <Feather name="heart" size={16} color="#6B7280" />
            <Text style={styles.metaText}>{event.favorite_count} saved</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Host */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Host</Text>
          <View style={styles.hostRow}>
            {event.host.avatar_url ? (
              <Image source={{ uri: event.host.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name="user" size={20} color="#9CA3AF" />
              </View>
            )}
            <View style={styles.hostInfo}>
              <Text style={styles.hostName}>{hostDisplayName}</Text>
              <Text style={styles.hostUsername}>@{event.host.username}</Text>
            </View>
            <View style={styles.hostRating}>
              <Feather name="star" size={14} color="#F59E0B" />
              <Text style={styles.hostRatingText}>{ratingLabel}</Text>
            </View>
          </View>
        </View>

        {/* Host Management */}
        {vm.event.viewer_context.is_host && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Host Management</Text>
              <View style={styles.hostActions}>
                <TouchableOpacity
                  style={[styles.hostActionBtn, styles.hostActionBtnSecondary]}
                  onPress={() => vm.setShowAttendeesModal(true)}
                >
                  <Feather name="users" size={18} color="#111827" />
                  <Text style={styles.hostActionText}>
                    Attendees ({vm.hostContextSummary?.approved_participant_count ?? vm.approvedParticipants.length})
                  </Text>
                </TouchableOpacity>
                {vm.event.status === 'COMPLETED' ? (
                  <Text style={styles.hostActionHint}>
                    {vm.event.rating_window.is_active
                      ? `Participant feedback is open until ${formatLongDateTime(vm.event.rating_window.closes_at)}.`
                      : `Participant feedback closed on ${formatLongDateTime(vm.event.rating_window.closes_at)}.`}
                  </Text>
                ) : null}

                {vm.event.privacy_level === 'PROTECTED' && (
                  <TouchableOpacity
                    style={[styles.hostActionBtn, styles.hostActionBtnPrimary]}
                    onPress={() => vm.setShowRequestsModal(true)}
                  >
                    <Feather name="mail" size={18} color="#FFFFFF" />
                    <Text style={styles.hostActionTextWhite}>
                      Pending Requests ({vm.hostContextSummary?.pending_join_request_count ?? vm.pendingJoinRequests.length})
                    </Text>
                  </TouchableOpacity>
                )}

                {vm.event.status === 'ACTIVE' && (
                  <TouchableOpacity
                    style={[styles.hostActionBtn, styles.hostActionBtnDanger]}
                    onPress={() => {
                      Alert.alert(
                        'Cancel Event',
                        'Are you sure you want to cancel this event? This action cannot be undone.',
                        [
                          { text: 'No, Keep It', style: 'cancel' },
                          { text: 'Yes, Cancel', style: 'destructive', onPress: vm.handleCancelEvent },
                        ]
                      );
                    }}
                  >
                    <Feather name="trash-2" size={18} color="#DC2626" />
                    <Text style={styles.hostActionTextDanger}>Cancel Event</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}

        <ParticipantRatingSection
          event={event}
          loading={vm.viewerRatingLoading}
          error={vm.viewerRatingError}
          onSubmit={(rating, message) => void vm.handleViewerRatingSubmit(rating, message)}
          onDismissError={vm.dismissViewerRatingError}
        />

        {/* Description */}
        {event.description ? (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          </>
        ) : null}

        {/* Tags */}
        {event.tags.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagRow}>
                {event.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Constraints */}
        {event.constraints.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Requirements</Text>
              {event.constraints.map((c, i) => (
                <View key={i} style={styles.constraintRow}>
                  <MaterialIcons name="check-circle-outline" size={16} color="#6B7280" />
                  <View style={styles.constraintText}>
                    <Text style={styles.constraintType}>{c.type}</Text>
                    <Text style={styles.constraintInfo}>{c.info}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Minimum age / preferred gender */}
        {(event.minimum_age != null || event.preferred_gender != null) && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Participation criteria</Text>
              {event.minimum_age != null && (
                <View style={styles.metaRow}>
                  <Feather name="user-check" size={16} color="#6B7280" />
                  <Text style={styles.metaText}>Minimum age: {event.minimum_age}+</Text>
                </View>
              )}
              {event.preferred_gender != null && (
                <View style={styles.metaRow}>
                  <Feather name="users" size={16} color="#6B7280" />
                  <Text style={styles.metaText}>
                    Preferred gender:{' '}
                    {event.preferred_gender.charAt(0) +
                      event.preferred_gender.slice(1).toLowerCase()}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Action error */}
        {vm.actionError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{vm.actionError}</Text>
          </View>
        ) : null}

        {/* Bottom spacer for action bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky action bar */}
      <View style={styles.actionBar}>{renderActionButton()}</View>

      {/* Join request modal */}
      <Modal
        visible={vm.showJoinRequestModal}
        animationType="slide"
        transparent
        onRequestClose={vm.closeJoinRequestModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>Request to Join</Text>
            <Text style={styles.modalSubtitle}>
              Send a message to the host explaining why you&apos;d like to join.
            </Text>

            <Text style={styles.label}>Message (optional)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="I have experience with similar events and would love to participate…"
              placeholderTextColor="#9CA3AF"
              value={vm.joinRequestMessage}
              onChangeText={vm.setJoinRequestMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
              editable={vm.actionState !== 'requesting'}
            />
            <Text style={styles.charCount}>
              {vm.joinRequestMessage.length}/500
            </Text>

            {vm.actionError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{vm.actionError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonProtected,
                vm.actionState === 'requesting' && styles.actionButtonLoading,
              ]}
              onPress={vm.handleRequestJoin}
              disabled={vm.actionState === 'requesting'}
              activeOpacity={0.8}
            >
              {vm.actionState === 'requesting' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Send Request</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={vm.closeJoinRequestModal}
              disabled={vm.actionState === 'requesting'}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Host Modals */}
      {vm.event.viewer_context.is_host && (
        <>
          <JoinRequestsModal
            visible={vm.showRequestsModal}
            requests={vm.pendingJoinRequests}
            loading={vm.pendingJoinRequestsLoading}
            hasMore={vm.pendingJoinRequestsHasNext}
            onLoadMore={() => void vm.loadMorePendingJoinRequests()}
            onClose={() => vm.setShowRequestsModal(false)}
            onApprove={vm.handleApproveRequest}
            onReject={vm.handleRejectRequest}
          />
          <ParticipantListModal
            visible={vm.showAttendeesModal}
            participants={vm.approvedParticipants}
            loading={vm.approvedParticipantsLoading}
            hasMore={vm.approvedParticipantsHasNext}
            canRateParticipants={vm.event.status === 'COMPLETED' && vm.event.rating_window.is_active}
            ratingWindowMessage={
              vm.event.status === 'COMPLETED'
                ? vm.event.rating_window.is_active
                  ? `Participant feedback is open until ${formatLongDateTime(vm.event.rating_window.closes_at)}.`
                  : `Participant feedback closed on ${formatLongDateTime(vm.event.rating_window.closes_at)}.`
                : null
            }
            ratingLoadingId={vm.participantRatingLoadingId}
            ratingError={vm.participantRatingError}
            onLoadMore={() => void vm.loadMoreApprovedParticipants()}
            onSubmitRating={(participantUserId, rating, message) => {
              void vm.handleParticipantRatingSubmit(participantUserId, rating, message);
            }}
            onDismissRatingError={vm.dismissParticipantRatingError}
            onClose={() => vm.setShowAttendeesModal(false)}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 8,
  },

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  /* Hero */
  heroContainer: {
    height: 240,
    backgroundColor: '#E5E7EB',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  heroBadgeRow: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    gap: 8,
  },

  /* Badges */
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgePublic: {
    backgroundColor: '#DBEAFE',
  },
  badgeProtected: {
    backgroundColor: '#FEF3C7',
  },
  badgePrivate: {
    backgroundColor: '#EDE9FE',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextPublic: {
    color: '#1E40AF',
  },
  badgeTextProtected: {
    color: '#92400E',
  },
  badgeTextPrivate: {
    color: '#5B21B6',
  },

  /* Section */
  section: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  divider: {
    height: 8,
    backgroundColor: '#F1F5F9',
  },

  /* Category chip */
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Event title */
  eventTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 30,
    marginBottom: 16,
  },

  /* Meta rows */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  metaText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    fontWeight: '500',
  },

  /* Host */
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostInfo: {
    flex: 1,
  },
  hostName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  hostUsername: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  hostRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hostRatingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },

  /* Description */
  description: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
  },

  /* Tags */
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },

  /* Constraints */
  constraintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  constraintText: {
    flex: 1,
  },
  constraintType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'capitalize',
  },
  constraintInfo: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginTop: 2,
  },

  /* Action bar */
  actionBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 15,
  },
  actionButtonProtected: {
    backgroundColor: '#7C3AED',
  },
  actionButtonLoading: {
    opacity: 0.7,
  },
  actionButtonDisabled: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionButtonTextDisabled: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  actionButtonConstraintText: {
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },

  /* Status chips */
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusChipTextGreen: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  statusChipTextAmber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D97706',
  },
  statusChipTextBlue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  statusChipTextPurple: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7C3AED',
  },
  statusChipTextGray: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  leaveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  ratingCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    padding: 18,
    gap: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  ratingCardHeader: {
    gap: 12,
  },
  ratingCardHeaderCopy: {
    gap: 4,
  },
  ratingKicker: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    backgroundColor: '#E2E8F0',
  },
  ratingTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: '#0F172A',
  },
  ratingDeadline: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.15)',
    backgroundColor: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  ratingCopy: {
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
  },
  ratingInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  ratingInfoBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#92400E',
    fontWeight: '500',
  },
  ratingReadonly: {
    gap: 12,
  },
  ratingSummaryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 251, 235, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    color: '#9A6700',
    fontSize: 14,
    fontWeight: '700',
    overflow: 'hidden',
  },
  ratingReadonlyMessage: {
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
  },
  ratingSelectionRow: {
    gap: 10,
  },
  ratingStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingStarButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingStarIcon: {
    fontSize: 40,
    color: '#CBD5E1',
  },
  ratingStarIconActive: {
    color: '#F59E0B',
  },
  ratingSelectionSummary: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  ratingSelectionSummaryActive: {
    color: '#9A6700',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(255, 251, 235, 0.9)',
  },
  ratingFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  ratingTextArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    lineHeight: 22,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    minHeight: 112,
  },
  ratingTextAreaError: {
    borderColor: '#FCA5A5',
  },
  ratingMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 4,
  },
  ratingCharCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  ratingHelper: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
    flex: 1,
  },
  ratingValidationText: {
    fontSize: 13,
    color: '#DC2626',
  },
  ratingExistingNote: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
    flex: 1,
  },
  ratingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  ratingEditButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: 'transparent',
  },
  ratingEditButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  ratingSubmitButton: {
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#111827',
  },
  ratingSubmitButtonDisabled: {
    opacity: 0.55,
  },
  ratingSubmitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ratingCancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: 'transparent',
  },
  ratingCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  inlineErrorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
  },

  /* Error states */
  errorContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  backLinkButton: {
    paddingVertical: 8,
  },
  backLinkText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
  },
  warningBannerText: {
    flex: 1,
    color: '#92400E',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginHorizontal: 20,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
  },

  /* Join request modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    minHeight: 110,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  hostActions: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 8,
  },
  hostActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
  },
  hostActionBtnSecondary: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  hostActionBtnPrimary: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  hostActionBtnDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  hostActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  hostActionTextWhite: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hostActionTextDanger: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  hostActionHint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    marginTop: -4,
  },
});
