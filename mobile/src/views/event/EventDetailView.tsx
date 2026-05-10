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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useEventDetailViewModel } from '@/viewmodels/event/useEventDetailViewModel';
import { fetchRoutedGeometry } from '@/services/eventService';
import { formatEventDateLabel, getAutoCompletionDaysLeft } from '@/utils/eventDate';
import {
  formatEventStatusLabel,
  getEventStatusBadgeColors,
} from '@/utils/eventStatus';
import { formatEventLocation } from '@/utils/eventLocation';
import { EventDetail } from '@/models/event';
import EventCategoryChip from '@/components/events/EventCategoryChip';
import JoinRequestsModal from '@/components/events/JoinRequestsModal';
import ParticipantListModal from '@/components/events/ParticipantListModal';
import InvitationsModal from '@/components/events/InvitationsModal';
import ReportEventModal from '@/components/events/ReportEventModal';
import EventDiscussionSection from '@/components/events/EventDiscussionSection';
import { useEventDiscussionViewModel } from '@/viewmodels/event/useEventDiscussionViewModel';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { DARK_MAP_STYLE } from '@/theme/mapStyle';

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
  const { t } = useTranslation();
  const label = level ? t(`events.privacy.${level}`) : '';

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

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const ATTENDANCE_CRITICAL_FIELDS = new Set([
  'start_time',
  'end_time',
  'location',
  'privacy_level',
  'capacity',
  'minimum_age',
  'preferred_gender',
  'constraints',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function humanizeFieldName(field: string): string {
  return field
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getChangeFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: 'Title',
    description: 'Description',
    image_url: 'Cover image',
    category: 'Category',
    category_id: 'Category',
    location: 'Location or route',
    start_time: 'Start time',
    end_time: 'End time',
    privacy_level: 'Privacy',
    capacity: 'Capacity',
    minimum_age: 'Minimum age',
    preferred_gender: 'Preferred gender',
    constraints: 'Participation requirements',
    tags: 'Tags',
    child_friendly: 'Child friendly',
    family_oriented: 'Family oriented',
    status: 'Status',
  };
  return labels[field] ?? humanizeFieldName(field);
}

function getChangeFieldIcon(field: string): FeatherIconName {
  const icons: Record<string, FeatherIconName> = {
    start_time: 'clock',
    end_time: 'clock',
    location: 'map-pin',
    privacy_level: 'lock',
    constraints: 'check-square',
    capacity: 'users',
    minimum_age: 'user-check',
    preferred_gender: 'users',
    category: 'grid',
    category_id: 'grid',
    tags: 'tag',
    description: 'align-left',
    title: 'type',
  };
  return icons[field] ?? 'edit-3';
}

function formatTitleCaseValue(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatCoordinates(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const lat = value.lat;
  const lon = value.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function formatHistoryLocation(value: unknown): string {
  if (!isRecord(value)) return value == null ? 'Not set' : String(value);

  const type = typeof value.type === 'string' ? value.type : 'POINT';
  const address =
    typeof value.address === 'string' && value.address.trim()
      ? value.address.trim()
      : null;
  const routePoints = Array.isArray(value.route_points) ? value.route_points : [];
  const point = formatCoordinates(value.point);

  if (type === 'ROUTE') {
    const waypointLabel =
      routePoints.length > 0
        ? `${routePoints.length} waypoint${routePoints.length === 1 ? '' : 's'}`
        : 'route';
    return address ? `${address} (${waypointLabel})` : `Route (${waypointLabel})`;
  }

  return address ?? point ?? 'Point location';
}

function formatConstraintList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return 'None';

  return value
    .map((item) => {
      if (!isRecord(item)) return String(item);
      const type = typeof item.type === 'string' ? item.type : 'Requirement';
      const info = typeof item.info === 'string' ? item.info : '';
      return info.trim() ? `${formatTitleCaseValue(type)}: ${info.trim()}` : formatTitleCaseValue(type);
    })
    .join('\n');
}

function formatDiffValue(field: string, value: unknown): string {
  if (value == null) {
    if (field === 'capacity') return 'Unlimited';
    return 'Not set';
  }

  if (field === 'start_time' || field === 'end_time') {
    return typeof value === 'string' ? formatLongDateTime(value) : String(value);
  }

  if (field === 'location') return formatHistoryLocation(value);
  if (field === 'constraints') return formatConstraintList(value);
  if (field === 'privacy_level' || field === 'preferred_gender' || field === 'status') {
    return typeof value === 'string' ? formatTitleCaseValue(value) : String(value);
  }
  if (field === 'capacity') return typeof value === 'number' ? `${value} participants` : String(value);
  if (field === 'minimum_age') return typeof value === 'number' ? `${value}+` : String(value);
  if (field === 'category' || field === 'category_id') {
    if (isRecord(value) && typeof value.name === 'string') return value.name;
    return String(value);
  }
  if (field === 'tags' && Array.isArray(value)) {
    return value.length > 0 ? value.map((tag) => `#${String(tag)}`).join(', ') : 'None';
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value.trim() || 'Not set';
  if (typeof value === 'number') return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getVersionNumber(event: EventDetail): number | null {
  return (
    event.version_no ??
    event.viewer_context.latest_event_version ??
    event.viewer_context.event_diff?.to_version_no ??
    null
  );
}

function canEditEvent(event: EventDetail): boolean {
  return event.status === 'ACTIVE' && new Date(event.start_time).getTime() > Date.now();
}

function canViewEventHistory(event: EventDetail): boolean {
  const status = event.viewer_context.participation_status;
  return status === 'JOINED' || status === 'PENDING';
}

function summarizeChangedFields(changedFields: string[]): string[] {
  const summaries: string[] = [];
  const add = (summary: string) => {
    if (!summaries.includes(summary)) summaries.push(summary);
  };

  if (changedFields.includes('start_time') || changedFields.includes('end_time')) {
    add('Time changed');
  }
  if (changedFields.includes('location')) add('Location or route changed');
  if (changedFields.includes('privacy_level')) add('Privacy changed');
  if (
    changedFields.includes('capacity') ||
    changedFields.includes('minimum_age') ||
    changedFields.includes('preferred_gender') ||
    changedFields.includes('constraints')
  ) {
    add('Participation rules changed');
  }

  changedFields.forEach((field) => {
    if (!ATTENDANCE_CRITICAL_FIELDS.has(field)) add(`${getChangeFieldLabel(field)} changed`);
  });

  return summaries.length > 0 ? summaries : ['Event details changed'];
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

function EventVersionHistorySection({
  event,
  styles,
}: {
  event: EventDetail;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { theme } = useTheme();
  const diff = event.viewer_context.event_diff ?? null;
  const changes = diff?.changes ?? [];
  const versionNo = getVersionNumber(event);

  if (!canViewEventHistory(event)) return null;
  if (!diff && versionNo == null) return null;

  const summaries = summarizeChangedFields(
    diff?.changed_fields ?? changes.map((change) => change.field),
  );
  const needsReconfirmation = Boolean(event.viewer_context.needs_reconfirmation);

  return (
    <>
      <View style={styles.divider} />
      <View style={styles.section} testID="event-version-history">
        <View style={styles.versionHeaderRow}>
          <Text style={styles.sectionTitle}>Version History</Text>
          {versionNo != null ? (
            <Text style={styles.versionCurrentLabel}>v{versionNo}</Text>
          ) : null}
        </View>

        <View style={styles.versionHistoryCard}>
          {needsReconfirmation ? (
            <View style={styles.versionAttentionBanner}>
              <Feather name="alert-triangle" size={16} color={theme.warningText} />
              <Text style={styles.versionAttentionText}>
                Review these changes before confirming that you can still attend.
              </Text>
            </View>
          ) : null}

          {diff ? (
            <Text style={styles.versionRangeText}>
              Changes from version {diff.from_version_no} to {diff.to_version_no}
            </Text>
          ) : (
            <Text style={styles.versionRangeText}>
              Current event version{versionNo != null ? ` ${versionNo}` : ''}
            </Text>
          )}

          {changes.length > 0 ? (
            <>
              <View style={styles.versionSummaryRow}>
                {summaries.map((summary) => (
                  <View key={summary} style={styles.versionSummaryPill}>
                    <Text style={styles.versionSummaryPillText}>{summary}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.versionChangeList}>
                {changes.map((change, index) => {
                  const isCritical = ATTENDANCE_CRITICAL_FIELDS.has(change.field);
                  return (
                    <View
                      key={`${change.field}-${index}`}
                      style={styles.versionChangeRow}
                    >
                      <View style={styles.versionChangeIcon}>
                        <Feather
                          name={getChangeFieldIcon(change.field)}
                          size={16}
                          color={theme.primary}
                        />
                      </View>
                      <View style={styles.versionChangeBody}>
                        <View style={styles.versionChangeTitleRow}>
                          <Text style={styles.versionChangeTitle}>
                            {getChangeFieldLabel(change.field)}
                          </Text>
                          {isCritical ? (
                            <Text style={styles.versionImpactLabel}>Attendance impact</Text>
                          ) : null}
                        </View>

                        <View style={styles.versionValueBlock}>
                          <Text style={styles.versionValueLabel}>Before</Text>
                          <Text style={styles.versionValueText}>
                            {formatDiffValue(change.field, change.old_value)}
                          </Text>
                        </View>
                        <View style={styles.versionValueBlock}>
                          <Text style={styles.versionValueLabel}>Now</Text>
                          <Text style={styles.versionValueText}>
                            {formatDiffValue(change.field, change.new_value)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.versionEmptyState}>
              <Feather name="check-circle" size={18} color={theme.successText} />
              <Text style={styles.versionEmptyTitle}>
                No changes need your review right now.
              </Text>
              <Text style={styles.versionEmptyText}>
                If future edits affect time, location, privacy, or participation rules, they will appear here.
              </Text>
            </View>
          )}
        </View>
      </View>
    </>
  );
}

/** Radius (metres) of the circle drawn around a fuzzed PROTECTED event location. */
const APPROX_LOCATION_RADIUS_METERS = 500;

export default function EventDetailView({ eventId }: EventDetailViewProps) {
  const vm = useEventDetailViewModel(eventId);
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const discussionVm = useEventDiscussionViewModel(eventId, vm.token ?? undefined);
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
    const needsReconfirmation = Boolean(vm.event.viewer_context.needs_reconfirmation);

    if (vm.event.viewer_context.is_host) {
      return (
        <View style={styles.statusChip}>
          <Feather name="star" size={16} color="#7C3AED" />
          <Text style={styles.statusChipTextPurple}>{t('events.detail.youAreHosting')}</Text>
        </View>
      );
    }

    if (status_ === 'LEAVED' || vm.actionState === 'success_left') {
      const eventNotStarted = new Date() < new Date(vm.event.start_time);
      if (!eventNotStarted) {
        return (
          <View style={styles.statusChip}>
            <Ionicons name="log-out-outline" size={16} color={theme.textTertiary} />
            <Text style={styles.statusChipTextGray}>{t('events.detail.youLeft')}</Text>
          </View>
        );
      }
    }

    if (needsReconfirmation && vm.actionState !== 'success_reconfirmed') {
      const isReconfirmationBusy =
        vm.actionState === 'reconfirming' || vm.actionState === 'leaving';
      return (
        <View>
          <View style={[styles.statusChip, styles.reconfirmStatusChip]}>
            <Feather name="alert-triangle" size={16} color={theme.warningText} />
            <Text style={styles.statusChipTextAmber}>Attendance needs reconfirmation</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.reconfirmActionButton,
              vm.actionState === 'reconfirming' && styles.actionButtonLoading,
            ]}
            onPress={vm.handleReconfirmParticipation}
            disabled={isReconfirmationBusy}
            activeOpacity={0.8}
          >
            {vm.actionState === 'reconfirming' ? (
              <ActivityIndicator color={theme.textOnPrimary} size="small" />
            ) : (
              <>
                <Feather name="refresh-cw" size={18} color={theme.textOnPrimary} />
                <Text style={styles.actionButtonText}>Reconfirm Attendance</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.reconfirmRejectButton,
              vm.actionState === 'leaving' && styles.actionButtonLoading,
            ]}
            onPress={() => {
              Alert.alert(
                'Reject Reconfirmation',
                'Rejecting this update will remove you from the event.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reject & Leave',
                    style: 'destructive',
                    onPress: vm.handleLeaveEvent,
                  },
                ],
              );
            }}
            disabled={isReconfirmationBusy}
            activeOpacity={0.8}
          >
            {vm.actionState === 'leaving' ? (
              <ActivityIndicator color="#DC2626" size="small" />
            ) : (
              <>
                <Feather name="x-circle" size={18} color="#DC2626" />
                <Text style={styles.leaveButtonText}>Reject Reconfirmation</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    if (
      status_ === 'JOINED' ||
      vm.actionState === 'success_joined' ||
      vm.actionState === 'success_reconfirmed'
    ) {
      const attendedLabel =
        vm.actionState === 'success_reconfirmed'
          ? t('events.detail.attendingReconfirmed')
          : vm.event.status === 'COMPLETED'
            ? t('events.detail.youAttended')
            : t('events.detail.attending');

      return (
        <View>
          <View style={styles.statusChip}>
            <Ionicons name="checkmark-circle" size={16} color={theme.successText} />
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
                  <Text style={styles.leaveButtonText}>{t('events.detail.leaveEvent')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (status_ === 'PENDING' || vm.actionState === 'success_requested') {
      return (
        <View>
          <View style={styles.statusChip}>
            <Feather name="clock" size={16} color={theme.warningText} />
            <Text style={styles.statusChipTextAmber}>{t('events.detail.requestPending')}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.leaveButton,
              vm.actionState === 'canceling_request' && styles.actionButtonLoading,
            ]}
            onPress={() => {
              Alert.alert(
                'Cancel Request',
                'Are you sure you want to withdraw your join request?',
                [
                  { text: 'No', style: 'cancel' },
                  {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: vm.handleCancelJoinRequest,
                  },
                ],
              );
            }}
            disabled={vm.actionState === 'canceling_request'}
            activeOpacity={0.8}
          >
            {vm.actionState === 'canceling_request' ? (
              <ActivityIndicator color="#DC2626" size="small" />
            ) : (
              <>
                <Feather name="x-circle" size={18} color="#DC2626" />
                <Text style={styles.leaveButtonText}>{t('events.detail.cancelRequest')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    if (status_ === 'INVITED') {
      return (
        <View>
          <View style={styles.statusChip}>
            <Feather name="mail" size={16} color={theme.infoText} />
            <Text style={styles.statusChipTextBlue}>{t('events.detail.youAreInvited')}</Text>
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
            <Text style={styles.actionButtonTextDisabled}>{t('events.detail.eventFull')}</Text>
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
              <Text style={styles.actionButtonText}>{t('events.detail.joinEvent')}</Text>
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
          <Text style={styles.actionButtonText}>{t('events.detail.requestToJoin')}</Text>
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
            {isPrivateOrMissing
              ? t('events.detail.errorTitleInaccessible')
              : t('events.detail.errorTitle')}
          </Text>
          <Text style={styles.errorMessage}>
            {vm.apiError ?? 'The event you are looking for could not be found.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={vm.retry}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLinkButton} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>{t('events.detail.backToDiscovery')}</Text>
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
          <Feather name="arrow-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('events.detail.headerTitle')}
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={vm.handleToggleFavorite}>
            <MaterialIcons
              name={vm.isFavorited ? 'favorite' : 'favorite-border'}
              size={22}
              color={vm.isFavorited ? '#EF4444' : theme.text}
            />
          </TouchableOpacity>
          {!vm.event.viewer_context.is_host && (
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => vm.setShowReportModal(true)}
              accessibilityLabel="Report event"
            >
              <Feather name="flag" size={20} color={theme.text} />
            </TouchableOpacity>
          )}
        </View>
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

        {event.viewer_context.needs_reconfirmation ? (
          <View style={[styles.warningBanner, styles.reconfirmationBanner]} testID="reconfirmation-banner">
            <Feather name="alert-triangle" size={16} color={theme.warningText} />
            <Text style={styles.warningBannerText}>
              Event details changed since you last confirmed. Review the version history and reconfirm if you can still attend, or reject to leave the event.
            </Text>
          </View>
        ) : null}

        {/* Core info */}
        <View style={styles.section}>
          {event.category && (
            <View style={styles.categoryChipWrap}>
              <EventCategoryChip
                categoryName={event.category.name}
                testID="event-detail-category-chip"
              />
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
                    key={`event-detail-mini-map-${isDark ? 'dark' : 'light'}`}
                    style={styles.miniMap}
                    userInterfaceStyle={isDark ? 'dark' : 'light'}
                    customMapStyle={isDark ? DARK_MAP_STYLE : []}
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
                      {isRoute
                        ? t('events.detail.directionsToStart')
                        : t('events.detail.directions')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
        </View>

        <EventVersionHistorySection event={event} styles={styles} />

        <View style={styles.divider} />

        {/* Host */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('events.detail.host')}</Text>
          <TouchableOpacity
            style={styles.hostRow}
            onPress={() => router.push(`/user/${event.host.id}` as Href)}
            activeOpacity={0.7}
          >
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
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Host Management */}
        {vm.event.viewer_context.is_host && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('events.detail.hostManagement')}</Text>
              <View style={styles.hostActions}>
                {canEditEvent(vm.event) ? (
                  <TouchableOpacity
                    style={[styles.hostActionBtn, styles.hostActionBtnPrimary]}
                    onPress={() => router.push(`/event/${event.id}/edit` as Href)}
                    accessibilityLabel="Edit event"
                  >
                    <Feather name="edit-3" size={18} color={theme.textOnPrimary} />
                    <Text style={styles.hostActionTextWhite}>Edit Event</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.hostActionBtn, styles.hostActionBtnSecondary]}
                  onPress={() => vm.setShowAttendeesModal(true)}
                >
                  <Feather name="users" size={18} color={theme.text} />
                  <Text style={styles.hostActionText}>
                    {t('events.detail.participants')} ({vm.hostContextSummary?.approved_participant_count ?? vm.approvedParticipants.length})
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
                      {t('events.detail.pendingRequests')} ({vm.hostContextSummary?.pending_join_request_count ?? vm.pendingJoinRequests.length})
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
                      {t('events.detail.inviteAndManage')} ({vm.hostContextSummary?.invitation_count ?? vm.invitations.length})
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
                    <Text style={styles.hostActionTextDanger}>{t('events.detail.cancelEvent')}</Text>
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
              <Text style={styles.sectionTitle}>{t('events.detail.about')}</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          </>
        ) : null}

        {/* Tags */}
        {event.tags.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('events.detail.tags')}</Text>
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
              <Text style={styles.sectionTitle}>{t('events.detail.requirements')}</Text>
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

        {/* Discussion — available for public and protected events only */}
        {event.privacy_level !== 'PRIVATE' && (() => {
          const isHost = vm.event.viewer_context.is_host;
          const participationStatus = vm.event.viewer_context.participation_status;
          const isQualifiedParticipant =
            participationStatus === 'JOINED' ||
            (participationStatus === 'LEAVED' && new Date() >= new Date(event.start_time));

          const canPostDiscussion =
            Boolean(vm.token) &&
            (event.status === 'ACTIVE' ||
              (event.status === 'IN_PROGRESS' && (isHost || isQualifiedParticipant)));

          const ratingWindowOpen =
            event.status === 'COMPLETED' &&
            new Date() <= new Date(event.rating_window.closes_at);

          const canPostReview =
            Boolean(vm.token) &&
            ratingWindowOpen &&
            !isHost &&
            isQualifiedParticipant;

          return (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('events.detail.discussions')}</Text>
              </View>
              <EventDiscussionSection
                vm={discussionVm}
                eventStatus={event.status}
                isAuthenticated={Boolean(vm.token)}
                canPostDiscussion={canPostDiscussion}
                canPostReview={canPostReview}
                hasExistingReview={discussionVm.reviews.items.some(
                  (r) => r.user.id === vm.user?.id,
                )}
                reviewWindowClosed={
                  event.status === 'COMPLETED' && !ratingWindowOpen
                }
              />
            </>
          );
        })()}

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

            <View style={styles.attachmentSection}>
              <Text style={styles.label}>Attachment (Evidence)</Text>
              {vm.selectedImageUri ? (
                <View style={styles.attachmentPreviewContainer}>
                  <Image source={{ uri: vm.selectedImageUri }} style={styles.attachmentPreview} />
                  <TouchableOpacity
                    style={styles.removeAttachmentBtn}
                    onPress={vm.removeImage}
                    disabled={vm.isUploadingImage}
                  >
                    <Feather name="x" size={16} color="white" />
                  </TouchableOpacity>
                  {vm.isUploadingImage && (
                    <View style={styles.attachmentLoadingOverlay}>
                      <ActivityIndicator color="white" size="small" />
                    </View>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addAttachmentBtn}
                  onPress={vm.pickImage}
                  activeOpacity={0.7}
                >
                  <Feather name="image" size={20} color={theme.primary} />
                  <Text style={styles.addAttachmentText}>Add Photo Evidence</Text>
                </TouchableOpacity>
              )}
              {vm.imageError ? (
                <Text style={styles.attachmentErrorText}>{vm.imageError}</Text>
              ) : null}
            </View>

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
            onRevoke={vm.handleRevokeInvitation}
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
              key={`event-detail-full-map-${isDark ? 'dark' : 'light'}`}
              style={styles.fullMap}
              userInterfaceStyle={isDark ? 'dark' : 'light'}
              customMapStyle={isDark ? DARK_MAP_STYLE : []}
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

            <SafeAreaView
              style={[
                styles.fullMapHeader,
                Platform.OS === 'ios' ? { paddingTop: Math.max(insets.top, 12) } : null,
              ]}
            >
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

      {vm.event && (
        <ReportEventModal
          visible={vm.showReportModal}
          onClose={() => vm.setShowReportModal(false)}
          category={vm.reportCategory}
          onCategoryChange={vm.setReportCategory}
          message={vm.reportMessage}
          onMessageChange={vm.setReportMessage}
          onSubmit={vm.handleReportEvent}
          loading={vm.actionState === 'reporting'}
          imageUri={vm.reportImageUri}
          onPickImage={vm.pickReportImage}
          onRemoveImage={vm.removeReportImage}
          allowImage={vm.canAttachReportImage}
        />
      )}
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
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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

    /* Join Request Modal Attachments */
    attachmentSection: {
      marginTop: 20,
      marginBottom: 10,
    },
    addAttachmentBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: t.primary,
      borderStyle: 'dashed',
      borderRadius: 12,
      backgroundColor: t.primary + '08',
    },
    addAttachmentText: {
      fontSize: 14,
      fontWeight: '600',
      color: t.primary,
    },
    attachmentPreviewContainer: {
      position: 'relative',
      width: '100%',
      height: 180,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: t.surfaceVariant,
    },
    attachmentPreview: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    removeAttachmentBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachmentLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachmentErrorText: {
      fontSize: 12,
      color: '#DC2626',
      marginTop: 6,
      fontWeight: '500',
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

    /* Version history */
    versionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    versionCurrentLabel: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: t.surfaceVariant,
      borderWidth: 1,
      borderColor: t.border,
      color: t.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      overflow: 'hidden',
    },
    versionHistoryCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceAlt,
      padding: 14,
      gap: 12,
    },
    versionAttentionBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: t.warningBg,
      borderWidth: 1,
      borderColor: t.warningBorder,
    },
    versionAttentionText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: t.warningText,
      fontWeight: '600',
    },
    versionRangeText: {
      fontSize: 13,
      lineHeight: 18,
      color: t.textSecondary,
      fontWeight: '600',
    },
    versionSummaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    versionSummaryPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: t.infoBg,
      borderWidth: 1,
      borderColor: t.infoBorder,
    },
    versionSummaryPillText: {
      fontSize: 12,
      lineHeight: 16,
      color: t.infoText,
      fontWeight: '700',
    },
    versionChangeList: {
      gap: 10,
    },
    versionChangeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    versionChangeIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
    },
    versionChangeBody: {
      flex: 1,
      gap: 8,
    },
    versionChangeTitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    versionChangeTitle: {
      fontSize: 14,
      lineHeight: 20,
      color: t.text,
      fontWeight: '800',
    },
    versionImpactLabel: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: t.warningBg,
      borderWidth: 1,
      borderColor: t.warningBorder,
      color: t.warningText,
      fontSize: 11,
      fontWeight: '700',
      overflow: 'hidden',
    },
    versionValueBlock: {
      gap: 3,
    },
    versionValueLabel: {
      fontSize: 11,
      lineHeight: 14,
      color: t.textMuted,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    versionValueText: {
      fontSize: 13,
      lineHeight: 19,
      color: t.textSecondary,
      fontWeight: '500',
    },
    versionEmptyState: {
      alignItems: 'flex-start',
      gap: 6,
      paddingTop: 2,
    },
    versionEmptyTitle: {
      fontSize: 14,
      lineHeight: 20,
      color: t.text,
      fontWeight: '800',
    },
    versionEmptyText: {
      fontSize: 13,
      lineHeight: 19,
      color: t.textSecondary,
      fontWeight: '500',
    },

    /* Category chip */
    categoryChipWrap: {
      marginBottom: 12,
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
    reconfirmActionButton: {
      marginTop: 10,
    },
    reconfirmRejectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 10,
      borderRadius: 14,
      paddingVertical: 14,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: '#FCA5A5',
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
    reconfirmStatusChip: {
      backgroundColor: t.warningBg,
      borderColor: t.warningBorder,
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
    reconfirmationBanner: {
      alignItems: 'flex-start',
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
