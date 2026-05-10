import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEventDetailViewModel } from '@/viewmodels/event/useEventDetailViewModel';
import type {
  EventReportCategory,
  EventDetailApprovedParticipant,
  EventDetailInvitation,
  EventDetailPendingJoinRequest,
  EventDetailResponse,
  EventHostContextSummary,
} from '@/models/event';
import { isActiveEventParticipantStatus } from '@/models/event';
import type {
  CreateEventInvitationsResponse,
  EventInvitationFailure,
  InvitationFailureCode,
} from '@/models/invitation';
import { EventCoverImage } from '@/components/EventCoverImage';
import { UserAvatar } from '@/components/UserAvatar';
import { getEventLifecyclePresentation, getEventStatusPresentation } from '@/utils/eventStatus';
import { getApproximateLocationText } from '@/utils/locationApproximation';
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

const REPORT_REASONS: Array<{ value: EventReportCategory; label: string; hint: string }> = [
  {
    value: 'SPAM_OR_SCAM',
    label: 'Spam',
    hint: 'Promotional, misleading, or scam-like event content.',
  },
  {
    value: 'INAPPROPRIATE_CONTENT',
    label: 'Inappropriate',
    hint: 'Offensive, explicit, or otherwise inappropriate event content.',
  },
  {
    value: 'HARASSMENT',
    label: 'Harassment',
    hint: 'Targeted abuse, threats, or harassing behavior.',
  },
];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' at ' + d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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
        This event will be automatically completed in <strong>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</strong> due to inactivity.
        {event.viewer_context.is_host && ' Update the event to keep it active.'}
      </span>
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
  const label = level === 'PUBLIC' ? 'Public' : level === 'PROTECTED' ? 'Protected' : 'Private';
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

  return (
    <div className="ed-section">
      <h2 className="ed-section-title">Location</h2>
      {isApproximate && (
        <div className="ed-approx-location-warning" role="status">
          <strong>Approximate location shown</strong>
          <span>
            This protected event hides its exact address until your participation is approved.
          </span>
        </div>
      )}
      <div className="ed-info-row">
        <span className="ed-info-icon">&#128205;</span>
        <div>
          {location.address && !isApproximate ? (
            <p className="ed-info-primary">{location.address}</p>
          ) : isApproximate ? (
            <p className="ed-info-primary">Approximate area</p>
          ) : (
            <p className="ed-info-secondary">No address provided</p>
          )}
          <p className="ed-info-secondary">
            {isApproximate
              ? getApproximateLocationText(Boolean(location.address))
              : location.type === 'ROUTE'
                ? 'Route-based event'
                : 'Point location'}
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
                <p>Loading map...</p>
              </div>
            }
          >
            <EventDetailMiniMap location={location} />
          </Suspense>
          {isApproximate ? (
            <div className="ed-approx-location-note" role="note">
              Exact directions become available after your participation is approved.
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
              Get directions
            </a>
          )}
        </div>
      ) : (
        <p className="ed-map-fallback">Map unavailable for this event.</p>
      )}
    </div>
  );
}

const FAILURE_CODE_LABELS: Record<InvitationFailureCode, string> = {
  ALREADY_INVITED: 'Already invited',
  ALREADY_PARTICIPATING: 'Already participating',
  HOST_USER: 'Cannot invite the host',
  DECLINE_COOLDOWN_ACTIVE: 'Recently declined — try again later',
  CAPACITY_EXCEEDED: 'Event is full',
  DUPLICATE_USERNAME: 'Duplicate username in batch',
};

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
          <h3 id="ed-invite-title">Invite Users</h3>
          <button
            type="button"
            className="ed-invite-modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="ed-invite-form">
          <label className="ed-invite-label" htmlFor="ed-invite-usernames">
            Usernames
          </label>
          <textarea
            id="ed-invite-usernames"
            className="ed-invite-textarea"
            placeholder="Enter usernames separated by commas, spaces, or new lines"
            value={usernamesInput}
            onChange={(e) => setUsernamesInput(e.target.value)}
            disabled={loading}
            rows={3}
          />
          <p className="ed-invite-hint">
            {usernames.length === 0
              ? 'Enter at least one username.'
              : usernames.length > 100
                ? `Too many — limit is 100 (you have ${usernames.length}).`
                : `${usernames.length} username${usernames.length !== 1 ? 's' : ''} ready to invite.`}
          </p>

          <label className="ed-invite-label" htmlFor="ed-invite-message">
            Message (optional)
          </label>
          <textarea
            id="ed-invite-message"
            className="ed-invite-textarea"
            placeholder="Add a personal note for invitees..."
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
                  &#10003; Sent {result.success_count} invitation
                  {result.success_count !== 1 ? 's' : ''}.
                </p>
              )}
              {result.invalid_usernames.length > 0 && (
                <p className="ed-invite-result-line ed-invite-result-warn">
                  Unknown username{result.invalid_usernames.length !== 1 ? 's' : ''}:{' '}
                  <strong>{result.invalid_usernames.join(', ')}</strong>
                </p>
              )}
              {result.failed.length > 0 && (
                <ul className="ed-invite-result-failed-list">
                  {result.failed.map((f: EventInvitationFailure) => (
                    <li key={`${f.username}-${f.code}`}>
                      <strong>@{f.username}</strong>: {FAILURE_CODE_LABELS[f.code] ?? f.code}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="ed-invite-result-clear"
                onClick={onClearResult}
              >
                Dismiss
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
              Cancel
            </button>
            <button
              type="submit"
              className="ed-primary-btn"
              disabled={!canSubmit}
            >
              {loading ? <span className="spinner" /> : 'Send Invitations'}
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
        <h3 className="ed-mgmt-title">Invitations ({total})</h3>
        {isCancelable && (
          <button
            type="button"
            className="ed-primary-btn ed-mgmt-action-btn"
            onClick={() => setShowModal(true)}
            data-testid="ed-invite-open"
          >
            + Invite Users
          </button>
        )}
      </div>

      {invitationsLoading && invitations.length === 0 ? (
        <p className="ed-mgmt-empty">Loading invitations...</p>
      ) : invitations.length === 0 ? (
        <p className="ed-mgmt-empty">No invitations sent yet.</p>
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
                {inv.status}
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
          {invitationsLoading ? 'Loading...' : 'Load More Invitations'}
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
  joinSuccess,
  leaveLoading,
  leaveError,
  onJoin,
  onLeave,
  onRequestJoin,
  onDismissError,
  onDismissJoinSuccess,
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
  joinSuccess: string | null;
  leaveLoading: boolean;
  leaveError: string | null;
  onJoin: () => void;
  onLeave: () => void;
  onRequestJoin: (message?: string, imageFile?: File | null) => Promise<boolean>;
  onDismissError: () => void;
  onDismissJoinSuccess: () => void;
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
  const isActiveParticipant = isActiveEventParticipantStatus(ctx.participation_status);

  // Host doesn't see join actions
  if (ctx.is_host) return null;

  // Already participating states
  if (isActiveParticipant) {
    const isCompletedOrCanceled = event.status === 'COMPLETED' || event.status === 'CANCELED';
    const joinedBannerClass = event.status === 'COMPLETED'
      ? 'ed-participation-attended'
      : 'ed-participation-joined';
    const joinedBannerText = event.status === 'COMPLETED'
      ? 'You attended this event'
      : 'You are participating in this event';

    return (
      <div className="ed-section">
        {joinSuccess && (
          <div className="ed-join-success" role="status">
            <span>{joinSuccess}</span>
            <button
              type="button"
              className="ed-join-success-dismiss"
              onClick={onDismissJoinSuccess}
              aria-label="Dismiss message"
            >
              &times;
            </button>
          </div>
        )}
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
              <strong>View your ticket</strong>
              <span>Open it on mobile to scan in at the event.</span>
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
              {leaveLoading ? <span className="spinner" /> : 'Leave Event'}
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

  if (ctx.participation_status === 'PENDING') {
    return (
      <div className="ed-section">
        {joinSuccess && (
          <div className="ed-join-success" role="status">
            <span>{joinSuccess}</span>
            <button
              type="button"
              className="ed-join-success-dismiss"
              onClick={onDismissJoinSuccess}
              aria-label="Dismiss message"
            >
              &times;
            </button>
          </div>
        )}
        <div className="ed-participation-banner ed-participation-pending">
          Your join request is pending approval
        </div>
        {cancelJoinRequestError && (
          <div className="ed-join-error">
            <span>{cancelJoinRequestError}</span>
            <button
              type="button"
              className="ed-join-error-dismiss"
              onClick={onDismissCancelJoinRequestError}
              aria-label="Dismiss error"
            >
              &times;
            </button>
          </div>
        )}
        <div className="ed-leave-action">
          <button
            type="button"
            className="btn-primary ed-join-btn ed-join-btn-protected"
            disabled
            data-testid="ed-request-pending-btn"
          >
            Request Pending
          </button>
          <button
            type="button"
            className="ed-leave-btn"
            onClick={() => setShowCancelRequestModal(true)}
            disabled={cancelJoinRequestLoading}
            data-testid="ed-cancel-request-btn"
          >
            {cancelJoinRequestLoading ? <span className="spinner" /> : 'Cancel Request'}
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

  if (ctx.participation_status === 'INVITED') {
    return (
      <div className="ed-section">
        <div className="ed-participation-banner ed-participation-invited">
          You have been invited to this event
        </div>
      </div>
    );
  }

  // Not participating — check if join is possible
  const isInactive = event.status === 'CANCELED' || event.status === 'COMPLETED';
  const isFull = event.capacity != null && event.approved_participant_count >= event.capacity;

  // Constraint warnings
  const warnings: string[] = [];
  if (event.minimum_age != null) {
    warnings.push(`Minimum age: ${event.minimum_age}+`);
  }
  if (event.preferred_gender) {
    warnings.push(`Preferred gender: ${event.preferred_gender}`);
  }

  return (
    <div className="ed-section">
      {/* Constraint warnings */}
      {warnings.length > 0 && (
        <div className="ed-constraint-warning">
          <strong>Eligibility notes:</strong> {warnings.join(' · ')}
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
          This event is {event.status.toLowerCase()} and no longer accepting participants.
        </div>
      ) : isFull ? (
        <div className="ed-join-disabled-banner">
          This event has reached its maximum capacity.
        </div>
      ) : event.privacy_level === 'PUBLIC' ? (
        <>
          {!isAuthenticated && (
            <p className="ed-join-auth-hint">
              Please sign in to participate.{' '}
              <Link to="/login" className="ed-join-auth-link">Sign in</Link>
            </p>
          )}
          <button
            type="button"
            className="btn-primary ed-join-btn"
            onClick={onJoin}
            disabled={!isAuthenticated || joinLoading}
          >
            {joinLoading ? <span className="spinner" /> : 'Join Event'}
          </button>
        </>
      ) : event.privacy_level === 'PROTECTED' ? (
        /* PROTECTED — request to join */
        <div className="ed-request-join">
          {!showRequestForm ? (
            <>
              {!isAuthenticated && (
                <p className="ed-join-auth-hint">
                  Please sign in to participate.{' '}
                  <Link to="/login" className="ed-join-auth-link">Sign in</Link>
                </p>
              )}
              <button
                type="button"
                className="btn-primary ed-join-btn ed-join-btn-protected"
                onClick={() => setShowRequestForm(true)}
                disabled={!isAuthenticated || joinLoading}
              >
                {joinLoading ? (
                  <>
                    <span className="spinner" /> Sending...
                  </>
                ) : 'Request to Join'}
              </button>
            </>
          ) : (
            <div className="ed-request-form">
              <textarea
                className="field-input ed-request-message"
                placeholder="Add a message (optional)..."
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
                      setRequestImageError('File must be 5 MB or smaller.');
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
                    <img src={requestImagePreview} alt="Selected proof" />
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
                      aria-label="Remove image"
                    >
                      Remove
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
                    + Attach proof image (optional, up to 5 MB)
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
                  onClick={async () => {
                    const ok = await onRequestJoin(
                      requestMessage.trim() || undefined,
                      requestImageFile,
                    );
                    if (!ok) return;
                    setShowRequestForm(false);
                    setRequestMessage('');
                    setRequestImageFile(null);
                    if (requestImagePreview) URL.revokeObjectURL(requestImagePreview);
                    setRequestImagePreview(null);
                    if (requestImageInputRef.current) requestImageInputRef.current.value = '';
                  }}
                  disabled={joinLoading}
                >
                  {joinLoading ? (
                    <>
                      <span className="spinner" /> Sending...
                    </>
                  ) : 'Send Request'}
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
                  Cancel
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
    <div className={`ed-star-input ed-star-input-${size}`} role="radiogroup" aria-label="Select a star rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
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
    && isActiveEventParticipantStatus(event.viewer_context.participation_status)
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
            <span className="ed-rating-kicker">Post-event feedback</span>
            <h2 className="ed-rating-title">
              {existingRating ? 'Update your rating for the host' : 'How was this event?'}
            </h2>
          </div>
          <span className="ed-rating-deadline">
            Open until {formatShortDate(event.rating_window.closes_at)}
          </span>
        </div>

        <p className="ed-rating-copy">
          Rate the experience from 1 to 5 stars. You can optionally leave a short message for the host.
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
                Last updated {formatShortDate(existingRating.updated_at)}
              </p>
              <button
                type="button"
                className="ed-rate-participant-btn ed-rating-edit-btn"
                onClick={() => {
                  onDismissError();
                  setIsEditing(true);
                }}
              >
                Edit Rating
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="ed-rating-star-row">
              <StarRatingInput value={rating} onChange={setRating} disabled={loading} size="lg" />
              <span className={`ed-rating-summary ${rating > 0 ? 'is-selected' : ''}`}>
                {rating > 0 ? `${rating}/5 · ${renderStars(rating)}` : 'Select a star rating'}
              </span>
            </div>

            <label className="ed-rating-field-label" htmlFor="event-rating-message">
              Message
            </label>
            <textarea
              id="event-rating-message"
              className={`field-input ed-rating-textarea ${feedbackError ? 'has-error' : ''}`}
              placeholder="Share what stood out, how the event felt, or anything the host should know."
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
                Optional. If you write one, keep it between {FEEDBACK_MIN_LENGTH} and {FEEDBACK_MAX_LENGTH} characters.
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
                Last updated {formatShortDate(existingRating.updated_at)}. Submitting again overwrites the existing rating.
              </p>
            )}

            <div className="ed-rating-actions">
              <button
                type="button"
                className="btn-primary ed-rating-submit-btn"
                disabled={loading || rating === 0 || Boolean(feedbackError)}
                onClick={() => onSubmit(rating, message)}
              >
                {loading ? <span className="spinner" /> : existingRating ? 'Update Rating' : 'Submit Rating'}
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
                  Cancel
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
        aria-label={`View ${getDisplayName(participant.user)}'s profile`}
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
              <span className="ed-mgmt-user-score">{'★'} {participant.user.final_score.toFixed(1)} ({participant.user.rating_count})</span>
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
          {isEditorOpen ? 'Close' : existingRating ? 'Edit Rating' : 'Rate'}
        </button>
      )}

      {isEditorOpen && (
        <div className="ed-inline-rating-editor">
          <div className="ed-inline-rating-header">
            <strong>Rate {getDisplayName(participant.user)}</strong>
            <span>1 to 5 stars</span>
          </div>

          <StarRatingInput value={rating} onChange={setRating} disabled={loading} />

          <textarea
            className={`field-input ed-rating-textarea ed-rating-textarea-inline ${feedbackError ? 'has-error' : ''}`}
            placeholder="Optional note about reliability, communication, or overall experience."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={FEEDBACK_MAX_LENGTH}
          />

          <div className="ed-rating-meta">
            <span className={`ed-rating-char-count ${feedbackError ? 'is-error' : ''}`}>
              {trimmedLength}/{FEEDBACK_MAX_LENGTH}
            </span>
            <span className="ed-rating-helper">Optional, but must be at least {FEEDBACK_MIN_LENGTH} characters if provided.</span>
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
              {loading ? <span className="spinner" /> : existingRating ? 'Save Changes' : 'Submit Rating'}
            </button>
            <button
              type="button"
              className="ed-inline-rating-cancel"
              onClick={onToggleEditor}
              disabled={loading}
            >
              Cancel
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
  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="ed-modal-title">Cancel Event</h3>
        <p className="ed-modal-text">
          Are you sure you want to cancel this event? This action cannot be undone.
          All participants will be notified.
        </p>
        <div className="ed-modal-actions">
          <button
            type="button"
            className="ed-modal-cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            Go Back
          </button>
          <button
            type="button"
            className="ed-modal-confirm-btn"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Yes, Cancel Event'}
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
  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="ed-modal-title">End Event</h3>
        <p className="ed-modal-text">
          Are you sure you want to end this event now? The event will be marked as completed.
        </p>
        <div className="ed-modal-actions">
          <button
            type="button"
            className="ed-modal-cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            Go Back
          </button>
          <button
            type="button"
            className="ed-modal-confirm-btn"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Yes, End Event'}
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
  const [category, setCategory] = useState<EventReportCategory>('SPAM_OR_SCAM');
  const [message, setMessage] = useState('');
  const isMessageTooLong = message.length > REPORT_MESSAGE_MAX_LENGTH;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isMessageTooLong || loading) return;
    const success = await onSubmit(category, message);
    if (success) onClose();
  };

  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <form className="ed-modal ed-report-modal" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <h3 className="ed-modal-title">Report Event</h3>
        <p className="ed-modal-text">
          Choose the closest reason. Reports are sent to moderators for review.
        </p>

        {error && (
          <div className="ed-join-error" role="alert">
            <span>{error}</span>
            <button type="button" className="ed-join-error-dismiss" onClick={onDismissError}>
              &times;
            </button>
          </div>
        )}

        <div className="ed-report-reasons" role="radiogroup" aria-label="Report reason">
          {REPORT_REASONS.map((reason) => (
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
          Additional details <span>(optional)</span>
        </label>
        <textarea
          id="ed-report-message"
          className={`ed-report-message ${isMessageTooLong ? 'has-error' : ''}`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={REPORT_MESSAGE_MAX_LENGTH + 1}
          rows={4}
          placeholder="Add context that would help moderators understand the issue."
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
            Cancel
          </button>
          <button
            type="submit"
            className="ed-modal-confirm-btn ed-report-submit-btn"
            disabled={loading || isMessageTooLong}
          >
            {loading ? <span className="spinner" /> : 'Submit Report'}
          </button>
        </div>
      </form>
    </div>
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
  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="ed-modal-title">Leave Event</h3>
        <p className="ed-modal-text">
          Are you sure you want to leave this event? You will lose your spot and may need to rejoin later.
        </p>
        <div className="ed-modal-actions">
          <button
            type="button"
            className="ed-modal-cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            Go Back
          </button>
          <button
            type="button"
            className="ed-modal-confirm-btn"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Yes, Leave Event'}
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
          Cancel Join Request
        </h3>
        <p className="ed-modal-text">
          Are you sure you want to withdraw your join request? You can request to join again later
          if you change your mind.
        </p>
        <div className="ed-modal-actions">
          <button
            type="button"
            className="ed-modal-cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            Keep Request
          </button>
          <button
            type="button"
            className="ed-modal-confirm-btn"
            onClick={onConfirm}
            disabled={loading}
            data-testid="ed-cancel-request-confirm"
          >
            {loading ? <span className="spinner" /> : 'Yes, Cancel Request'}
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
  joinSuccess,
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
  onDismissJoinSuccess,
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
  isAuthenticated,
  token,
  hostContextSummary,
  approvedParticipants,
  approvedParticipantsLoading,
  approvedParticipantsHasNext,
  pendingJoinRequests,
  pendingJoinRequestsLoading,
  pendingJoinRequestsHasNext,
  invitations,
  invitationsLoading,
  invitationsHasNext,
  onLoadMoreApprovedParticipants,
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
  joinSuccess: string | null;
  leaveLoading: boolean;
  leaveError: string | null;
  viewerRatingLoading: boolean;
  viewerRatingError: string | null;
  participantRatingLoadingId: string | null;
  participantRatingError: { participantUserId: string; message: string } | null;
  onJoin: () => void;
  onLeave: () => void;
  onRequestJoin: (message?: string, imageFile?: File | null) => Promise<boolean>;
  onViewerRatingSubmit: (rating: number, message?: string) => void;
  onParticipantRatingSubmit: (participantUserId: string, rating: number, message?: string) => void;
  onDismissError: () => void;
  onDismissJoinSuccess: () => void;
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
  isAuthenticated: boolean;
  token: string | null;
  hostContextSummary: EventHostContextSummary | null;
  approvedParticipants: EventDetailApprovedParticipant[];
  approvedParticipantsLoading: boolean;
  approvedParticipantsHasNext: boolean;
  pendingJoinRequests: EventDetailPendingJoinRequest[];
  pendingJoinRequestsLoading: boolean;
  pendingJoinRequestsHasNext: boolean;
  invitations: EventDetailInvitation[];
  invitationsLoading: boolean;
  invitationsHasNext: boolean;
  onLoadMoreApprovedParticipants: () => void;
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

  const showCoverImageEdit = isAuthenticated && event.viewer_context.is_host;

  return (
    <div className="ed-page">
      <button type="button" className="ed-back-btn" onClick={() => navigate(-1)}>
        &larr; Back
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
              aria-label="Change cover image"
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
              aria-label={event.viewer_context.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
              title={isAuthenticated ? undefined : 'Sign in to save this event'}
            >
              {event.viewer_context.is_favorited ? '★' : '☆'}
            </button>
            <button
              type="button"
              className="ed-report-flag-btn"
              aria-label="Report event"
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
          <span className="ed-category">{event.category.name}</span>
        )}
      </div>

      {/* Metrics row */}
      <div className="ed-metrics">
        <div className="ed-metric">
          <div className="ed-metric-topline">
            <span className="ed-metric-emote" aria-hidden><ParticipantsMetricIcon /></span>
            <span className="ed-metric-value">{event.approved_participant_count}</span>
          </div>
          <span className="ed-metric-label">Participant{event.approved_participant_count !== 1 ? 's' : ''}</span>
        </div>
        <div className="ed-metric">
          <div className="ed-metric-topline">
            <span className="ed-metric-emote" aria-hidden><SavesMetricIcon /></span>
            <span className="ed-metric-value">{event.favorite_count}</span>
          </div>
          <span className="ed-metric-label">Save{event.favorite_count !== 1 ? 's' : ''}</span>
        </div>
        {event.host_score.final_score != null && (
          <div className="ed-metric">
            <span className="ed-metric-value">{'★'} {event.host_score.final_score.toFixed(1)}</span>
            <span className="ed-metric-label">Host Score</span>
          </div>
        )}
      </div>

      {/* Expiry warning — shown in last 7 days before auto-completion */}
      <ExpiryWarningBanner event={event} />

      {/* Join action — prominent position */}
      <JoinActionSection
        event={event}
        joinLoading={joinLoading}
        joinError={joinError}
        joinSuccess={joinSuccess}
        leaveLoading={leaveLoading}
        leaveError={leaveError}
        onJoin={onJoin}
        onLeave={onLeave}
        onRequestJoin={onRequestJoin}
        onDismissError={onDismissError}
        onDismissJoinSuccess={onDismissJoinSuccess}
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
          <h2 className="ed-section-title">Date & Time</h2>
          <div className="ed-info-row">
            <span className="ed-info-icon">&#128197;</span>
            <div>
              <p className="ed-info-primary">{formatDateTime(event.start_time)}</p>
              {event.end_time && (
                <p className="ed-info-secondary">
                  Until {formatDateTime(event.end_time)}
                </p>
              )}
            </div>
          </div>
        </div>

        <LocationSection location={event.location} />

        {/* Description */}
        {event.description && (
          <div className="ed-section">
            <h2 className="ed-section-title">Description</h2>
            <p className="ed-description">{event.description}</p>
          </div>
        )}

        {/* Host */}
        <div className="ed-section">
          <h2 className="ed-section-title">Host</h2>
          <div className="ed-host">
            <Link
              to={`/users/${event.host.id}`}
              className="ed-host-avatar-link"
              aria-label={`View ${event.host.display_name ?? event.host.username}'s profile`}
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
            {event.host_score.final_score != null && (
              <span className="ed-host-score">
                {'★'} {event.host_score.final_score.toFixed(1)}
                <span className="ed-host-rating-count"> ({event.host_score.hosted_event_rating_count})</span>
              </span>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="ed-section">
          <h2 className="ed-section-title">Details</h2>
          <div className="ed-details-grid">
            {event.capacity != null && (
              <div className="ed-detail-item">
                <span className="ed-detail-label">Capacity</span>
                <span className="ed-detail-value">{event.approved_participant_count} / {event.capacity}</span>
              </div>
            )}
            {event.minimum_age != null && (
              <div className="ed-detail-item">
                <span className="ed-detail-label">Minimum Age</span>
                <span className="ed-detail-value">{event.minimum_age}+</span>
              </div>
            )}
            {event.preferred_gender && (
              <div className="ed-detail-item">
                <span className="ed-detail-label">Preferred Gender</span>
                <span className="ed-detail-value">{event.preferred_gender}</span>
              </div>
            )}
            <div className="ed-detail-item">
              <span className="ed-detail-label">Privacy</span>
              <span className="ed-detail-value">{event.privacy_level}</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {event.tags.length > 0 && (
          <div className="ed-section">
            <h2 className="ed-section-title">Tags</h2>
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
            <h2 className="ed-section-title">Requirements</h2>
            <ul className="ed-constraints">
              {event.constraints.map((c, i) => (
                <li key={i} className="ed-constraint">
                  <span className="ed-constraint-type">{c.type}</span>
                  <span className="ed-constraint-info">{c.info}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Host management section — only visible to host */}
        {event.viewer_context.is_host && (
          <div className="ed-section">
            <h2 className="ed-section-title">Management</h2>

            {/* Cancel event button */}
            {event.status === 'ACTIVE' && (
              <div className="ed-mgmt-group">
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
                  Cancel Event
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
                  End Event
                </button>
              </div>
            )}

            {/* Approved participants */}
            <div className="ed-mgmt-group">
              <h3 className="ed-mgmt-title">
                Approved Participants ({hostContextSummary?.approved_participant_count ?? approvedParticipants.length})
              </h3>
              {hostCanRateParticipants && (
                <div className="ed-rating-banner">
                  Participant rating window is open until {formatShortDate(event.rating_window.closes_at)}
                </div>
              )}
              {approvedParticipantsLoading && approvedParticipants.length === 0 ? (
                <p className="ed-mgmt-empty">Loading participants...</p>
              ) : approvedParticipants.length === 0 ? (
                <p className="ed-mgmt-empty">No participants yet</p>
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
                  {approvedParticipantsLoading ? 'Loading...' : 'Load More Participants'}
                </button>
              )}
            </div>

            {/* Pending requests */}
            {(pendingJoinRequests.length > 0 || (hostContextSummary?.pending_join_request_count ?? 0) > 0) && (
              <div className="ed-mgmt-group">
                <h3 className="ed-mgmt-title">
                  Pending Requests ({hostContextSummary?.pending_join_request_count ?? pendingJoinRequests.length})
                </h3>
                {moderateError && (
                  <div className="ed-join-error" style={{ marginBottom: 10 }}>
                    <span>{moderateError}</span>
                    <button type="button" className="ed-join-error-dismiss" onClick={onDismissModerateError}>&times;</button>
                  </div>
                )}
                {pendingJoinRequestsLoading && pendingJoinRequests.length === 0 ? (
                  <p className="ed-mgmt-empty">Loading requests...</p>
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
                            View attachment
                          </a>
                        )}
                        {r.user.final_score != null && (
                          <span className="ed-mgmt-user-score">{'★'} {r.user.final_score.toFixed(1)} ({r.user.rating_count})</span>
                        )}
                      </div>
                      <div className="ed-mgmt-actions">
                        <button
                          type="button"
                          className="ed-approve-btn"
                          onClick={() => onApprove(r.join_request_id)}
                          disabled={moderatingId === r.join_request_id}
                        >
                          {moderatingId === r.join_request_id ? '...' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="ed-reject-btn"
                          onClick={() => onReject(r.join_request_id)}
                          disabled={moderatingId === r.join_request_id}
                        >
                          Reject
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
                    {pendingJoinRequestsLoading ? 'Loading...' : 'Load More Requests'}
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
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const vm = useEventDetailViewModel(id, token);

  if (vm.status === 'loading') {
    return (
      <div className="ed-page">
        <div className="ed-state-container">
          <span className="spinner" />
          <p>Loading event...</p>
        </div>
      </div>
    );
  }

  if (vm.status === 'not-found') {
    return (
      <NotFoundView 
        title="Event Not Found"
        message="This event doesn't exist or has been removed."
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
          <h2>Something Went Wrong</h2>
          <p>{vm.errorMessage}</p>
          <button type="button" className="btn-primary ed-retry-btn" onClick={vm.retry}>
            Try Again
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
      joinSuccess={vm.joinSuccess}
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
      onDismissJoinSuccess={vm.dismissJoinSuccess}
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
      hostContextSummary={vm.hostContextSummary}
      approvedParticipants={vm.approvedParticipants}
      approvedParticipantsLoading={vm.approvedParticipantsLoading}
      approvedParticipantsHasNext={vm.approvedParticipantsHasNext}
      pendingJoinRequests={vm.pendingJoinRequests}
      pendingJoinRequestsLoading={vm.pendingJoinRequestsLoading}
      pendingJoinRequestsHasNext={vm.pendingJoinRequestsHasNext}
      invitations={vm.invitations}
      invitationsLoading={vm.invitationsLoading}
      invitationsHasNext={vm.invitationsHasNext}
      onLoadMoreApprovedParticipants={vm.loadMoreApprovedParticipants}
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
