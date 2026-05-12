import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { useEventDetailViewModel } from '@/viewmodels/event/useEventDetailViewModel';
import type {
  EventReportCategory,
  EventDetailApprovedParticipant,
  EventDetailInvitation,
  EventDetailPendingJoinRequest,
  EventDetailResponse,
  EventHostContextSummary,
  EventVersionChange,
} from '@/models/event';
import type {
  CreateEventInvitationsResponse,
  EventInvitationFailure,
  InvitationFailureCode,
} from '@/models/invitation';
import { EventCoverImage } from '@/components/EventCoverImage';
import { RatingWithCount } from '@/components/RatingWithCount';
import { UserAvatar } from '@/components/UserAvatar';
import { getEventCategoryPresentation } from '@/utils/eventCategoryPresentation';
import { getEventLifecyclePresentation, getEventStatusPresentation } from '@/utils/eventStatus';
import { getApproximateLocationText } from '@/utils/locationApproximation';
import { formatEventLocation } from '@/utils/eventLocation';
import NotFoundView from '../fallback/NotFoundView';
import AccessDeniedView from '../fallback/AccessDeniedView';
import EventInteractionPanel from './EventInteractionPanel';
import '@/styles/event-detail.css';
import '@/styles/event-detail-attachment.css';

const EventDetailMiniMap = lazy(() => import('./EventDetailMiniMap'));

export function buildDirectionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${lat},${lon}`,
  )}`;
}

const FEEDBACK_MIN_LENGTH = 10;
const FEEDBACK_MAX_LENGTH = 100;
const REPORT_MESSAGE_MAX_LENGTH = 1000;

function getReportReasons(): Array<{ value: EventReportCategory; label: string; hint: string }> {
  return [
    {
      value: 'SPAM_OR_SCAM',
      label: i18n.t('event_detail.report_reasons.SPAM_OR_SCAM.label'),
      hint: i18n.t('event_detail.report_reasons.SPAM_OR_SCAM.hint'),
    },
    {
      value: 'INAPPROPRIATE_CONTENT',
      label: i18n.t('event_detail.report_reasons.INAPPROPRIATE_CONTENT.label'),
      hint: i18n.t('event_detail.report_reasons.INAPPROPRIATE_CONTENT.hint'),
    },
    {
      value: 'HARASSMENT',
      label: i18n.t('event_detail.report_reasons.HARASSMENT.label'),
      hint: i18n.t('event_detail.report_reasons.HARASSMENT.hint'),
    },
  ];
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(i18n.resolvedLanguage, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const ATTENDANCE_CRITICAL_FIELDS = new Set([
  'title',
  'description',
  'category',
  'category_id',
  'location',
  'start_time',
  'end_time',
  'privacy_level',
  'capacity',
  'minimum_age',
  'maximum_age',
  'preferred_gender',
  'constraints',
]);

function formatTitleCaseValue(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatGenderValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    male: i18n.t('auth.register.gender_options.male'),
    female: i18n.t('auth.register.gender_options.female'),
    other: i18n.t('auth.register.gender_options.other'),
    prefer_not_to_say: i18n.t('auth.register.gender_options.prefer_not_to_say'),
  };
  return labels[normalized] ?? formatTitleCaseValue(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatConstraintType(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') return i18n.t('event_detail.requirements');
  const normalized = value.trim().toUpperCase();
  const labels: Record<string, string> = {
    AGE: i18n.t('event_detail.minimum_age'),
    MINIMUM_AGE: i18n.t('event_detail.minimum_age'),
    MAXIMUM_AGE: i18n.t('event_detail.maximum_age', { defaultValue: 'Maximum Age' }),
    GENDER: i18n.t('event_detail.preferred_gender'),
    PREFERRED_GENDER: i18n.t('event_detail.preferred_gender'),
    CAPACITY: i18n.t('event_detail.capacity'),
    EQUIPMENT: i18n.t('public_profile.equipment_title'),
    EXPERIENCE: i18n.t('event_detail.experience', { defaultValue: 'Experience' }),
    SKILL: i18n.t('event_detail.skill', { defaultValue: 'Skill' }),
    ACCESSIBILITY: i18n.t('event_detail.accessibility', { defaultValue: 'Accessibility' }),
    CUSTOM: i18n.t('event_detail.other', { defaultValue: 'Other' }),
    OTHER: i18n.t('event_detail.other', { defaultValue: 'Other' }),
  };
  return labels[normalized] ?? formatTitleCaseValue(normalized);
}

function formatConstraintList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return i18n.t('event_detail.none');
  return value
    .map((item) => {
      if (isRecord(item)) {
        const type = formatConstraintType(item.type);
        const info = typeof item.info === 'string' ? item.info.trim() : '';
        return info ? `${type}: ${info}` : type;
      }
      return String(item);
    })
    .join(' · ');
}

function formatHistoryLocation(value: unknown): string {
  if (!isRecord(value)) return value == null ? i18n.t('common.not_set') : String(value);
  const type = typeof value.type === 'string' ? value.type : null;
  const address = typeof value.address === 'string' && value.address.trim() ? value.address : null;
  if (type === 'ROUTE') {
    const routePoints = Array.isArray(value.route_points) ? value.route_points.length : 0;
    return [address, routePoints ? i18n.t('event_detail.route_points_count', { count: routePoints }) : null]
      .filter(Boolean)
      .join(' · ') || i18n.t('create_event.route');
  }
  const point = isRecord(value.point) ? value.point : null;
  const lat = typeof point?.lat === 'number' ? point.lat : null;
  const lon = typeof point?.lon === 'number' ? point.lon : null;
  return [address, lat != null && lon != null ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : null]
    .filter(Boolean)
    .join(' · ') || i18n.t('event_detail.point_location');
}

function formatDiffValue(field: string, value: unknown): string {
  if (value == null) return field === 'capacity' ? i18n.t('common.unlimited') : i18n.t('common.not_set');
  if (field === 'start_time' || field === 'end_time') {
    return typeof value === 'string' ? formatDateTime(value) : String(value);
  }
  if (field === 'location') return formatHistoryLocation(value);
  if (field === 'constraints') return formatConstraintList(value);
  if (field === 'privacy_level' || field === 'preferred_gender' || field === 'status') {
    if (field === 'preferred_gender') return formatGenderValue(typeof value === 'string' ? value : null) ?? i18n.t('common.not_set');
    if (field === 'privacy_level') {
      return typeof value === 'string'
        ? i18n.t(`events.privacy.${value}`, { defaultValue: formatTitleCaseValue(value) })
        : String(value);
    }
    if (field === 'status') {
      return typeof value === 'string' ? getEventStatusPresentation(value).label : String(value);
    }
    return typeof value === 'string' ? formatTitleCaseValue(value) : String(value);
  }
  if (field === 'capacity') return typeof value === 'number' ? i18n.t('event_detail.participants_metric', { count: value }) : String(value);
  if (field === 'minimum_age') return typeof value === 'number' ? `${value}+` : String(value);
  if (field === 'maximum_age') return typeof value === 'number' ? i18n.t('event_detail.up_to', { defaultValue: `Up to ${value}`, value }) : String(value);
  if (field === 'category' || field === 'category_id') {
    if (isRecord(value) && typeof value.name === 'string') return value.name;
    return String(value);
  }
  if (typeof value === 'boolean') return value ? i18n.t('common.yes') : i18n.t('common.no');
  if (typeof value === 'string') return value.trim() || i18n.t('common.not_set');
  if (typeof value === 'number') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getChangeFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: i18n.t('create_event.title'),
    description: i18n.t('event_detail.description'),
    category: i18n.t('create_event.category'),
    category_id: i18n.t('create_event.category'),
    location: i18n.t('event_detail.location'),
    start_time: i18n.t('edit_event.start_time'),
    end_time: i18n.t('edit_event.end_time'),
    privacy_level: i18n.t('event_detail.privacy'),
    capacity: i18n.t('event_detail.capacity'),
    minimum_age: i18n.t('event_detail.minimum_age'),
    maximum_age: i18n.t('event_detail.maximum_age', { defaultValue: 'Maximum Age' }),
    preferred_gender: i18n.t('event_detail.preferred_gender'),
    constraints: i18n.t('edit_event.requirements'),
  };
  return labels[field] ?? formatTitleCaseValue(field);
}

function VersionChangeValues({ change }: { change: EventVersionChange }) {
  const isConstraintField = change.field === 'constraints';
  const beforeValue = formatDiffValue(change.field, change.old_value);
  const nowValue = formatDiffValue(change.field, change.new_value);

  return (
    <div className={`ed-version-values ${isConstraintField ? 'ed-version-values-constraints' : ''}`}>
      <div>
        <span>{i18n.t('event_detail.before')}</span>
        <p>{beforeValue}</p>
      </div>
      <span className="ed-version-flow-arrow" aria-hidden>
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </span>
      <div>
        <span>{i18n.t('event_detail.now')}</span>
        <p>{nowValue}</p>
      </div>
    </div>
  );
}

function VersionChangeList({ changes, compact = false }: { changes: EventVersionChange[]; compact?: boolean }) {
  return (
    <ul className={compact ? 'ed-version-change-list ed-version-change-list-compact' : 'ed-version-change-list'}>
      {changes.map((change: EventVersionChange, index) => {
        const isCritical = ATTENDANCE_CRITICAL_FIELDS.has(change.field);
        return (
          <li key={`${change.field}-${index}`} className="ed-version-change">
            <div className="ed-version-change-title">
              <strong>{getChangeFieldLabel(change.field)}</strong>
              {isCritical && <span>{i18n.t('event_detail.attendance_impact')}</span>}
            </div>
            <VersionChangeValues change={change} />
          </li>
        );
      })}
    </ul>
  );
}

function summarizeChangedFields(changedFields: string[]): string[] {
  const summaries: string[] = [];
  const add = (summary: string) => {
    if (!summaries.includes(summary)) summaries.push(summary);
  };
  if (changedFields.includes('start_time') || changedFields.includes('end_time')) add(i18n.t('event_detail.time_changed'));
  if (changedFields.includes('location')) add(i18n.t('event_detail.location_changed'));
  if (changedFields.includes('privacy_level')) add(i18n.t('event_detail.privacy_changed'));
  if (
    changedFields.includes('capacity') ||
    changedFields.includes('minimum_age') ||
    changedFields.includes('maximum_age') ||
    changedFields.includes('preferred_gender') ||
    changedFields.includes('constraints')
  ) {
    add(i18n.t('event_detail.participation_rules_changed'));
  }
  changedFields.forEach((field) => {
    if (!ATTENDANCE_CRITICAL_FIELDS.has(field)) {
      add(i18n.t('event_detail.generic_field_changed', { field: getChangeFieldLabel(field) }));
    }
  });
  return summaries.length > 0 ? summaries : [i18n.t('event_detail.event_details_changed')];
}

function getViewerParticipationState(event: EventDetailResponse): 'JOINED' | 'PENDING' | 'INVITED' | 'NONE' | 'LEAVED' | 'CANCELED' {
  const status = event.viewer_context.participation_status;
  if (status === 'APPROVED' || status === 'JOINED') return 'JOINED';
  if (status === 'PENDING' || event.viewer_context.join_request_status === 'PENDING') return 'PENDING';
  if (status === 'INVITED' || event.viewer_context.invitation_status === 'PENDING') return 'INVITED';
  if (status === 'LEAVED') return 'LEAVED';
  if (status === 'CANCELED') return 'CANCELED';
  return 'NONE';
}

function getDisplayName(user: { display_name: string | null; username: string }): string {
  return user.display_name ?? user.username;
}

function getFeedbackValidationMessage(message: string): string | null {
  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length < FEEDBACK_MIN_LENGTH) {
    return i18n.t('event_detail.feedback_min', { count: FEEDBACK_MIN_LENGTH });
  }

  if (trimmed.length > FEEDBACK_MAX_LENGTH) {
    return i18n.t('event_detail.feedback_max', { count: FEEDBACK_MAX_LENGTH });
  }

  return null;
}

function renderStars(rating: number): string {
  return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
}

function StatusBadge({ status }: { status: string }) {
  const lifecycle = getEventLifecyclePresentation(status);
  if (lifecycle) {
    const cls = lifecycle.variant === 'upcoming' ? 'ed-status-upcoming' : 'ed-status-in-progress';
    return <span className={`ed-status-badge ${cls}`}>{lifecycle.label}</span>;
  }

  const presentation = getEventStatusPresentation(status);
  const cls = presentation.tone === 'active'
    ? 'ed-status-active'
    : presentation.tone === 'canceled'
      ? 'ed-status-canceled'
      : 'ed-status-completed';

  return <span className={`ed-status-badge ${cls}`}>{presentation.label}</span>;
}

function ExpiryWarningBanner({ event }: { event: EventDetailResponse }) {
  if (event.status !== 'ACTIVE') return null;

  const createdAt = new Date(event.created_at);
  const now = new Date();
  const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const autoCompleteDay = 60;
  const warningStartDay = 53;

  if (daysSinceCreation < warningStartDay || daysSinceCreation >= autoCompleteDay) return null;

  const daysRemaining = autoCompleteDay - daysSinceCreation;

  return (
    <div className="ed-expiry-warning">
      <span className="ed-expiry-warning-icon">&#9200;</span>
      <span>
        <span
          dangerouslySetInnerHTML={{
            __html: i18n.t('event_detail.expiry_warning', { count: daysRemaining }),
          }}
        />
        {event.viewer_context.is_host && ` ${i18n.t('event_detail.expiry_warning_host_suffix')}`}
      </span>
    </div>
  );
}

function ReconfirmationBanner({
  event,
  loading,
  error,
  successMessage,
  onReconfirm,
  onLeave,
  onDismissError,
  onDismissSuccess,
}: {
  event: EventDetailResponse;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  onReconfirm: () => void;
  onLeave: () => void;
  onDismissError: () => void;
  onDismissSuccess: () => void;
}) {
  if (!event.viewer_context.needs_reconfirmation && !successMessage) return null;

  const diff = event.viewer_context.event_diff ?? null;
  const changes = diff?.changes ?? [];
  const summaries = summarizeChangedFields(
    diff?.changed_fields ?? changes.map((change) => change.field),
  );

  return (
    <div className="ed-reconfirm-panel" data-testid="ed-reconfirmation-banner">
      {event.viewer_context.needs_reconfirmation ? (
        <>
          <div>
            <h2>{i18n.t('event_detail.reconfirm_title')}</h2>
            <p>
              {i18n.t('event_detail.reconfirm_body')}
            </p>
          </div>
          {diff && (
            <div className="ed-reconfirm-diff" data-testid="ed-reconfirmation-diff">
              <div className="ed-reconfirm-diff-header">
                <strong>{i18n.t('event_detail.changes_since_confirmation')}</strong>
                <span>{i18n.t('event_detail.version_range_short', { from: diff.from_version_no, to: diff.to_version_no })}</span>
              </div>
              <div className="ed-version-summary-row ed-reconfirm-summary-row">
                {summaries.map((summary) => (
                  <span key={summary} className="ed-version-summary-pill">{summary}</span>
                ))}
              </div>
              {changes.length > 0 ? (
                <VersionChangeList changes={changes} compact />
              ) : (
                <p className="ed-mgmt-empty">{i18n.t('event_detail.no_detailed_changes')}</p>
              )}
            </div>
          )}
          {error && (
            <div className="ed-join-error">
              <span>{error}</span>
              <button type="button" className="ed-join-error-dismiss" onClick={onDismissError}>&times;</button>
            </div>
          )}
          <div className="ed-reconfirm-actions">
            <button type="button" className="ed-reconfirm-btn" onClick={onReconfirm} disabled={loading}>
              {loading ? i18n.t('event_detail.reconfirming') : i18n.t('event_detail.reconfirm_attendance')}
            </button>
            <button type="button" className="ed-reconfirm-secondary-btn" onClick={onLeave} disabled={loading}>
              {i18n.t('event_detail.leave_event')}
            </button>
          </div>
        </>
      ) : (
        <div className="ed-cover-upload-success" role="status">
          <span>{successMessage}</span>
          <button type="button" className="ed-join-error-dismiss" onClick={onDismissSuccess}>&times;</button>
        </div>
      )}
    </div>
  );
}

function EventVersionHistorySection({ event }: { event: EventDetailResponse }) {
  const diff = event.viewer_context.event_diff ?? null;
  const changes = diff?.changes ?? [];
  const versionNo =
    event.version_no ??
    event.viewer_context.latest_event_version ??
    diff?.to_version_no ??
    null;
  const status = getViewerParticipationState(event);
  const canViewHistory = event.viewer_context.is_host || status === 'JOINED' || status === 'PENDING';

  if (!canViewHistory || (!diff && versionNo == null)) return null;

  const summaries = summarizeChangedFields(
    diff?.changed_fields ?? changes.map((change) => change.field),
  );

  return (
    <div className="ed-section ed-version-history" data-testid="ed-version-history">
      <div className="ed-version-header">
        <h2 className="ed-section-title">{i18n.t('event_detail.version_history')}</h2>
        {versionNo != null && <span className="ed-version-pill">v{versionNo}</span>}
      </div>
      <div className="ed-version-card">
        {event.viewer_context.needs_reconfirmation && (
          <div className="ed-version-attention">
            {i18n.t('event_detail.review_changes')}
          </div>
        )}
        {diff ? (
          <p className="ed-version-range">
            {i18n.t('event_detail.changes_between_versions', { from: diff.from_version_no, to: diff.to_version_no })}
          </p>
        ) : (
          <p className="ed-version-range">
            {versionNo != null
              ? i18n.t('event_detail.current_event_version', { version: versionNo })
              : i18n.t('event_detail.current_event_version_no_number')}
          </p>
        )}
        <div className="ed-version-summary-row">
          {summaries.map((summary) => (
            <span key={summary} className="ed-version-summary-pill">{summary}</span>
          ))}
        </div>
        {changes.length > 0 ? (
          <VersionChangeList changes={changes} />
        ) : (
          <p className="ed-mgmt-empty">{i18n.t('event_detail.no_changes_to_review')}</p>
        )}
      </div>
    </div>
  );
}

function PencilCoverIcon() {
  return (
    <svg
      className="ed-hero-cover-edit-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function ParticipantsMetricIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3.5" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a3.5 3.5 0 0 1 0 6.74" />
    </svg>
  );
}

function SavesMetricIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h9l3 3v15l-7.5-4L3 21V6a3 3 0 0 1 3-3Z" />
    </svg>
  );
}

function PrivacyBadge({ level }: { level: string }) {
  const label = i18n.t(`events.privacy.${level}`);
  return (
    <span className={`ed-privacy-badge ed-privacy-${level.toLowerCase()}`}>
      {label}
    </span>
  );
}

function LocationSection({ location }: { location: EventDetailResponse['location'] }) {
  const anchor = useMemo(() => {
    if (location.type === 'POINT' && location.point) {
      return { lat: location.point.lat, lon: location.point.lon };
    }
    if (location.type === 'ROUTE' && location.route_points.length > 0) {
      return { lat: location.route_points[0].lat, lon: location.route_points[0].lon };
    }
    return null;
  }, [location]);

  const hasMap = anchor !== null;
  const isApproximate = location.is_location_approximate;
  const approximateAreaLabel = location.address
    ? formatEventLocation(location.address)
    : i18n.t('event_detail.approximate_area');

  return (
    <div className="ed-section">
      <h2 className="ed-section-title">{i18n.t('event_detail.location')}</h2>
      {isApproximate && (
        <div className="ed-approx-location-warning" role="status">
          <strong>{i18n.t('event_detail.approximate_location_title')}</strong>
          <span>
            {i18n.t('event_detail.approximate_location_body')}
          </span>
        </div>
      )}
      <div className="ed-info-row">
        <span className="ed-info-icon">&#128205;</span>
        <div>
          {location.address && !isApproximate ? (
            <p className="ed-info-primary">{location.address}</p>
          ) : isApproximate ? (
            <p className="ed-info-primary">{approximateAreaLabel}</p>
          ) : (
            <p className="ed-info-secondary">{i18n.t('event_detail.no_address')}</p>
          )}
          <p className="ed-info-secondary">
            {isApproximate
              ? getApproximateLocationText(Boolean(location.address))
              : location.type === 'ROUTE'
                ? i18n.t('event_detail.route_based_event')
                : i18n.t('event_detail.point_location')}
            {!isApproximate && location.point && (
              <> &middot; {location.point.lat.toFixed(4)}, {location.point.lon.toFixed(4)}</>
            )}
          </p>
        </div>
      </div>

      {hasMap ? (
        <div className="ed-map-panel">
          <Suspense
            fallback={
              <div className="ed-map-placeholder" role="status" aria-live="polite">
                <span className="spinner" />
                <p>{i18n.t('event_detail.loading_map')}</p>
              </div>
            }
          >
            <EventDetailMiniMap location={location} />
          </Suspense>
          {isApproximate ? (
            <div className="ed-approx-location-note" role="note">
              {i18n.t('event_detail.exact_directions_after_approval')}
            </div>
          ) : (
            <a
              className="ed-directions-btn"
              href={buildDirectionsUrl(anchor.lat, anchor.lon)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="ed-directions-link"
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              {i18n.t('event_detail.get_directions')}
            </a>
          )}
        </div>
      ) : (
        <p className="ed-map-fallback">{i18n.t('event_detail.map_unavailable')}</p>
      )}
    </div>
  );
}

function getFailureCodeLabel(code: InvitationFailureCode): string {
  const labels: Record<InvitationFailureCode, string> = {
    ALREADY_INVITED: i18n.t('event_detail.failure_already_invited'),
    ALREADY_PARTICIPATING: i18n.t('event_detail.failure_already_participating'),
    HOST_USER: i18n.t('event_detail.failure_host_user'),
    DECLINE_COOLDOWN_ACTIVE: i18n.t('event_detail.failure_declined_recently'),
    CAPACITY_EXCEEDED: i18n.t('event_detail.failure_capacity'),
    DUPLICATE_USERNAME: i18n.t('event_detail.failure_duplicate_username'),
  };
  return labels[code] ?? code;
}

function formatInvitationStatus(status: string): string {
  return i18n.t(`event_detail.invitation_status.${status}`, {
    defaultValue: formatTitleCaseValue(status),
  });
}

function InviteUsersModal({
  loading,
  error,
  result,
  onClose,
  onSubmit,
  onDismissError,
  onClearResult,
}: {
  loading: boolean;
  error: string | null;
  result: CreateEventInvitationsResponse | null;
  onClose: () => void;
  onSubmit: (usernames: string[], message: string | null) => Promise<CreateEventInvitationsResponse | null>;
  onDismissError: () => void;
  onClearResult: () => void;
}) {
  const [usernamesInput, setUsernamesInput] = useState('');
  const [message, setMessage] = useState('');

  const usernames = usernamesInput
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const canSubmit = usernames.length > 0 && usernames.length <= 100 && !loading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const res = await onSubmit(usernames, message.trim() || null);
    if (res && res.success_count > 0 && res.failed_count === 0 && res.invalid_username_count === 0) {
      // All succeeded — auto close
      setUsernamesInput('');
      setMessage('');
      onClose();
    }
  };

  return (
    <div
      className="ed-invite-modal-overlay"
      role="presentation"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="ed-invite-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ed-invite-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ed-invite-modal-header">
          <h3 id="ed-invite-title">{i18n.t('event_detail.invite_users')}</h3>
          <button
            type="button"
            className="ed-invite-modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label={i18n.t('common.close')}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="ed-invite-form">
          <label className="ed-invite-label" htmlFor="ed-invite-usernames">
            {i18n.t('event_detail.usernames')}
          </label>
          <textarea
            id="ed-invite-usernames"
            className="ed-invite-textarea"
            placeholder={i18n.t('event_detail.invite_usernames_placeholder')}
            value={usernamesInput}
            onChange={(e) => setUsernamesInput(e.target.value)}
            disabled={loading}
            rows={3}
          />
          <p className="ed-invite-hint">
            {usernames.length === 0
              ? i18n.t('event_detail.invite_none')
              : usernames.length > 100
                ? i18n.t('event_detail.invite_too_many', { count: usernames.length })
                : i18n.t('event_detail.invite_ready', { count: usernames.length })}
          </p>

          <label className="ed-invite-label" htmlFor="ed-invite-message">
            {i18n.t('event_detail.invite_message')}
          </label>
          <textarea
            id="ed-invite-message"
            className="ed-invite-textarea"
            placeholder={i18n.t('event_detail.invite_message_placeholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
            maxLength={300}
            rows={2}
          />

          {error && (
            <div className="ed-invite-error" role="alert">
              <span>{error}</span>
              <button type="button" className="ed-invite-error-dismiss" onClick={onDismissError}>
                &times;
              </button>
            </div>
          )}

          {result && (
            <div className="ed-invite-result">
              {result.success_count > 0 && (
                <p className="ed-invite-result-line ed-invite-result-success">
                  &#10003; {i18n.t('event_detail.invite_success', { count: result.success_count })}
                </p>
              )}
              {result.invalid_usernames.length > 0 && (
                <p className="ed-invite-result-line ed-invite-result-warn">
                  {i18n.t('event_detail.invite_invalid', { count: result.invalid_usernames.length })}:{' '}
                  <strong>{result.invalid_usernames.join(', ')}</strong>
                </p>
              )}
              {result.failed.length > 0 && (
                <ul className="ed-invite-result-failed-list">
                  {result.failed.map((f: EventInvitationFailure) => (
                    <li key={`${f.username}-${f.code}`}>
                      <strong>@{f.username}</strong>: {getFailureCodeLabel(f.code)}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="ed-invite-result-clear"
                onClick={onClearResult}
              >
                {i18n.t('common.close')}
              </button>
            </div>
          )}

          <div className="ed-invite-actions">
            <button
              type="button"
              className="ed-secondary-btn"
              onClick={onClose}
              disabled={loading}
            >
              {i18n.t('common.cancel')}
            </button>
            <button
              type="submit"
              className="ed-primary-btn"
              disabled={!canSubmit}
            >
              {loading ? <span className="spinner" /> : i18n.t('event_detail.send_invitations')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvitationsManagementSection({
  invitations,
  invitationsLoading,
  invitationsHasNext,
  hostContextSummary,
  isCancelable,
  inviteLoading,
  inviteError,
  inviteResult,
  onLoadMoreInvitations,
  onCreateInvitations,
  onDismissInviteError,
  onClearInviteResult,
}: {
  invitations: EventDetailInvitation[];
  invitationsLoading: boolean;
  invitationsHasNext: boolean;
  hostContextSummary: EventHostContextSummary | null;
  isCancelable: boolean;
  inviteLoading: boolean;
  inviteError: string | null;
  inviteResult: CreateEventInvitationsResponse | null;
  onLoadMoreInvitations: () => void;
  onCreateInvitations: (usernames: string[], message: string | null) => Promise<CreateEventInvitationsResponse | null>;
  onDismissInviteError: () => void;
  onClearInviteResult: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const total = hostContextSummary?.invitation_count ?? invitations.length;

  return (
    <div className="ed-mgmt-group">
      <div className="ed-mgmt-group-header">
        <h3 className="ed-mgmt-title">{i18n.t('invitations.title')} ({total})</h3>
        {isCancelable && (
          <button
            type="button"
            className="ed-primary-btn ed-mgmt-action-btn"
            onClick={() => setShowModal(true)}
            data-testid="ed-invite-open"
          >
            + {i18n.t('event_detail.invite_users')}
          </button>
        )}
      </div>

      {invitationsLoading && invitations.length === 0 ? (
        <p className="ed-mgmt-empty">{i18n.t('event_detail.loading_invitations')}</p>
      ) : invitations.length === 0 ? (
        <p className="ed-mgmt-empty">{i18n.t('event_detail.no_invitations')}</p>
      ) : (
        <ul className="ed-mgmt-list">
          {invitations.map((inv) => (
            <li key={inv.invitation_id} className="ed-mgmt-item">
              <UserAvatar
                username={inv.user.username}
                displayName={inv.user.display_name}
                avatarUrl={inv.user.avatar_url}
                size="sm"
                variant="muted"
              />
              <div className="ed-mgmt-user-info">
                <span className="ed-mgmt-name">{inv.user.display_name ?? inv.user.username}</span>
                <span className="ed-mgmt-username">@{inv.user.username}</span>
              </div>
              <span className={`ed-invitation-status ed-inv-${inv.status.toLowerCase()}`}>
                {formatInvitationStatus(inv.status)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {invitationsHasNext && (
        <button
          type="button"
          className="ed-secondary-btn"
          onClick={onLoadMoreInvitations}
          disabled={invitationsLoading}
        >
          {invitationsLoading ? i18n.t('common.loading') : i18n.t('event_detail.load_more_invitations')}
        </button>
      )}

      {showModal && (
        <InviteUsersModal
          loading={inviteLoading}
          error={inviteError}
          result={inviteResult}
          onClose={() => {
            setShowModal(false);
            onClearInviteResult();
          }}
          onSubmit={onCreateInvitations}
          onDismissError={onDismissInviteError}
          onClearResult={onClearInviteResult}
        />
      )}
    </div>
  );
}

function JoinActionSection({
  event,
  joinLoading,
  joinError,
  leaveLoading,
  leaveError,
  onJoin,
  onLeave,
  onRequestJoin,
  onDismissError,
  onDismissLeaveError,
  isAuthenticated,
  cancelJoinRequestLoading,
  cancelJoinRequestError,
  onCancelJoinRequest,
  onDismissCancelJoinRequestError,
}: {
  event: EventDetailResponse;
  joinLoading: boolean;
  joinError: string | null;
  leaveLoading: boolean;
  leaveError: string | null;
  onJoin: () => void;
  onLeave: () => void;
  onRequestJoin: (message?: string, imageFile?: File | null) => void;
  onDismissError: () => void;
  onDismissLeaveError: () => void;
  isAuthenticated: boolean;
  cancelJoinRequestLoading: boolean;
  cancelJoinRequestError: string | null;
  onCancelJoinRequest: () => void | Promise<void>;
  onDismissCancelJoinRequestError: () => void;
}) {
  const [requestMessage, setRequestMessage] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [requestImageFile, setRequestImageFile] = useState<File | null>(null);
  const [requestImagePreview, setRequestImagePreview] = useState<string | null>(null);
  const [requestImageError, setRequestImageError] = useState<string | null>(null);
  const requestImageInputRef = useRef<HTMLInputElement>(null);
  const [showCancelRequestModal, setShowCancelRequestModal] = useState(false);
  const ctx = event.viewer_context;
  const viewerState = getViewerParticipationState(event);

  // Host doesn't see join actions
  if (ctx.is_host) return null;

  if (ctx.needs_reconfirmation) return null;

  // Already participating states
  if (viewerState === 'JOINED') {
    const isCompletedOrCanceled = event.status === 'COMPLETED' || event.status === 'CANCELED';
    const joinedBannerClass = event.status === 'COMPLETED'
      ? 'ed-participation-attended'
      : 'ed-participation-joined';
    const joinedBannerText = event.status === 'COMPLETED'
      ? i18n.t('event_detail.joined_attended')
      : i18n.t('event_detail.joined_active');

    return (
      <div className="ed-section">
        <div className={`ed-participation-banner ${joinedBannerClass}`}>
          {joinedBannerText}
        </div>
        {!isCompletedOrCanceled && (
          <Link
            to="/tickets"
            className="ed-ticket-cta"
            data-testid="ed-view-ticket-cta"
          >
            <span className="ed-ticket-cta-icon" aria-hidden>&#127903;</span>
            <span className="ed-ticket-cta-text">
              <strong>{i18n.t('event_detail.view_ticket_title')}</strong>
              <span>{i18n.t('event_detail.view_ticket_body')}</span>
            </span>
            <span className="ed-ticket-cta-arrow" aria-hidden>&rarr;</span>
          </Link>
        )}
        {!isCompletedOrCanceled && (
          <div className="ed-leave-action">
            {leaveError && (
              <div className="ed-join-error">
                <span>{leaveError}</span>
                <button type="button" className="ed-join-error-dismiss" onClick={onDismissLeaveError}>&times;</button>
              </div>
            )}
            <button
              type="button"
              className="ed-leave-btn"
              onClick={() => setShowLeaveModal(true)}
              disabled={leaveLoading}
            >
              {leaveLoading ? <span className="spinner" /> : i18n.t('event_detail.leave_event')}
            </button>
            {showLeaveModal && (
              <LeaveConfirmModal
                loading={leaveLoading}
                onClose={() => {
                  if (!leaveLoading) setShowLeaveModal(false);
                }}
                onConfirm={() => {
                  onLeave();
                  setShowLeaveModal(false);
                }}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  if (viewerState === 'PENDING') {
    return (
      <div className="ed-section">
        <div className="ed-participation-banner ed-participation-pending">
          {i18n.t('event_detail.pending_banner')}
        </div>
        {cancelJoinRequestError && (
          <div className="ed-join-error">
            <span>{cancelJoinRequestError}</span>
            <button
              type="button"
              className="ed-join-error-dismiss"
              onClick={onDismissCancelJoinRequestError}
              aria-label={i18n.t('notifications.dismiss_error')}
            >
              &times;
            </button>
          </div>
        )}
        <div className="ed-leave-action">
          <button
            type="button"
            className="ed-leave-btn"
            onClick={() => setShowCancelRequestModal(true)}
            disabled={cancelJoinRequestLoading}
            data-testid="ed-cancel-request-btn"
          >
            {cancelJoinRequestLoading ? <span className="spinner" /> : i18n.t('event_detail.cancel_request')}
          </button>
        </div>
        {showCancelRequestModal && (
          <CancelRequestConfirmModal
            loading={cancelJoinRequestLoading}
            onClose={() => {
              if (!cancelJoinRequestLoading) setShowCancelRequestModal(false);
            }}
            onConfirm={async () => {
              await onCancelJoinRequest();
              setShowCancelRequestModal(false);
            }}
          />
        )}
      </div>
    );
  }

  if (viewerState === 'INVITED') {
    return (
      <div className="ed-section">
        <div className="ed-participation-banner ed-participation-invited">
          {i18n.t('event_detail.invited_banner')}
        </div>
      </div>
    );
  }

  // Not participating — check if join is possible
  const isInactive = event.status === 'CANCELED' || event.status === 'COMPLETED';
  const isFull = event.capacity != null && event.approved_participant_count >= event.capacity;
  const statusLabel = getEventStatusPresentation(event.status).label;

  // Constraint warnings
  const warnings: string[] = [];
  if (event.minimum_age != null) {
    warnings.push(i18n.t('event_detail.minimum_age_label', { age: event.minimum_age }));
  }
  if (event.preferred_gender) {
    warnings.push(
      i18n.t('event_detail.preferred_gender_label', {
        gender: formatGenderValue(event.preferred_gender) ?? event.preferred_gender,
      }),
    );
  }

  return (
    <div className="ed-section">
      {/* Constraint warnings */}
      {warnings.length > 0 && (
        <div className="ed-constraint-warning">
          <strong>{i18n.t('event_detail.eligibility_notes')}</strong> {warnings.join(' · ')}
        </div>
      )}

      {/* Join error */}
      {joinError && (
        <div className="ed-join-error">
          <span>{joinError}</span>
          <button type="button" className="ed-join-error-dismiss" onClick={onDismissError}>&times;</button>
        </div>
      )}

      {/* Disabled reasons */}
      {isInactive ? (
        <div className="ed-join-disabled-banner">
          {i18n.t('event_detail.inactive_banner', { status: statusLabel })}
        </div>
      ) : isFull ? (
        <div className="ed-join-disabled-banner">
          {i18n.t('event_detail.full_banner')}
        </div>
      ) : event.privacy_level === 'PUBLIC' ? (
        <>
          {!isAuthenticated && (
            <p className="ed-join-auth-hint">
              {i18n.t('event_detail.sign_in_to_participate')}{' '}
              <Link to="/login" className="ed-join-auth-link">{i18n.t('shell.sign_in')}</Link>
            </p>
          )}
          <button
            type="button"
            className="btn-primary ed-join-btn"
            onClick={onJoin}
            disabled={!isAuthenticated || joinLoading}
          >
            {joinLoading ? <span className="spinner" /> : i18n.t('event_detail.join_event')}
          </button>
        </>
      ) : event.privacy_level === 'PROTECTED' ? (
        /* PROTECTED — request to join */
        <div className="ed-request-join">
          {!showRequestForm ? (
            <>
              {!isAuthenticated && (
                <p className="ed-join-auth-hint">
                  {i18n.t('event_detail.sign_in_to_participate')}{' '}
                  <Link to="/login" className="ed-join-auth-link">{i18n.t('shell.sign_in')}</Link>
                </p>
              )}
              <button
                type="button"
                className="btn-primary ed-join-btn ed-join-btn-protected"
                onClick={() => setShowRequestForm(true)}
                disabled={!isAuthenticated || joinLoading}
              >
                {i18n.t('event_detail.request_to_join')}
              </button>
            </>
          ) : (
            <div className="ed-request-form">
              <textarea
                className="field-input ed-request-message"
                placeholder={i18n.t('event_detail.request_message_placeholder')}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={3}
              />

              <div className="ed-request-image">
                <input
                  ref={requestImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="ed-request-image-input"
                  onChange={(e) => {
                    setRequestImageError(null);
                    const file = e.target.files?.[0] ?? null;
                    if (!file) {
                      setRequestImageFile(null);
                      if (requestImagePreview) URL.revokeObjectURL(requestImagePreview);
                      setRequestImagePreview(null);
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      setRequestImageError(i18n.t('event_detail.file_too_large_5mb'));
                      e.target.value = '';
                      return;
                    }
                    setRequestImageFile(file);
                    if (requestImagePreview) URL.revokeObjectURL(requestImagePreview);
                    setRequestImagePreview(URL.createObjectURL(file));
                  }}
                  disabled={joinLoading}
                />
                {requestImageFile && requestImagePreview ? (
                  <div className="ed-request-image-preview">
                    <img src={requestImagePreview} alt={i18n.t('event_detail.request_image_alt')} />
                    <div className="ed-request-image-meta">
                      <span className="ed-request-image-name">{requestImageFile.name}</span>
                      <span className="ed-request-image-size">
                        {(requestImageFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <button
                      type="button"
                      className="ed-request-image-remove"
                      onClick={() => {
                        setRequestImageFile(null);
                        if (requestImagePreview) URL.revokeObjectURL(requestImagePreview);
                        setRequestImagePreview(null);
                        if (requestImageInputRef.current) requestImageInputRef.current.value = '';
                      }}
                      disabled={joinLoading}
                      aria-label={i18n.t('event_detail.remove_image')}
                    >
                      {i18n.t('common.remove')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ed-request-image-pick"
                    onClick={() => requestImageInputRef.current?.click()}
                    disabled={joinLoading}
                    data-testid="ed-request-image-pick"
                  >
                    + {i18n.t('event_detail.pick_image')}
                  </button>
                )}
                {requestImageError && (
                  <p className="ed-request-image-error" role="alert">{requestImageError}</p>
                )}
              </div>

              <div className="ed-request-actions">
                <button
                  type="button"
                  className="btn-primary ed-join-btn"
                  onClick={() => {
                    onRequestJoin(
                      requestMessage.trim() || undefined,
                      requestImageFile,
                    );
                    setShowRequestForm(false);
                    setRequestMessage('');
                    setRequestImageFile(null);
                    if (requestImagePreview) URL.revokeObjectURL(requestImagePreview);
                    setRequestImagePreview(null);
                    if (requestImageInputRef.current) requestImageInputRef.current.value = '';
                  }}
                  disabled={joinLoading}
                >
                  {joinLoading ? <span className="spinner" /> : i18n.t('event_detail.send_request')}
                </button>
                <button
                  type="button"
                  className="ed-request-cancel"
                  onClick={() => {
                    setShowRequestForm(false);
                    setRequestMessage('');
                    setRequestImageFile(null);
                    if (requestImagePreview) URL.revokeObjectURL(requestImagePreview);
                    setRequestImagePreview(null);
                    setRequestImageError(null);
                    if (requestImageInputRef.current) requestImageInputRef.current.value = '';
                  }}
                >
                  {i18n.t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function StarRatingInput({
  value,
  onChange,
  disabled,
  size = 'md',
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: 'md' | 'lg';
}) {
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  const activeValue = hoveredValue ?? value;

  return (
    <div className={`ed-star-input ed-star-input-${size}`} role="radiogroup" aria-label={i18n.t('interaction.select_star_rating')}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={i18n.t('interaction.star_rating_label', { count: star })}
          className={`ed-star-btn ${activeValue >= star ? 'is-active' : ''}`}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHoveredValue(star)}
          onMouseLeave={() => setHoveredValue(null)}
          onFocus={() => setHoveredValue(star)}
          onBlur={() => setHoveredValue(null)}
          disabled={disabled}
        >
          <span aria-hidden="true">★</span>
        </button>
      ))}
    </div>
  );
}

function ParticipantRatingSection({
  event,
  loading,
  error,
  onSubmit,
  onDismissError,
}: {
  event: EventDetailResponse;
  loading: boolean;
  error: string | null;
  onSubmit: (rating: number, message?: string) => void;
  onDismissError: () => void;
}) {
  const { t } = useTranslation();
  const existingRating = event.viewer_event_rating;
  const [rating, setRating] = useState(existingRating?.rating ?? 0);
  const [message, setMessage] = useState(existingRating?.message ?? '');
  const [isEditing, setIsEditing] = useState(existingRating == null);
  const ratingStampRef = useRef<string | null>(
    existingRating ? `${existingRating.id}:${existingRating.updated_at}` : null,
  );

  useEffect(() => {
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
  }, [existingRating?.id, existingRating?.rating, existingRating?.message, existingRating?.updated_at, loading, error]);

  const feedbackError = getFeedbackValidationMessage(message);
  const trimmedLength = message.trim().length;
  const isEligibleParticipant = (
    !event.viewer_context.is_host
    && getViewerParticipationState(event) === 'JOINED'
    && event.status === 'COMPLETED'
    && event.rating_window.is_active
  );

  if (!isEligibleParticipant) {
    return null;
  }

  return (
    <div className="ed-section ed-participant-rating-section">
      <div className="ed-rating-card ed-rating-card-participant">
        <div className="ed-rating-card-header">
          <div>
            <span className="ed-rating-kicker">{t('event_detail.post_event_feedback')}</span>
            <h2 className="ed-rating-title">
              {existingRating ? t('event_detail.update_host_rating') : t('event_detail.how_was_event')}
            </h2>
          </div>
          <span className="ed-rating-deadline">
            {t('event_detail.rating_window_open_short', {
              date: formatShortDate(event.rating_window.closes_at),
            })}
          </span>
        </div>

        <p className="ed-rating-copy">
          {t('event_detail.rate_experience_copy')}
        </p>

        {existingRating && !isEditing ? (
          <div className="ed-rating-readonly">
            <div className="ed-rating-star-row">
              <span className="ed-rating-summary is-selected">
                {existingRating.rating}/5 · {renderStars(existingRating.rating)}
              </span>
            </div>

            {existingRating.message && (
              <p className="ed-rating-readonly-message">"{existingRating.message}"</p>
            )}

            <div className="ed-rating-actions">
              <p className="ed-rating-existing-note">
                {t('event_detail.last_updated', { date: formatShortDate(existingRating.updated_at) })}
              </p>
              <button
                type="button"
                className="ed-rate-participant-btn ed-rating-edit-btn"
                onClick={() => {
                  onDismissError();
                  setIsEditing(true);
                }}
              >
                {t('event_detail.edit_rating')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="ed-rating-star-row">
              <StarRatingInput value={rating} onChange={setRating} disabled={loading} size="lg" />
              <span className={`ed-rating-summary ${rating > 0 ? 'is-selected' : ''}`}>
                {rating > 0 ? `${rating}/5 · ${renderStars(rating)}` : t('event_detail.select_star_rating')}
              </span>
            </div>

            <label className="ed-rating-field-label" htmlFor="event-rating-message">
              {t('event_detail.message_label')}
            </label>
            <textarea
              id="event-rating-message"
              className={`field-input ed-rating-textarea ${feedbackError ? 'has-error' : ''}`}
              placeholder={t('event_detail.rating_message_placeholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={FEEDBACK_MAX_LENGTH}
            />

            <div className="ed-rating-meta">
              <span className={`ed-rating-char-count ${feedbackError ? 'is-error' : ''}`}>
                {trimmedLength}/{FEEDBACK_MAX_LENGTH}
              </span>
              <span className="ed-rating-helper">
                {t('event_detail.rating_helper', {
                  min: FEEDBACK_MIN_LENGTH,
                  max: FEEDBACK_MAX_LENGTH,
                })}
              </span>
            </div>

            {feedbackError && <p className="ed-rating-validation">{feedbackError}</p>}

            {error && (
              <div className="ed-join-error">
                <span>{error}</span>
                <button type="button" className="ed-join-error-dismiss" onClick={onDismissError}>&times;</button>
              </div>
            )}

            {existingRating && (
              <p className="ed-rating-existing-note">
                {t('event_detail.overwrite_rating_notice', {
                  date: formatShortDate(existingRating.updated_at),
                })}
              </p>
            )}

            <div className="ed-rating-actions">
              <button
                type="button"
                className="btn-primary ed-rating-submit-btn"
                disabled={loading || rating === 0 || Boolean(feedbackError)}
                onClick={() => onSubmit(rating, message)}
              >
                {loading ? <span className="spinner" /> : existingRating ? t('event_detail.update_rating') : t('event_detail.submit_rating')}
              </button>
              {existingRating && (
                <button
                  type="button"
                  className="ed-inline-rating-cancel ed-rating-cancel-btn"
                  onClick={() => {
                    onDismissError();
                    setRating(existingRating.rating);
                    setMessage(existingRating.message ?? '');
                    setIsEditing(false);
                  }}
                  disabled={loading}
                >
                  {t('common.cancel')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HostParticipantRatingItem({
  participant,
  canEdit,
  isEditorOpen,
  loading,
  error,
  onToggleEditor,
  onCloseEditor,
  onSubmit,
  onDismissError,
}: {
  participant: EventDetailApprovedParticipant;
  canEdit: boolean;
  isEditorOpen: boolean;
  loading: boolean;
  error: string | null;
  onToggleEditor: () => void;
  onCloseEditor: () => void;
  onSubmit: (participantUserId: string, rating: number, message?: string) => void;
  onDismissError: () => void;
}) {
  const { t } = useTranslation();
  const existingRating = participant.host_rating;
  const [rating, setRating] = useState(existingRating?.rating ?? 0);
  const [message, setMessage] = useState(existingRating?.message ?? '');
  const ratingStampRef = useRef<string | null>(
    existingRating ? `${existingRating.id}:${existingRating.updated_at}` : null,
  );

  useEffect(() => {
    setRating(existingRating?.rating ?? 0);
    setMessage(existingRating?.message ?? '');
  }, [existingRating?.id, existingRating?.rating, existingRating?.message]);

  useEffect(() => {
    const nextStamp = existingRating ? `${existingRating.id}:${existingRating.updated_at}` : null;
    const previousStamp = ratingStampRef.current;

    if (
      isEditorOpen
      && nextStamp
      && previousStamp !== null
      && nextStamp !== previousStamp
      && !loading
      && !error
    ) {
      onCloseEditor();
    }

    if (
      isEditorOpen
      && nextStamp
      && previousStamp === null
      && !loading
      && !error
    ) {
      onCloseEditor();
    }

    ratingStampRef.current = nextStamp;
  }, [existingRating?.id, existingRating?.updated_at, isEditorOpen, loading, error, onCloseEditor]);

  const feedbackError = getFeedbackValidationMessage(message);
  const trimmedLength = message.trim().length;

  return (
    <li className="ed-mgmt-item ed-mgmt-item-participant">
      <Link
        to={`/users/${participant.user.id}`}
        className="ed-mgmt-avatar-link"
        aria-label={t('event_detail.view_user_profile', { name: getDisplayName(participant.user) })}
      >
        <UserAvatar
          username={participant.user.username}
          displayName={participant.user.display_name}
          avatarUrl={participant.user.avatar_url}
          size="sm"
          variant="muted"
        />
      </Link>

      <Link
        to={`/users/${participant.user.id}`}
        className="ed-mgmt-user-link"
      >
        <div className="ed-mgmt-user-info">
          <div className="ed-mgmt-user-topline">
            <span className="ed-mgmt-name">{getDisplayName(participant.user)}</span>
            {participant.user.final_score != null && (
              <RatingWithCount
                score={participant.user.final_score}
                count={participant.user.rating_count}
                className="ed-mgmt-user-score"
              />
            )}
          </div>
          <span className="ed-mgmt-username">@{participant.user.username}</span>

          <div className="ed-participant-rating-summary">
            {existingRating ? (
              <>
                <span className="ed-participant-rating-badge">{renderStars(existingRating.rating)} {existingRating.rating}/5</span>
                {existingRating.message && (
                  <span className="ed-participant-rating-message">"{existingRating.message}"</span>
                )}
              </>
            ) : null}
          </div>
        </div>
      </Link>

      {canEdit && (
        <button
          type="button"
          className="ed-rate-participant-btn"
          onClick={onToggleEditor}
          disabled={loading}
        >
          {isEditorOpen ? t('common.close') : existingRating ? t('event_detail.edit_rating') : t('event_detail.rate_participant')}
        </button>
      )}

      {isEditorOpen && (
        <div className="ed-inline-rating-editor">
          <div className="ed-inline-rating-header">
            <strong>{t('event_detail.rate_participant_named', { name: getDisplayName(participant.user) })}</strong>
            <span>{t('event_detail.one_to_five_stars')}</span>
          </div>

          <StarRatingInput value={rating} onChange={setRating} disabled={loading} />

          <textarea
            className={`field-input ed-rating-textarea ed-rating-textarea-inline ${feedbackError ? 'has-error' : ''}`}
            placeholder={t('event_detail.participant_rating_placeholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={FEEDBACK_MAX_LENGTH}
          />

          <div className="ed-rating-meta">
            <span className={`ed-rating-char-count ${feedbackError ? 'is-error' : ''}`}>
              {trimmedLength}/{FEEDBACK_MAX_LENGTH}
            </span>
            <span className="ed-rating-helper">
              {t('event_detail.participant_rating_helper', { min: FEEDBACK_MIN_LENGTH })}
            </span>
          </div>

          {feedbackError && <p className="ed-rating-validation">{feedbackError}</p>}

          {error && (
            <div className="ed-join-error">
              <span>{error}</span>
              <button type="button" className="ed-join-error-dismiss" onClick={onDismissError}>&times;</button>
            </div>
          )}

          <div className="ed-inline-rating-actions">
            <button
              type="button"
              className="btn-primary ed-inline-rating-submit"
              disabled={loading || rating === 0 || Boolean(feedbackError)}
              onClick={() => onSubmit(participant.user.id, rating, message)}
            >
              {loading ? <span className="spinner" /> : existingRating ? t('common.save') : t('event_detail.submit_rating')}
            </button>
            <button
              type="button"
              className="ed-inline-rating-cancel"
              onClick={onToggleEditor}
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function CancelConfirmModal({
  onConfirm,
  onClose,
  loading,
}: {
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="ed-modal-title">{t('event_detail.cancel_event_title')}</h3>
        <p className="ed-modal-text">
          {t('event_detail.cancel_event_body_with_notice')}
        </p>
        <div className="ed-modal-actions">
          <button
            type="button"
            className="ed-modal-cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.back')}
          </button>
          <button
            type="button"
            className="ed-modal-confirm-btn"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : t('event_detail.confirm_cancel_event')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompleteConfirmModal({
  onConfirm,
  onClose,
  loading,
}: {
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="ed-modal-title">{t('event_detail.end_event_title')}</h3>
        <p className="ed-modal-text">{t('event_detail.end_event_body')}</p>
        <div className="ed-modal-actions">
          <button
            type="button"
            className="ed-modal-cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.back')}
          </button>
          <button
            type="button"
            className="ed-modal-confirm-btn"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : t('event_detail.confirm_end_event')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportEventModal({
  loading,
  error,
  onSubmit,
  onDismissError,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  onSubmit: (category: EventReportCategory, message?: string) => Promise<boolean>;
  onDismissError: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<EventReportCategory>('SPAM_OR_SCAM');
  const [message, setMessage] = useState('');
  const isMessageTooLong = message.length > REPORT_MESSAGE_MAX_LENGTH;
  const reportReasons = getReportReasons();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isMessageTooLong || loading) return;
    const success = await onSubmit(category, message);
    if (success) onClose();
  };

  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <form className="ed-modal ed-report-modal" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <h3 className="ed-modal-title">{t('event_detail.report_event_title')}</h3>
        <p className="ed-modal-text">{t('event_detail.report_event_body')}</p>

        {error && (
          <div className="ed-join-error" role="alert">
            <span>{error}</span>
            <button type="button" className="ed-join-error-dismiss" onClick={onDismissError}>
              &times;
            </button>
          </div>
        )}

        <div className="ed-report-reasons" role="radiogroup" aria-label={t('event_detail.report_reasons_label')}>
          {reportReasons.map((reason) => (
            <label
              key={reason.value}
              className={`ed-report-reason ${category === reason.value ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="report-category"
                value={reason.value}
                checked={category === reason.value}
                onChange={() => setCategory(reason.value)}
                disabled={loading}
              />
              <span className="ed-report-reason-copy">
                <span className="ed-report-reason-label">{reason.label}</span>
                <span className="ed-report-reason-hint">{reason.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <label className="ed-report-message-label" htmlFor="ed-report-message">
          {t('event_detail.report_message_label')} <span>({t('common.optional')})</span>
        </label>
        <textarea
          id="ed-report-message"
          className={`ed-report-message ${isMessageTooLong ? 'has-error' : ''}`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={REPORT_MESSAGE_MAX_LENGTH + 1}
          rows={4}
          placeholder={t('event_detail.report_message_placeholder')}
          disabled={loading}
        />
        <div className={`ed-report-char-count ${isMessageTooLong ? 'is-error' : ''}`}>
          {message.length}/{REPORT_MESSAGE_MAX_LENGTH}
        </div>

        <div className="ed-modal-actions">
          <button
            type="button"
            className="ed-modal-cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="ed-modal-confirm-btn ed-report-submit-btn"
            disabled={loading || isMessageTooLong}
          >
            {loading ? <span className="spinner" /> : t('event_detail.submit_report')}
          </button>
        </div>
      </form>
    </div>
  );
}

function HostPendingReconfirmationItem({ participant }: { participant: EventDetailApprovedParticipant }) {
  const { t } = useTranslation();
  return (
    <li className="ed-mgmt-item ed-mgmt-item-pending-reconfirmation">
      <Link
        to={`/users/${participant.user.id}`}
        className="ed-mgmt-avatar-link"
        aria-label={t('event_detail.view_user_profile', { name: getDisplayName(participant.user) })}
      >
        <UserAvatar
          username={participant.user.username}
          displayName={participant.user.display_name}
          avatarUrl={participant.user.avatar_url}
          size="sm"
          variant="muted"
        />
      </Link>
      <Link to={`/users/${participant.user.id}`} className="ed-mgmt-user-link">
        <div className="ed-mgmt-user-info">
          <div className="ed-mgmt-user-topline">
            <span className="ed-mgmt-name">{getDisplayName(participant.user)}</span>
            {participant.user.final_score != null && (
              <RatingWithCount
                score={participant.user.final_score}
                count={participant.user.rating_count}
                className="ed-mgmt-user-score"
              />
            )}
          </div>
          <span className="ed-mgmt-username">@{participant.user.username}</span>
          <span className="ed-mgmt-message">
            {t('event_detail.waiting_since', { date: formatShortDate(participant.updated_at) })}
          </span>
        </div>
      </Link>
      <span className="ed-reconfirm-status-pill">{t('event_detail.needs_reconfirmation_short')}</span>
    </li>
  );
}

function LeaveConfirmModal({
  onConfirm,
  onClose,
  loading,
}: {
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="ed-modal-title">{t('event_detail.leave_event_title')}</h3>
        <p className="ed-modal-text">{t('event_detail.leave_event_body_full')}</p>
        <div className="ed-modal-actions">
          <button
            type="button"
            className="ed-modal-cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.back')}
          </button>
          <button
            type="button"
            className="ed-modal-confirm-btn"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : t('event_detail.confirm_leave_event')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelRequestConfirmModal({
  onConfirm,
  onClose,
  loading,
}: {
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div
        className="ed-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ed-cancel-request-title"
      >
        <h3 className="ed-modal-title" id="ed-cancel-request-title">
          {t('event_detail.cancel_request_title')}
        </h3>
        <p className="ed-modal-text">{t('event_detail.cancel_request_body_full')}</p>
        <div className="ed-modal-actions">
          <button
            type="button"
            className="ed-modal-cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            {t('event_detail.keep_request')}
          </button>
          <button
            type="button"
            className="ed-modal-confirm-btn"
            onClick={onConfirm}
            disabled={loading}
            data-testid="ed-cancel-request-confirm"
          >
            {loading ? <span className="spinner" /> : t('event_detail.confirm_cancel_request')}
          </button>
        </div>
      </div>
    </div>
  );
}

function EventContent({
  event,
  joinLoading,
  joinError,
  leaveLoading,
  leaveError,
  viewerRatingLoading,
  viewerRatingError,
  participantRatingLoadingId,
  participantRatingError,
  onJoin,
  onLeave,
  onRequestJoin,
  onViewerRatingSubmit,
  onParticipantRatingSubmit,
  onDismissError,
  onDismissLeaveError,
  onDismissViewerRatingError,
  onDismissParticipantRatingError,
  moderatingId,
  moderateError,
  onApprove,
  onReject,
  onDismissModerateError,
  cancelLoading,
  cancelError,
  onCancel,
  onDismissCancelError,
  completeLoading,
  completeError,
  onComplete,
  onDismissCompleteError,
  favoriteLoading,
  onFavoriteToggle,
  reportLoading,
  reportError,
  reportSuccessMessage,
  onReportEvent,
  onDismissReportError,
  onDismissReportSuccess,
  reconfirmLoading,
  reconfirmError,
  reconfirmSuccessMessage,
  onReconfirmParticipation,
  onDismissReconfirmError,
  onDismissReconfirmSuccess,
  isAuthenticated,
  token,
  hostContextSummary,
  approvedParticipants,
  approvedParticipantsLoading,
  approvedParticipantsHasNext,
  pendingParticipants,
  pendingParticipantsLoading,
  pendingParticipantsHasNext,
  pendingJoinRequests,
  pendingJoinRequestsLoading,
  pendingJoinRequestsHasNext,
  invitations,
  invitationsLoading,
  invitationsHasNext,
  onLoadMoreApprovedParticipants,
  onLoadMorePendingParticipants,
  onLoadMorePendingJoinRequests,
  onLoadMoreInvitations,
  inviteLoading,
  inviteError,
  inviteResult,
  onCreateInvitations,
  onDismissInviteError,
  onClearInviteResult,
  coverImageUploading,
  coverImageError,
  coverImageSuccessMessage,
  onCoverImageFileSelected,
  onDismissCoverImageError,
  onDismissCoverImageSuccess,
  cancelJoinRequestLoading,
  cancelJoinRequestError,
  onCancelJoinRequest,
  onDismissCancelJoinRequestError,
}: {
  event: EventDetailResponse;
  joinLoading: boolean;
  joinError: string | null;
  leaveLoading: boolean;
  leaveError: string | null;
  viewerRatingLoading: boolean;
  viewerRatingError: string | null;
  participantRatingLoadingId: string | null;
  participantRatingError: { participantUserId: string; message: string } | null;
  onJoin: () => void;
  onLeave: () => void;
  onRequestJoin: (message?: string, imageFile?: File | null) => void;
  onViewerRatingSubmit: (rating: number, message?: string) => void;
  onParticipantRatingSubmit: (participantUserId: string, rating: number, message?: string) => void;
  onDismissError: () => void;
  onDismissLeaveError: () => void;
  onDismissViewerRatingError: () => void;
  onDismissParticipantRatingError: () => void;
  moderatingId: string | null;
  moderateError: string | null;
  onApprove: (joinRequestId: string) => void;
  onReject: (joinRequestId: string) => void;
  onDismissModerateError: () => void;
  cancelLoading: boolean;
  cancelError: string | null;
  onCancel: () => void;
  onDismissCancelError: () => void;
  completeLoading: boolean;
  completeError: string | null;
  onComplete: () => void;
  onDismissCompleteError: () => void;
  favoriteLoading: boolean;
  onFavoriteToggle: () => void;
  reportLoading: boolean;
  reportError: string | null;
  reportSuccessMessage: string | null;
  onReportEvent: (category: EventReportCategory, message?: string) => Promise<boolean>;
  onDismissReportError: () => void;
  onDismissReportSuccess: () => void;
  reconfirmLoading: boolean;
  reconfirmError: string | null;
  reconfirmSuccessMessage: string | null;
  onReconfirmParticipation: () => void;
  onDismissReconfirmError: () => void;
  onDismissReconfirmSuccess: () => void;
  isAuthenticated: boolean;
  token: string | null;
  hostContextSummary: EventHostContextSummary | null;
  approvedParticipants: EventDetailApprovedParticipant[];
  approvedParticipantsLoading: boolean;
  approvedParticipantsHasNext: boolean;
  pendingParticipants: EventDetailApprovedParticipant[];
  pendingParticipantsLoading: boolean;
  pendingParticipantsHasNext: boolean;
  pendingJoinRequests: EventDetailPendingJoinRequest[];
  pendingJoinRequestsLoading: boolean;
  pendingJoinRequestsHasNext: boolean;
  invitations: EventDetailInvitation[];
  invitationsLoading: boolean;
  invitationsHasNext: boolean;
  onLoadMoreApprovedParticipants: () => void;
  onLoadMorePendingParticipants: () => void;
  onLoadMorePendingJoinRequests: () => void;
  onLoadMoreInvitations: () => void;
  inviteLoading: boolean;
  inviteError: string | null;
  inviteResult: CreateEventInvitationsResponse | null;
  onCreateInvitations: (usernames: string[], message: string | null) => Promise<CreateEventInvitationsResponse | null>;
  onDismissInviteError: () => void;
  onClearInviteResult: () => void;
  coverImageUploading: boolean;
  coverImageError: string | null;
  coverImageSuccessMessage: string | null;
  onCoverImageFileSelected: (file: File) => void;
  onDismissCoverImageError: () => void;
  onDismissCoverImageSuccess: () => void;
  cancelJoinRequestLoading: boolean;
  cancelJoinRequestError: string | null;
  onCancelJoinRequest: () => void | Promise<void>;
  onDismissCancelJoinRequestError: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeParticipantEditorId, setActiveParticipantEditorId] = useState<string | null>(null);
  const hostCanRateParticipants = (
    event.viewer_context.is_host
    && event.status === 'COMPLETED'
    && event.rating_window.is_active
  );
  const pendingReconfirmationCount = Math.max(
    event.pending_participant_count,
    pendingParticipants.length,
  );
  const categoryLabel = getEventCategoryPresentation(event.category?.name ?? 'Event', false).label;
  const preferredGenderLabel = formatGenderValue(event.preferred_gender);
  const privacyLabel = i18n.t(`events.privacy.${event.privacy_level}`, {
    defaultValue: formatTitleCaseValue(event.privacy_level),
  });

  const showCoverImageEdit = isAuthenticated && event.viewer_context.is_host;

  return (
    <div className="ed-page">
      <button type="button" className="ed-back-btn" onClick={() => navigate(-1)}>
        &larr; {t('event_detail.back_button')}
      </button>

      {/* Hero image */}
      <div className="ed-hero">
        <EventCoverImage
          src={event.image_url}
          alt={event.title}
          imgClassName="ed-hero-image"
          variant="hero"
        />
        {showCoverImageEdit && (
          <>
            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="ed-hero-cover-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onCoverImageFileSelected(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="ed-hero-cover-edit"
              aria-label={t('event_detail.change_cover_image')}
              disabled={coverImageUploading}
              onClick={() => coverFileInputRef.current?.click()}
            >
              {coverImageUploading ? <span className="spinner" /> : <PencilCoverIcon />}
            </button>
          </>
        )}
        <div className="ed-hero-badges">
          <PrivacyBadge level={event.privacy_level} />
        </div>
      </div>

      {showCoverImageEdit && coverImageError && (
        <div className="ed-cover-upload-error">
          <span>{coverImageError}</span>
          <button type="button" className="ed-join-error-dismiss" onClick={onDismissCoverImageError}>&times;</button>
        </div>
      )}

      {showCoverImageEdit && coverImageSuccessMessage && (
        <div className="ed-cover-upload-success" role="status">
          <span>{coverImageSuccessMessage}</span>
          <button type="button" className="ed-join-error-dismiss" onClick={onDismissCoverImageSuccess}>&times;</button>
        </div>
      )}

      {reportSuccessMessage && (
        <div className="ed-report-success" role="status">
          <span>{reportSuccessMessage}</span>
          <button type="button" className="ed-report-success-dismiss" onClick={onDismissReportSuccess}>&times;</button>
        </div>
      )}

      {/* Title & category */}
      <div className="ed-header">
        <div className="ed-title-row">
          <h1 className="ed-title">{event.title}</h1>
          <div className="ed-title-actions">
            <button
              type="button"
              className={`ed-favorite-btn ${event.viewer_context.is_favorited ? 'favorited' : ''}`}
              onClick={isAuthenticated ? onFavoriteToggle : () => navigate('/login')}
              disabled={favoriteLoading}
              aria-label={event.viewer_context.is_favorited ? t('event_detail.remove_favorite') : t('event_detail.add_favorite')}
              title={isAuthenticated ? undefined : t('event_detail.sign_in_to_save')}
            >
              {event.viewer_context.is_favorited ? '★' : '☆'}
            </button>
            <button
              type="button"
              className="ed-report-flag-btn"
              aria-label={t('event_detail.report_event')}
              onClick={() => {
                if (!isAuthenticated) {
                  navigate('/login');
                  return;
                }
                onDismissReportError();
                setShowReportModal(true);
              }}
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </button>
            <StatusBadge status={event.status} />
          </div>
        </div>
        {event.category && (
          <span className="ed-category">{categoryLabel}</span>
        )}
      </div>

      {/* Metrics row */}
      <div className="ed-metrics">
        <div className="ed-metric">
          <div className="ed-metric-topline">
            <span className="ed-metric-emote" aria-hidden><ParticipantsMetricIcon /></span>
            <span className="ed-metric-value">{event.approved_participant_count}</span>
          </div>
          <span className="ed-metric-label">{t('event_detail.participants_metric', { count: event.approved_participant_count })}</span>
        </div>
        <div className="ed-metric">
          <div className="ed-metric-topline">
            <span className="ed-metric-emote" aria-hidden><SavesMetricIcon /></span>
            <span className="ed-metric-value">{event.favorite_count}</span>
          </div>
          <span className="ed-metric-label">{t('event_detail.saves_metric', { count: event.favorite_count })}</span>
        </div>
      </div>

      {/* Expiry warning — shown in last 7 days before auto-completion */}
      <ExpiryWarningBanner event={event} />

      <ReconfirmationBanner
        event={event}
        loading={reconfirmLoading}
        error={reconfirmError}
        successMessage={reconfirmSuccessMessage}
        onReconfirm={onReconfirmParticipation}
        onLeave={onLeave}
        onDismissError={onDismissReconfirmError}
        onDismissSuccess={onDismissReconfirmSuccess}
      />

      {/* Join action — prominent position */}
      <JoinActionSection
        event={event}
        joinLoading={joinLoading}
        joinError={joinError}
        leaveLoading={leaveLoading}
        leaveError={leaveError}
        onJoin={onJoin}
        onLeave={onLeave}
        onRequestJoin={onRequestJoin}
        onDismissError={onDismissError}
        onDismissLeaveError={onDismissLeaveError}
        isAuthenticated={isAuthenticated}
        cancelJoinRequestLoading={cancelJoinRequestLoading}
        cancelJoinRequestError={cancelJoinRequestError}
        onCancelJoinRequest={onCancelJoinRequest}
        onDismissCancelJoinRequestError={onDismissCancelJoinRequestError}
      />

      <ParticipantRatingSection
        event={event}
        loading={viewerRatingLoading}
        error={viewerRatingError}
        onSubmit={onViewerRatingSubmit}
        onDismissError={onDismissViewerRatingError}
      />

      {/* Info sections */}
      <div className="ed-sections">
        {/* Date & time */}
        <div className="ed-section">
          <h2 className="ed-section-title">{t('event_detail.date_time')}</h2>
          <div className="ed-info-row">
            <span className="ed-info-icon">&#128197;</span>
            <div>
              <p className="ed-info-primary">{formatDateTime(event.start_time)}</p>
              {event.end_time && (
                <p className="ed-info-secondary">
                  {t('event_detail.until', { date: formatDateTime(event.end_time) })}
                </p>
              )}
            </div>
          </div>
        </div>

        <LocationSection location={event.location} />

        {/* Description */}
        {event.description && (
          <div className="ed-section">
            <h2 className="ed-section-title">{t('event_detail.description')}</h2>
            <p className="ed-description">{event.description}</p>
          </div>
        )}

        {/* Host */}
        <div className="ed-section">
          <h2 className="ed-section-title">{t('event_detail.host')}</h2>
          <div className="ed-host">
            <Link
              to={`/users/${event.host.id}`}
              className="ed-host-avatar-link"
              aria-label={t('event_detail.view_host_profile', {
                name: event.host.display_name ?? event.host.username,
              })}
            >
              <UserAvatar
                username={event.host.username}
                displayName={event.host.display_name}
                avatarUrl={event.host.avatar_url}
                size="md"
                variant="accent"
              />
            </Link>
            <Link to={`/users/${event.host.id}`} className="ed-host-link">
              <div className="ed-host-info">
                <p className="ed-host-name">{event.host.display_name ?? event.host.username}</p>
                <p className="ed-host-username">@{event.host.username}</p>
              </div>
            </Link>
            <RatingWithCount
              score={event.host_score.final_score}
              count={event.host_score.hosted_event_rating_count}
              className="ed-host-score"
            />
          </div>
        </div>

        {/* Details grid */}
        <div className="ed-section">
          <h2 className="ed-section-title">{t('event_detail.details')}</h2>
          <div className="ed-details-grid">
            {event.capacity != null && (
              <div className="ed-detail-item">
                <span className="ed-detail-label">{t('event_detail.capacity')}</span>
                <span className="ed-detail-value">{event.approved_participant_count} / {event.capacity}</span>
              </div>
            )}
            {event.minimum_age != null && (
              <div className="ed-detail-item">
                <span className="ed-detail-label">{t('event_detail.minimum_age')}</span>
                <span className="ed-detail-value">{event.minimum_age}+</span>
              </div>
            )}
            {preferredGenderLabel && (
              <div className="ed-detail-item">
                <span className="ed-detail-label">{t('event_detail.preferred_gender')}</span>
                <span className="ed-detail-value">{preferredGenderLabel}</span>
              </div>
            )}
            <div className="ed-detail-item">
              <span className="ed-detail-label">{t('event_detail.privacy')}</span>
              <span className="ed-detail-value">{privacyLabel}</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {event.tags.length > 0 && (
          <div className="ed-section">
            <h2 className="ed-section-title">{t('event_detail.tags')}</h2>
            <div className="ed-tags">
              {event.tags.map((tag) => (
                <span key={tag} className="ed-tag">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Constraints */}
        {event.constraints.length > 0 && (
          <div className="ed-section">
            <h2 className="ed-section-title">{t('event_detail.requirements')}</h2>
            <ul className="ed-constraints">
              {event.constraints.map((c, i) => (
                <li key={i} className="ed-constraint">
                  <span className="ed-constraint-type">{formatConstraintType(c.type)}</span>
                  <span className="ed-constraint-info">{c.info}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <EventVersionHistorySection event={event} />

        {/* Host management section — only visible to host */}
        {event.viewer_context.is_host && (
          <div className="ed-section">
            <h2 className="ed-section-title">{t('event_detail.management')}</h2>

            {/* Cancel event button */}
            {event.status === 'ACTIVE' && (
              <div className="ed-mgmt-group ed-host-action-group">
                <Link
                  to={`/events/${event.id}/edit`}
                  className="ed-edit-event-link"
                  data-testid="ed-edit-event-link"
                >
                  {t('event_detail.edit_event')}
                </Link>
                {cancelError && (
                  <div className="ed-join-error" style={{ marginBottom: 10 }}>
                    <span>{cancelError}</span>
                    <button type="button" className="ed-join-error-dismiss" onClick={onDismissCancelError}>&times;</button>
                  </div>
                )}
                <button
                  type="button"
                  className="ed-cancel-event-btn"
                  onClick={() => setShowCancelModal(true)}
                  disabled={cancelLoading}
                >
                  {t('event_detail.cancel_event')}
                </button>
              </div>
            )}

            {event.status === 'IN_PROGRESS' && (
              <div className="ed-mgmt-group">
                {completeError && (
                  <div className="ed-join-error" style={{ marginBottom: 10 }}>
                    <span>{completeError}</span>
                    <button type="button" className="ed-join-error-dismiss" onClick={onDismissCompleteError}>&times;</button>
                  </div>
                )}
                <button
                  type="button"
                  className="ed-complete-event-btn"
                  onClick={() => setShowCompleteModal(true)}
                  disabled={completeLoading}
                >
                  {t('event_detail.end_event')}
                </button>
              </div>
            )}

            <div className="ed-mgmt-group ed-reconfirmation-mgmt-group">
              <h3 className="ed-mgmt-title">
                {t('event_detail.reconfirmation_needed', { count: pendingReconfirmationCount })}
              </h3>
              {pendingReconfirmationCount > 0 ? (
                <>
                  <div className="ed-reconfirmation-mgmt-card">
                    <strong>{pendingReconfirmationCount}</strong>
                    <span>
                      {t('event_detail.reconfirmation_explainer', {
                        count: pendingReconfirmationCount,
                      })}
                    </span>
                  </div>
                  {pendingParticipantsLoading && pendingParticipants.length === 0 ? (
                    <p className="ed-mgmt-empty">{t('event_detail.loading_reconfirmations')}</p>
                  ) : pendingParticipants.length === 0 ? (
                    <p className="ed-mgmt-empty">{t('event_detail.no_reconfirmation_details')}</p>
                  ) : (
                    <ul className="ed-mgmt-list">
                      {pendingParticipants.map((p) => (
                        <HostPendingReconfirmationItem key={p.participation_id} participant={p} />
                      ))}
                    </ul>
                  )}
                  {pendingParticipantsHasNext && (
                    <button
                      type="button"
                      className="ed-secondary-btn"
                      onClick={onLoadMorePendingParticipants}
                      disabled={pendingParticipantsLoading}
                    >
                      {pendingParticipantsLoading ? t('common.loading') : t('event_detail.load_more_reconfirmations')}
                    </button>
                  )}
                </>
              ) : (
                <p className="ed-mgmt-empty">{t('event_detail.no_reconfirmations')}</p>
              )}
            </div>

            {/* Approved participants */}
            <div className="ed-mgmt-group">
              <h3 className="ed-mgmt-title">
                {t('event_detail.approved_participants', {
                  count: hostContextSummary?.approved_participant_count ?? approvedParticipants.length,
                })}
              </h3>
              {hostCanRateParticipants && (
                <div className="ed-rating-banner">
                  {t('event_detail.rating_window_open_until', {
                    date: formatShortDate(event.rating_window.closes_at),
                  })}
                </div>
              )}
              {approvedParticipantsLoading && approvedParticipants.length === 0 ? (
                <p className="ed-mgmt-empty">{t('event_detail.loading_participants')}</p>
              ) : approvedParticipants.length === 0 ? (
                <p className="ed-mgmt-empty">{t('event_detail.no_participants')}</p>
              ) : (
                <ul className="ed-mgmt-list">
                  {approvedParticipants.map((p) => (
                    <HostParticipantRatingItem
                      key={p.participation_id}
                      participant={p}
                      canEdit={hostCanRateParticipants}
                      isEditorOpen={activeParticipantEditorId === p.user.id}
                      loading={participantRatingLoadingId === p.user.id}
                      error={participantRatingError?.participantUserId === p.user.id ? participantRatingError.message : null}
                      onToggleEditor={() => {
                        onDismissParticipantRatingError();
                        setActiveParticipantEditorId((currentId) => currentId === p.user.id ? null : p.user.id);
                      }}
                      onCloseEditor={() => {
                        onDismissParticipantRatingError();
                        setActiveParticipantEditorId(null);
                      }}
                      onSubmit={onParticipantRatingSubmit}
                      onDismissError={onDismissParticipantRatingError}
                    />
                  ))}
                </ul>
              )}
              {approvedParticipantsHasNext && (
                <button
                  type="button"
                  className="ed-secondary-btn"
                  onClick={onLoadMoreApprovedParticipants}
                  disabled={approvedParticipantsLoading}
                >
                  {approvedParticipantsLoading ? t('common.loading') : t('event_detail.load_more_participants')}
                </button>
              )}
            </div>

            {/* Pending requests */}
            {(pendingJoinRequests.length > 0 || (hostContextSummary?.pending_join_request_count ?? 0) > 0) && (
              <div className="ed-mgmt-group">
                <h3 className="ed-mgmt-title">
                  {t('event_detail.pending_requests', {
                    count: hostContextSummary?.pending_join_request_count ?? pendingJoinRequests.length,
                  })}
                </h3>
                {moderateError && (
                  <div className="ed-join-error" style={{ marginBottom: 10 }}>
                    <span>{moderateError}</span>
                    <button type="button" className="ed-join-error-dismiss" onClick={onDismissModerateError}>&times;</button>
                  </div>
                )}
                {pendingJoinRequestsLoading && pendingJoinRequests.length === 0 ? (
                  <p className="ed-mgmt-empty">{t('event_detail.loading_requests')}</p>
                ) : (
                <ul className="ed-mgmt-list">
                  {pendingJoinRequests.map((r) => (
                    <li key={r.join_request_id} className="ed-mgmt-item ed-mgmt-item-pending">
                      <UserAvatar
                        username={r.user.username}
                        displayName={r.user.display_name}
                        avatarUrl={r.user.avatar_url}
                        size="sm"
                        variant="muted"
                      />
                      <div className="ed-mgmt-user-info">
                        <span className="ed-mgmt-name">{r.user.display_name ?? r.user.username}</span>
                        <span className="ed-mgmt-username">@{r.user.username}</span>
                        {r.message && <span className="ed-mgmt-message">"{r.message}"</span>}
                        {r.image_url && (
                          <a
                            className="ed-mgmt-attachment"
                            href={r.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`ed-mgmt-attachment-${r.join_request_id}`}
                          >
                            <span className="ed-mgmt-attachment-icon" aria-hidden>&#128247;</span>
                            {t('event_detail.view_attachment')}
                          </a>
                        )}
                        {r.user.final_score != null && (
                          <RatingWithCount
                            score={r.user.final_score}
                            count={r.user.rating_count}
                            className="ed-mgmt-user-score"
                          />
                        )}
                      </div>
                      <div className="ed-mgmt-actions">
                        <button
                          type="button"
                          className="ed-approve-btn"
                          onClick={() => onApprove(r.join_request_id)}
                          disabled={moderatingId === r.join_request_id}
                        >
                          {moderatingId === r.join_request_id ? '...' : t('event_detail.approve')}
                        </button>
                        <button
                          type="button"
                          className="ed-reject-btn"
                          onClick={() => onReject(r.join_request_id)}
                          disabled={moderatingId === r.join_request_id}
                        >
                          {t('event_detail.reject')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                )}
                {pendingJoinRequestsHasNext && (
                  <button
                    type="button"
                    className="ed-secondary-btn"
                    onClick={onLoadMorePendingJoinRequests}
                    disabled={pendingJoinRequestsLoading}
                  >
                    {pendingJoinRequestsLoading ? t('common.loading') : t('event_detail.load_more_requests')}
                  </button>
                )}
              </div>
            )}

            {/* Invitations (private events only) */}
            {event.privacy_level === 'PRIVATE' && (
              <InvitationsManagementSection
                invitations={invitations}
                invitationsLoading={invitationsLoading}
                invitationsHasNext={invitationsHasNext}
                hostContextSummary={hostContextSummary}
                isCancelable={event.status === 'ACTIVE'}
                inviteLoading={inviteLoading}
                inviteError={inviteError}
                inviteResult={inviteResult}
                onLoadMoreInvitations={onLoadMoreInvitations}
                onCreateInvitations={onCreateInvitations}
                onDismissInviteError={onDismissInviteError}
                onClearInviteResult={onClearInviteResult}
              />
            )}
          </div>
        )}

        <EventInteractionPanel
          event={event}
          token={token}
          isAuthenticated={isAuthenticated}
        />
      </div>

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <CancelConfirmModal
          loading={cancelLoading}
          onConfirm={() => {
            onCancel();
            setShowCancelModal(false);
          }}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showCompleteModal && (
        <CompleteConfirmModal
          loading={completeLoading}
          onConfirm={() => {
            onComplete();
            setShowCompleteModal(false);
          }}
          onClose={() => setShowCompleteModal(false)}
        />
      )}

      {showReportModal && (
        <ReportEventModal
          loading={reportLoading}
          error={reportError}
          onSubmit={onReportEvent}
          onDismissError={onDismissReportError}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}

export default function EventDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const vm = useEventDetailViewModel(id, token);

  if (vm.status === 'loading') {
    return (
      <div className="ed-page">
        <div className="ed-state-container">
          <span className="spinner" />
          <p>{t('event_detail.loading_event')}</p>
        </div>
      </div>
    );
  }

  if (vm.status === 'not-found') {
    return (
      <NotFoundView 
        title={t('event_detail.not_found_title')}
        message={t('event_detail.not_found_body')}
      />
    );
  }

  if (vm.status === 'forbidden') {
    return <AccessDeniedView isPrivateEvent />;
  }

  if (vm.status === 'error') {
    return (
      <div className="ed-page">
        <div className="ed-state-container">
          <h2>{t('event_detail.error_title')}</h2>
          <p>{vm.errorMessage}</p>
          <button type="button" className="btn-primary ed-retry-btn" onClick={vm.retry}>
            {t('event_detail.try_again')}
          </button>
        </div>
      </div>
    );
  }

  if (!vm.event) return null;

  return (
    <EventContent
      event={vm.event}
      isAuthenticated={Boolean(token)}
      token={token}
      coverImageUploading={vm.coverImageUploading}
      coverImageError={vm.coverImageError}
      coverImageSuccessMessage={vm.coverImageSuccessMessage}
      onCoverImageFileSelected={vm.handleCoverImageUpload}
      onDismissCoverImageError={vm.dismissCoverImageError}
      onDismissCoverImageSuccess={vm.dismissCoverImageSuccess}
      cancelJoinRequestLoading={vm.cancelJoinRequestLoading}
      cancelJoinRequestError={vm.cancelJoinRequestError}
      onCancelJoinRequest={vm.handleCancelJoinRequest}
      onDismissCancelJoinRequestError={vm.dismissCancelJoinRequestError}
      joinLoading={vm.joinLoading}
      joinError={vm.joinError}
      leaveLoading={vm.leaveLoading}
      leaveError={vm.leaveError}
      viewerRatingLoading={vm.viewerRatingLoading}
      viewerRatingError={vm.viewerRatingError}
      participantRatingLoadingId={vm.participantRatingLoadingId}
      participantRatingError={vm.participantRatingError}
      onJoin={vm.handleJoin}
      onLeave={vm.handleLeave}
      onRequestJoin={vm.handleRequestJoin}
      onViewerRatingSubmit={vm.handleViewerRatingSubmit}
      onParticipantRatingSubmit={vm.handleParticipantRatingSubmit}
      onDismissError={vm.dismissJoinError}
      onDismissLeaveError={vm.dismissLeaveError}
      onDismissViewerRatingError={vm.dismissViewerRatingError}
      onDismissParticipantRatingError={vm.dismissParticipantRatingError}
      moderatingId={vm.moderatingId}
      moderateError={vm.moderateError}
      onApprove={vm.handleApprove}
      onReject={vm.handleReject}
      onDismissModerateError={vm.dismissModerateError}
      cancelLoading={vm.cancelLoading}
      cancelError={vm.cancelError}
      onCancel={vm.handleCancel}
      onDismissCancelError={vm.dismissCancelError}
      completeLoading={vm.completeLoading}
      completeError={vm.completeError}
      onComplete={vm.handleComplete}
      onDismissCompleteError={vm.dismissCompleteError}
      favoriteLoading={vm.favoriteLoading}
      onFavoriteToggle={vm.handleFavoriteToggle}
      reportLoading={vm.reportLoading}
      reportError={vm.reportError}
      reportSuccessMessage={vm.reportSuccessMessage}
      onReportEvent={vm.handleReportEvent}
      onDismissReportError={vm.dismissReportError}
      onDismissReportSuccess={vm.dismissReportSuccess}
      reconfirmLoading={vm.reconfirmLoading}
      reconfirmError={vm.reconfirmError}
      reconfirmSuccessMessage={vm.reconfirmSuccessMessage}
      onReconfirmParticipation={vm.handleReconfirmParticipation}
      onDismissReconfirmError={vm.dismissReconfirmError}
      onDismissReconfirmSuccess={vm.dismissReconfirmSuccess}
      hostContextSummary={vm.hostContextSummary}
      approvedParticipants={vm.approvedParticipants}
      approvedParticipantsLoading={vm.approvedParticipantsLoading}
      approvedParticipantsHasNext={vm.approvedParticipantsHasNext}
      pendingParticipants={vm.pendingParticipants}
      pendingParticipantsLoading={vm.pendingParticipantsLoading}
      pendingParticipantsHasNext={vm.pendingParticipantsHasNext}
      pendingJoinRequests={vm.pendingJoinRequests}
      pendingJoinRequestsLoading={vm.pendingJoinRequestsLoading}
      pendingJoinRequestsHasNext={vm.pendingJoinRequestsHasNext}
      invitations={vm.invitations}
      invitationsLoading={vm.invitationsLoading}
      invitationsHasNext={vm.invitationsHasNext}
      onLoadMoreApprovedParticipants={vm.loadMoreApprovedParticipants}
      onLoadMorePendingParticipants={vm.loadMorePendingParticipants}
      onLoadMorePendingJoinRequests={vm.loadMorePendingJoinRequests}
      onLoadMoreInvitations={vm.loadMoreInvitations}
      inviteLoading={vm.inviteLoading}
      inviteError={vm.inviteError}
      inviteResult={vm.inviteResult}
      onCreateInvitations={vm.handleCreateInvitations}
      onDismissInviteError={vm.dismissInviteError}
      onClearInviteResult={vm.clearInviteResult}
    />
  );
}
