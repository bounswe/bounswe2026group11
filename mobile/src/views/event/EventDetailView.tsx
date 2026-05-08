import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useEventDetailViewModel } from '@/viewmodels/event/useEventDetailViewModel';
import { fetchRoutedGeometry } from '@/services/eventService';
import { formatEventDateLabel, getAutoCompletionDaysLeft } from '@/utils/eventDate';
import {
  formatEventStatusLabel,
  getEventStatusBadgeColors,
} from '@/utils/eventStatus';
import { formatEventLocation } from '@/utils/eventLocation';
import { getEventCategoryPresentation } from '@/utils/eventCategoryPresentation';
import { EventDetail } from '@/models/event';
import JoinRequestsModal from '@/components/events/JoinRequestsModal';
import ParticipantListModal from '@/components/events/ParticipantListModal';
import InvitationsModal from '@/components/events/InvitationsModal';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface EventDetailViewProps {
  eventId: string;
}

interface RegionLike {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

function getPrimaryPoint(location: EventDetail['location']): { lat: number; lon: number } | null {
  if (location.point) return { lat: location.point.lat, lon: location.point.lon };
  if (location.type === 'ROUTE' && location.route_points && location.route_points.length > 0) {
    return { lat: location.route_points[0].lat, lon: location.route_points[0].lon };
  }
  return null;
}

function getRouteRegion(
  routePoints: Array<{ lat: number; lon: number }>,
  paddingFactor: number,
): RegionLike | null {
  if (!routePoints || routePoints.length === 0) return null;
  const lats = routePoints.map((p) => p.lat);
  const lons = routePoints.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.005, (maxLat - minLat) * paddingFactor),
    longitudeDelta: Math.max(0.005, (maxLon - minLon) * paddingFactor),
  };
}

function PrivacyBadge({ level }: { level: EventDetail['privacy_level'] }) {
  const { theme } = useTheme();
  const label = level ? level.charAt(0) + level.slice(1).toLowerCase() : '';

  let bg = theme.badgePublicBg;
  let color = theme.badgePublicText;
  let iconName: 'globe' | 'lock' = 'globe';

  if (level === 'PROTECTED') {
    bg = theme.badgeProtectedBg;
    color = theme.badgeProtectedText;
    iconName = 'lock';
  } else if (level === 'PRIVATE') {
    bg = theme.badgePrivateBg;
    color = theme.badgePrivateText;
    iconName = 'lock';
  }

  return (
    <View style={[badgeBase, { backgroundColor: bg }]}>
      <Feather name={iconName} size={12} color={color} />
      <Text style={[badgeTextBase, { color }]}>{label}</Text>
    </View>
  );
}

// Minimal static styles shared by badge components (no theme dependency)
const badgeBase: object = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 999,
};
const badgeTextBase: object = {
  fontSize: 12,
  fontWeight: '700',
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return null;
  const statusColors = getEventStatusBadgeColors(status);

  return (
    <View style={[badgeBase, { backgroundColor: statusColors.backgroundColor }]}>
      <Text style={[badgeTextBase, { color: statusColors.textColor }]}>
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
  if (trimmed.length === 0) return null;
  if (trimmed.length < FEEDBACK_MIN_LENGTH)
    return `Feedback must be at least ${FEEDBACK_MIN_LENGTH} characters.`;
  if (trimmed.length > FEEDBACK_MAX_LENGTH)
    return `Feedback must be ${FEEDBACK_MAX_LENGTH} characters or fewer.`;
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
  styles,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  styles: ReturnType<typeof makeStyles>;
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
  styles,
}: {
  event: EventDetail;
  loading: boolean;
  error: string | null;
  onSubmit: (rating: number, message?: string) => void;
  onDismissError: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const existingRating = event.viewer_event_rating;
  const [rating, setRating] = React.useState(existingRating?.rating ?? 0);
  const [message, setMessage] = React.useState(existingRating?.message ?? '');
  const [isEditing, setIsEditing] = React.useState(existingRating == null);
  const { theme } = useTheme();
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

  if (!isJoinedParticipant) return null;

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
              <Feather name="info" size={16} color={theme.warningText} />
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
                <StarRatingInput value={rating} onChange={setRating} disabled={loading} styles={styles} />
                <Text style={[styles.ratingSelectionSummary, rating > 0 && styles.ratingSelectionSummaryActive]}>
                  {rating > 0 ? `${rating}/5 · ${renderStars(rating)}` : 'Select a star rating'}
                </Text>
              </View>

              <Text style={styles.ratingFieldLabel}>Message</Text>
              <TextInput
                style={[styles.ratingTextArea, feedbackError && styles.ratingTextAreaError]}
                placeholder="Share what stood out, how the event felt, or anything the host should know."
                placeholderTextColor={theme.placeholder}
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
                    <ActivityIndicator size="small" color={theme.textOnPrimary} />
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

/** Radius (metres) of the circle drawn around a fuzzed PROTECTED event location. */
const APPROX_LOCATION_RADIUS_METERS = 500;

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#263c3f' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b9a76' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ca5b3' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#746855' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2835' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f3d19c' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#515c6d' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#17263c' }],
  },
];

export default function EventDetailView({ eventId }: EventDetailViewProps) {
  const vm = useEventDetailViewModel(eventId);
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [routedGeometry, setRoutedGeometry] = useState<Array<{ lat: number; lon: number }> | null>(
    null,
  );

  const routeWaypoints = useMemo(() => {
    if (vm.event?.location.type !== 'ROUTE') return null;
    return vm.event.location.route_points ?? [];
  }, [vm.event?.location.type, vm.event?.location.route_points]);

  useEffect(() => {
    if (!routeWaypoints || routeWaypoints.length < 2) {
      setRoutedGeometry(null);
      return;
    }
    let cancelled = false;
    fetchRoutedGeometry(routeWaypoints)
      .then((geom) => {
        if (!cancelled) setRoutedGeometry(geom);
      })
      .catch(() => {
        if (!cancelled) setRoutedGeometry(null);
      });
    return () => {
      cancelled = true;
    };
  }, [routeWaypoints]);

  // Polyline coords: prefer the routed geometry (follows roads); fall back to
  // straight-line waypoints if routing is unavailable or still loading.
  const polylineCoords = useMemo(() => {
    if (routedGeometry && routedGeometry.length >= 2) return routedGeometry;
    return routeWaypoints && routeWaypoints.length >= 2 ? routeWaypoints : null;
  }, [routedGeometry, routeWaypoints]);

  const handleGetDirections = () => {
    if (!vm.event) return;
    const primary = getPrimaryPoint(vm.event.location);
    if (!primary) return;
    const { lat, lon } = primary;
    const label = vm.event.title;

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lon}`,
      android: `geo:0,0?q=${lat},${lon}(${label})`,
    });

    if (url) {
      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          const browserUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
          Linking.openURL(browserUrl);
        }
      });
    }
  };

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
      const eventNotStarted = new Date() < new Date(vm.event.start_time);
      if (!eventNotStarted) {
        return (
          <View style={styles.statusChip}>
            <Ionicons name="log-out-outline" size={16} color={theme.textTertiary} />
            <Text style={styles.statusChipTextGray}>You left this event</Text>
          </View>
        );
      }
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
        <View>
          <View style={styles.statusChip}>
            <Feather name="mail" size={16} color="#111827" />
            <Text style={styles.statusChipTextBlue}>You&apos;re invited</Text>
          </View>

          <View style={styles.invitationActionRow}>
            <TouchableOpacity
              style={[
                styles.invitationSecondaryButton,
                vm.actionState === 'declining_invitation' &&
                  styles.actionButtonLoading,
              ]}
              onPress={vm.handleDeclineInvitation}
              disabled={
                vm.actionState === 'accepting_invitation' ||
                vm.actionState === 'declining_invitation'
              }
              activeOpacity={0.8}
            >
              {vm.actionState === 'declining_invitation' ? (
                <ActivityIndicator color="#DC2626" size="small" />
              ) : (
                <>
                  <Feather name="x" size={18} color="#DC2626" />
                  <Text style={styles.invitationSecondaryButtonText}>
                    Decline
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.invitationPrimaryButton,
                vm.actionState === 'accepting_invitation' &&
                  styles.actionButtonLoading,
              ]}
              onPress={vm.handleAcceptInvitation}
              disabled={
                vm.actionState === 'accepting_invitation' ||
                vm.actionState === 'declining_invitation'
              }
              activeOpacity={0.8}
            >
              {vm.actionState === 'accepting_invitation' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Accept Invitation</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (vm.actionState === 'declining_invitation') {
      return (
        <View style={styles.statusChip}>
          <Feather name="mail" size={16} color={theme.primary} />
          <Text style={styles.statusChipTextBlue}>Invitation response pending</Text>
        </View>
      );
    }

    if (!isActive) return null;

    if (vm.constraintViolation) {
      return (
        <View style={[styles.actionButton, styles.actionButtonDisabled]}>
          <Feather name="lock" size={18} color={theme.textTertiary} />
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
            <Feather name="users" size={18} color={theme.textTertiary} />
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
            <ActivityIndicator color={theme.textOnPrimary} size="small" />
          ) : (
            <>
              <Feather name="log-in" size={18} color={theme.textOnPrimary} />
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
          <Feather name="send" size={18} color={theme.textOnPrimary} />
          <Text style={styles.actionButtonText}>Request to Join</Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  if (vm.isLoading) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (vm.apiError || !vm.event) {
    const isPrivateOrMissing =
      vm.apiError?.includes('private') || vm.apiError?.includes('not exist');

    return (
      <SafeAreaView style={styles.centeredScreen}>
        <View style={styles.errorContainer}>
          <View
            style={styles.errorIconCircle}
            testID={isPrivateOrMissing ? 'error-icon-lock' : 'error-icon-alert'}
          >
            <Feather
              name={isPrivateOrMissing ? 'lock' : 'alert-circle'}
              size={32}
              color={isPrivateOrMissing ? '#7C3AED' : theme.textTertiary}
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
  const categoryPresentation = event.category
    ? getEventCategoryPresentation(event.category.name, isDark)
    : null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Event Details
        </Text>
        <TouchableOpacity style={styles.headerIconBtn} onPress={vm.handleToggleFavorite}>
          <MaterialIcons
            name={vm.isFavorited ? 'favorite' : 'favorite-border'}
            size={22}
            color={vm.isFavorited ? '#EF4444' : theme.text}
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
            <Image source={{ uri: event.image_url }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Feather name="image" size={48} color={theme.textTertiary} />
            </View>
          )}
          <View style={styles.heroBadgeRow}>
            <PrivacyBadge level={event.privacy_level} />
            <StatusBadge status={event.status} />
          </View>
        </View>

        {/* Auto-completion warning */}
        {(() => {
          const daysLeft = getAutoCompletionDaysLeft(event.status, event.start_time, event.end_time);
          if (daysLeft == null) return null;
          return (
            <View style={styles.warningBanner}>
              <Feather name="alert-triangle" size={16} color={theme.warningText} />
              <Text style={styles.warningBannerText}>
                This event will be automatically completed in {daysLeft} day{daysLeft !== 1 ? 's' : ''} due to inactivity.
              </Text>
            </View>
          );
        })()}

        {/* Core info */}
        <View style={styles.section}>
          {categoryPresentation && (
            <View
              style={[
                styles.categoryChip,
                { backgroundColor: categoryPresentation.color },
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  { color: categoryPresentation.textColor },
                ]}
                numberOfLines={1}
              >
                {categoryPresentation.emoji} {categoryPresentation.label}
              </Text>
            </View>
          )}

          <Text style={styles.eventTitle}>{event.title}</Text>

          <View style={styles.metaRow}>
            <Feather name="clock" size={16} color={theme.textTertiary} />
            <Text style={styles.metaText}>
              {formatEventDateLabel(event.start_time, event.end_time)}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Feather
              name={event.location.type === 'ROUTE' ? 'navigation' : 'map-pin'}
              size={16}
              color={theme.textTertiary}
            />
            <Text style={styles.metaText}>{formatEventLocation(event.location.address)}</Text>
            {event.location.type === 'ROUTE' && (
              <View style={styles.routeChip}>
                <Feather name="navigation" size={10} color={theme.textOnPrimary} />
                <Text style={styles.routeChipText}>Route</Text>
              </View>
            )}
          </View>

          {event.location.meeting_instructions && (
            <View style={styles.meetingPointContainer}>
              <View style={styles.meetingPointHeader}>
                <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
                <Text style={styles.meetingPointTitle}>Meeting Instructions</Text>
              </View>
              <Text style={styles.meetingPointText}>{event.location.meeting_instructions}</Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <Feather name="users" size={16} color={theme.textTertiary} />
            <Text style={styles.metaText}>
              {capacityLabel} participant{event.approved_participant_count !== 1 ? 's' : ''}
              {event.capacity != null ? ' (capacity)' : ''}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Feather name="heart" size={16} color={theme.textTertiary} />
            <Text style={styles.metaText}>{event.favorite_count} saved</Text>
          </View>

          {(() => {
            const isRoute = event.location.type === 'ROUTE';
            const routePoints = event.location.route_points ?? [];
            const showApprox =
              !isRoute &&
              event.location.is_location_approximate &&
              !event.viewer_context.is_host &&
              event.viewer_context.participation_status !== 'JOINED';
            const pointRegion = event.location.point
              ? {
                  latitude: event.location.point.lat,
                  longitude: event.location.point.lon,
                  latitudeDelta: showApprox ? 0.04 : 0.005,
                  longitudeDelta: showApprox ? 0.04 : 0.005,
                }
              : null;
            const routeRegion =
              isRoute && routePoints.length > 0 ? getRouteRegion(routePoints, 1.6) : null;
            const region = pointRegion ?? routeRegion;
            if (!region) return null;

            return (
              <View style={styles.miniMapWrapper}>
                <TouchableOpacity
                  style={styles.miniMapContainer}
                  onPress={() => setIsMapModalVisible(true)}
                  activeOpacity={0.9}
                  testID="mini-map-touchable"
                >
                  <MapView
                    style={styles.miniMap}
                    customMapStyle={isDark ? darkMapStyle : []}
                    region={region}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    {isRoute && polylineCoords && polylineCoords.length >= 2 && (
                      <Polyline
                        coordinates={polylineCoords.map((p) => ({
                          latitude: p.lat,
                          longitude: p.lon,
                        }))}
                        strokeColor={theme.primary}
                        strokeWidth={4}
                      />
                    )}
                    {isRoute
                      ? routePoints.map((p, i) => (
                          <Marker
                            key={`route-mini-${i}-${p.lat}-${p.lon}`}
                            coordinate={{ latitude: p.lat, longitude: p.lon }}
                            title={`${i + 1}`}
                          />
                        ))
                      : event.location.point && (
                          <>
                            <Marker
                              coordinate={{
                                latitude: event.location.point.lat,
                                longitude: event.location.point.lon,
                              }}
                              opacity={showApprox ? 0.5 : 1}
                            />
                            {showApprox && (
                              <Circle
                                center={{
                                  latitude: event.location.point.lat,
                                  longitude: event.location.point.lon,
                                }}
                                radius={APPROX_LOCATION_RADIUS_METERS}
                                fillColor="rgba(251,191,36,0.15)"
                                strokeColor="rgba(217,119,6,0.6)"
                                strokeWidth={2}
                                testID="approx-location-circle"
                              />
                            )}
                          </>
                        )}
                  </MapView>
                  <View style={styles.miniMapOverlay}>
                    <Feather name="maximize-2" size={20} color="white" />
                  </View>
                </TouchableOpacity>
                {showApprox ? (
                  <View style={styles.approxMapCallout} testID="approx-map-callout">
                    <Feather name="alert-triangle" size={16} color={theme.warningText} />
                    <View style={styles.approxMapCalloutBody}>
                      <Text style={styles.approxMapCalloutTitle}>
                        You're seeing an approximate location
                      </Text>
                      <Text style={styles.approxMapCalloutDesc}>
                        The exact location will be revealed once you're approved to join.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.directionsButton}
                    onPress={handleGetDirections}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="directions" size={20} color={theme.primary} />
                    <Text style={styles.directionsButtonText}>
                      {isRoute ? 'Directions to Start' : 'Get Directions'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
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
                <Feather name="user" size={20} color={theme.textTertiary} />
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
                  <Feather name="users" size={18} color={theme.text} />
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
                    <Feather name="mail" size={18} color={theme.textOnPrimary} />
                    <Text style={styles.hostActionTextWhite}>
                      Pending Requests ({vm.hostContextSummary?.pending_join_request_count ?? vm.pendingJoinRequests.length})
                    </Text>
                  </TouchableOpacity>
                )}

                {vm.event.privacy_level === 'PRIVATE' && vm.event.status === 'ACTIVE' && (
                  <TouchableOpacity
                    style={[styles.hostActionBtn, styles.hostActionBtnPrimary]}
                    onPress={() => vm.setShowInvitationsModal(true)}
                  >
                    <Feather name="send" size={18} color={theme.textOnPrimary} />
                    <Text style={styles.hostActionTextWhite}>
                      Invite & Manage ({vm.hostContextSummary?.invitation_count ?? vm.invitations.length})
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
                        ],
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
          styles={styles}
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
                  <MaterialIcons name="check-circle-outline" size={16} color={theme.textTertiary} />
                  <View style={styles.constraintText}>
                    <Text style={styles.constraintType}>{c.type}</Text>
                    <Text style={styles.constraintInfo}>{c.info}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Participation criteria */}
        {(event.minimum_age != null || event.preferred_gender != null) && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Participation criteria</Text>
              {event.minimum_age != null && (
                <View style={styles.metaRow}>
                  <Feather name="user-check" size={16} color={theme.textTertiary} />
                  <Text style={styles.metaText}>Minimum age: {event.minimum_age}+</Text>
                </View>
              )}
              {event.preferred_gender != null && (
                <View style={styles.metaRow}>
                  <Feather name="users" size={16} color={theme.textTertiary} />
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
              placeholderTextColor={theme.placeholder}
              value={vm.joinRequestMessage}
              onChangeText={vm.setJoinRequestMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
              editable={vm.actionState !== 'requesting'}
            />
            <Text style={styles.charCount}>{vm.joinRequestMessage.length}/500</Text>

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
                <ActivityIndicator color={theme.textOnPrimary} size="small" />
              ) : (
                <>
                  <Feather name="send" size={18} color={theme.textOnPrimary} />
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
          <InvitationsModal
            visible={vm.showInvitationsModal}
            invitations={vm.invitations}
            loading={vm.invitationsLoading}
            hasMore={vm.invitationsHasNext}
            onLoadMore={vm.loadMoreInvitations}
            onClose={() => vm.setShowInvitationsModal(false)}
            onInvite={vm.handleInviteUsers}
            isInviting={vm.isInviting}
            userSearchQuery={vm.userSearchQuery}
            setUserSearchQuery={vm.setUserSearchQuery}
            userSuggestions={vm.userSuggestions}
            isSearchingUsers={vm.isSearchingUsers}
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

      {/* Full-screen Map Modal */}
      {vm.event && (() => {
        const location = vm.event.location;
        const isRoute = location.type === 'ROUTE';
        const routePoints = location.route_points ?? [];
        const showApprox =
          !isRoute &&
          location.is_location_approximate &&
          !vm.event.viewer_context.is_host &&
          vm.event.viewer_context.participation_status !== 'JOINED';
        const pointInitial = location.point
          ? {
              latitude: location.point.lat,
              longitude: location.point.lon,
              latitudeDelta: showApprox ? 0.05 : 0.01,
              longitudeDelta: showApprox ? 0.05 : 0.01,
            }
          : null;
        const routeInitial =
          isRoute && routePoints.length > 0 ? getRouteRegion(routePoints, 1.5) : null;
        const initialRegion = pointInitial ?? routeInitial;
        if (!initialRegion) return null;
        const eventTitle = vm.event.title;
        const address = location.address || '';
        return (
          <Modal
            visible={isMapModalVisible}
            animationType="slide"
            onRequestClose={() => setIsMapModalVisible(false)}
          >
          <View style={styles.fullMapContainer}>
            <MapView
              style={styles.fullMap}
              customMapStyle={isDark ? darkMapStyle : []}
              initialRegion={initialRegion}
            >
              {isRoute && polylineCoords && polylineCoords.length >= 2 && (
                <Polyline
                  coordinates={polylineCoords.map((p) => ({ latitude: p.lat, longitude: p.lon }))}
                  strokeColor={theme.primary}
                  strokeWidth={5}
                />
              )}
              {isRoute ? (
                routePoints.map((p, i) => (
                  <Marker
                    key={`route-full-${i}-${p.lat}-${p.lon}`}
                    coordinate={{ latitude: p.lat, longitude: p.lon }}
                    title={`Waypoint ${i + 1}`}
                    description={i === 0 ? 'Start' : i === routePoints.length - 1 ? 'End' : ''}
                  />
                ))
              ) : location.point ? (
                <>
                  <Marker
                    coordinate={{
                      latitude: location.point.lat,
                      longitude: location.point.lon,
                    }}
                    title={eventTitle}
                    description={address}
                    opacity={showApprox ? 0.5 : 1}
                  />
                  {showApprox && (
                    <Circle
                      center={{
                        latitude: location.point.lat,
                        longitude: location.point.lon,
                      }}
                      radius={APPROX_LOCATION_RADIUS_METERS}
                      fillColor="rgba(251,191,36,0.15)"
                      strokeColor="rgba(217,119,6,0.6)"
                      strokeWidth={2}
                    />
                  )}
                </>
              ) : null}
            </MapView>

            <SafeAreaView style={styles.fullMapHeader}>
              <TouchableOpacity
                style={styles.fullMapCloseBtn}
                onPress={() => setIsMapModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
              <View style={styles.fullMapTitleContainer}>
                <Text style={styles.fullMapTitle} numberOfLines={1}>
                  {vm.event.title}
                </Text>
                <Text style={styles.fullMapSubtitle} numberOfLines={1}>
                  {vm.event.location.is_location_approximate &&
                  !vm.event.viewer_context.is_host &&
                  vm.event.viewer_context.participation_status !== 'JOINED'
                    ? 'Approximate location'
                    : vm.event.location.address}
                </Text>
              </View>
            </SafeAreaView>

            {(!vm.event.location.is_location_approximate ||
              vm.event.viewer_context.is_host ||
              vm.event.viewer_context.participation_status === 'JOINED') && (
              <View style={styles.fullMapFooter}>
                <TouchableOpacity
                  style={styles.fullMapDirectionsBtn}
                  onPress={handleGetDirections}
                >
                  <MaterialIcons name="directions" size={24} color="white" />
                  <Text style={styles.fullMapDirectionsText}>Open in Navigation</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>
        );
      })()}
    </SafeAreaView>
  );
}

function makeStyles(t: Theme, isDark: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.background,
    },
    centeredScreen: {
      flex: 1,
      backgroundColor: t.background,
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
      backgroundColor: t.surface,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: t.text,
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
      backgroundColor: t.imagePlaceholder,
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
      backgroundColor: t.imagePlaceholder,
    },
    heroBadgeRow: {
      position: 'absolute',
      bottom: 14,
      left: 14,
      flexDirection: 'row',
      gap: 8,
    },

    /* Section */
    section: {
      paddingHorizontal: 20,
      paddingVertical: 18,
      backgroundColor: t.surface,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    divider: {
      height: 8,
      backgroundColor: t.surfaceVariant,
    },

    /* Category chip */
    categoryChip: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
      marginBottom: 12,
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: '700',
    },

    /* Event title */
    eventTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: t.text,
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
      color: t.textSecondary,
      lineHeight: 20,
      fontWeight: '500',
    },
    routeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: t.primary,
    },
    routeChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: t.textOnPrimary,
      letterSpacing: 0.3,
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
      backgroundColor: t.imagePlaceholder,
    },
    avatarPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.imagePlaceholder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hostInfo: {
      flex: 1,
    },
    hostName: {
      fontSize: 15,
      fontWeight: '700',
      color: t.text,
    },
    hostUsername: {
      fontSize: 13,
      color: t.textSecondary,
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
      color: t.textSecondary,
    },

    /* Description */
    description: {
      fontSize: 15,
      color: t.textSecondary,
      lineHeight: 24,
    },

    /* Tags */
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tag: {
      backgroundColor: t.surfaceVariant,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    tagText: {
      fontSize: 13,
      color: t.textSecondary,
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
      color: t.textSecondary,
      textTransform: 'capitalize',
    },
    constraintInfo: {
      fontSize: 14,
      color: t.textTertiary,
      lineHeight: 20,
      marginTop: 2,
    },

    /* Action bar */
    actionBar: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      paddingBottom: Platform.OS === 'ios' ? 28 : 16,
      backgroundColor: t.surface,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: t.primary,
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
      backgroundColor: t.surfaceVariant,
      borderWidth: 1,
      borderColor: t.border,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: t.textOnPrimary,
    },
    actionButtonTextDisabled: {
      fontSize: 16,
      fontWeight: '600',
      color: t.textTertiary,
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
      backgroundColor: t.surfaceVariant,
      borderWidth: 1,
      borderColor: t.border,
    },
    statusChipTextGreen: {
      fontSize: 15,
      fontWeight: '700',
      color: t.successText,
    },
    statusChipTextAmber: {
      fontSize: 15,
      fontWeight: '700',
      color: t.warningText,
    },
    statusChipTextBlue: {
      fontSize: 15,
      fontWeight: '700',
      color: t.infoText,
    },
    statusChipTextPurple: {
      fontSize: 15,
      fontWeight: '700',
      color: '#7C3AED',
    },
    statusChipTextGray: {
      fontSize: 15,
      fontWeight: '700',
      color: t.textSecondary,
    },
    invitationActionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
    },
    invitationPrimaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: t.primary,
    },
    invitationSecondaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: t.errorBg,
      borderWidth: 1,
      borderColor: t.errorBorder,
    },
    invitationSecondaryButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: t.errorText,
    },
    leaveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 10,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: t.errorBg,
      borderWidth: 1,
      borderColor: t.errorBorder,
    },
    leaveButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: t.errorText,
    },

    /* Rating card */
    ratingCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceVariant,
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
      color: t.text,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      backgroundColor: t.border,
    },
    ratingTitle: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
      color: t.text,
    },
    ratingDeadline: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      fontSize: 13,
      fontWeight: '600',
      color: t.textSecondary,
    },
    ratingCopy: {
      fontSize: 15,
      lineHeight: 24,
      color: t.textSecondary,
    },
    ratingInfoBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: t.warningBg,
      borderWidth: 1,
      borderColor: t.warningBorder,
    },
    ratingInfoBannerText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: t.warningText,
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
      backgroundColor: t.warningBg,
      borderWidth: 1,
      borderColor: t.warningBorder,
      color: t.warningText,
      fontSize: 14,
      fontWeight: '700',
      overflow: 'hidden',
    },
    ratingReadonlyMessage: {
      fontSize: 15,
      lineHeight: 24,
      color: t.textSecondary,
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
      color: t.borderStrong,
    },
    ratingStarIconActive: {
      color: '#F59E0B',
    },
    ratingSelectionSummary: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      fontSize: 14,
      color: t.textSecondary,
      fontWeight: '600',
    },
    ratingSelectionSummaryActive: {
      color: t.warningText,
      borderColor: t.warningBorder,
      backgroundColor: t.warningBg,
    },
    ratingFieldLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: t.textSecondary,
    },
    ratingTextArea: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      padding: 14,
      fontSize: 14,
      lineHeight: 22,
      color: t.text,
      backgroundColor: t.surface,
      minHeight: 112,
    },
    ratingTextAreaError: {
      borderColor: t.errorBorder,
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
    ratingExistingNote: {
      fontSize: 12,
      lineHeight: 18,
      color: t.textMuted,
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
      borderColor: t.border,
      backgroundColor: 'transparent',
    },
    ratingEditButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: t.textSecondary,
    },
    ratingSubmitButton: {
      minWidth: 180,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: t.primary,
    },
    ratingSubmitButtonDisabled: {
      opacity: 0.55,
    },
    ratingSubmitButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: t.textOnPrimary,
    },
    ratingCancelButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: 'transparent',
    },
    ratingCancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
    },
    inlineErrorBanner: {
      backgroundColor: t.errorBg,
      borderWidth: 1,
      borderColor: t.errorBorder,
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
      backgroundColor: t.surfaceVariant,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
    },
    errorMessage: {
      fontSize: 14,
      color: t.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    retryButton: {
      backgroundColor: t.primary,
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 10,
      marginTop: 4,
    },
    retryButtonText: {
      color: t.textOnPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
    backLinkButton: {
      paddingVertical: 8,
    },
    backLinkText: {
      color: t.primary,
      fontSize: 15,
      fontWeight: '600',
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.warningBg,
      borderWidth: 1,
      borderColor: t.warningBorder,
      borderRadius: 10,
      padding: 12,
      marginHorizontal: 20,
      marginTop: 12,
    },
    warningBannerText: {
      flex: 1,
      color: t.warningText,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
    },
    approxMapCallout: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: t.warningBorder,
      backgroundColor: t.warningBg,
    },
    approxMapCalloutBody: {
      flex: 1,
      gap: 2,
    },
    approxMapCalloutTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: t.warningText,
    },
    approxMapCalloutDesc: {
      fontSize: 12,
      lineHeight: 17,
      color: t.warningText,
      opacity: 0.85,
    },
    errorBanner: {
      backgroundColor: t.errorBg,
      borderWidth: 1,
      borderColor: t.errorBorder,
      borderRadius: 10,
      padding: 12,
      marginTop: 8,
      marginHorizontal: 20,
    },
    errorBannerText: {
      color: t.errorText,
      fontSize: 14,
    },

    /* Join request modal */
    modalOverlay: {
      flex: 1,
      backgroundColor: t.overlayLight,
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: t.surface,
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
      backgroundColor: t.border,
      alignSelf: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: t.text,
      marginBottom: 6,
    },
    modalSubtitle: {
      fontSize: 14,
      color: t.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
      marginBottom: 8,
    },
    messageInput: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: t.text,
      backgroundColor: t.surfaceVariant,
      minHeight: 110,
    },
    charCount: {
      fontSize: 12,
      color: t.placeholder,
      textAlign: 'right',
      marginTop: 4,
      marginBottom: 16,
    },
    miniMapWrapper: {
      marginTop: 12,
      marginBottom: 8,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceAlt,
    },
    miniMapContainer: {
      height: 150,
      width: '100%',
    },
    miniMap: {
      ...StyleSheet.absoluteFillObject,
    },
    directionsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    directionsButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: t.primary,
    },
    meetingPointContainer: {
      marginTop: 8,
      marginBottom: 16,
      padding: 12,
      backgroundColor: t.primary + '10', // 10% opacity primary color
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.primary + '30', // 30% opacity primary color
    },
    meetingPointHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    meetingPointTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: t.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    meetingPointText: {
      fontSize: 14,
      lineHeight: 20,
      color: t.text,
    },
    miniMapOverlay: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      backgroundColor: 'rgba(0,0,0,0.4)',
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullMapContainer: {
      flex: 1,
      backgroundColor: t.background,
    },
    fullMap: {
      flex: 1,
    },
    fullMapHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: isDark ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.9)',
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    fullMapCloseBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullMapTitleContainer: {
      flex: 1,
      marginLeft: 12,
    },
    fullMapTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: t.text,
    },
    fullMapSubtitle: {
      fontSize: 12,
      color: t.textSecondary,
    },
    fullMapFooter: {
      position: 'absolute',
      bottom: 30,
      left: 20,
      right: 20,
    },
    fullMapDirectionsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#334155' : t.primary, // Darker blue-gray in dark mode
      paddingVertical: 16,
      borderRadius: 16,
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    fullMapDirectionsText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '700',
    },
    cancelButton: {
      alignItems: 'center',
      paddingVertical: 14,
      marginTop: 10,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: t.textSecondary,
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
      backgroundColor: t.surfaceAlt,
      borderColor: t.border,
    },
    hostActionBtnPrimary: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    hostActionBtnDanger: {
      backgroundColor: t.errorBg,
      borderColor: t.errorBorder,
    },
    hostActionText: {
      fontSize: 16,
      fontWeight: '600',
      color: t.text,
    },
    hostActionTextWhite: {
      fontSize: 16,
      fontWeight: '600',
      color: t.textOnPrimary,
    },
    hostActionTextDanger: {
      fontSize: 16,
      fontWeight: '600',
      color: '#DC2626',
    },
    hostActionHint: {
      fontSize: 13,
      lineHeight: 19,
      color: t.textSecondary,
      marginTop: -4,
    },
  });
}
