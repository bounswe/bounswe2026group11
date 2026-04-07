import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEventDetailViewModel } from '@/viewmodels/event/useEventDetailViewModel';
import type {
  EventDetailApprovedParticipant,
  EventDetailInvitation,
  EventDetailPendingJoinRequest,
  EventDetailResponse,
  EventHostContextSummary,
} from '@/models/event';
import { EventCoverImage } from '@/components/EventCoverImage';
import { UserAvatar } from '@/components/UserAvatar';
import { getEventLifecyclePresentation, getEventStatusPresentation } from '@/utils/eventStatus';
import NotFoundView from '../fallback/NotFoundView';
import AccessDeniedView from '../fallback/AccessDeniedView';
import '@/styles/event-detail.css';

const FEEDBACK_MIN_LENGTH = 10;
const FEEDBACK_MAX_LENGTH = 100;

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

function PrivacyBadge({ level }: { level: string }) {
  const label = level === 'PUBLIC' ? 'Public' : level === 'PROTECTED' ? 'Protected' : 'Private';
  return (
    <span className={`ed-privacy-badge ed-privacy-${level.toLowerCase()}`}>
      {label}
    </span>
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
}: {
  event: EventDetailResponse;
  joinLoading: boolean;
  joinError: string | null;
  leaveLoading: boolean;
  leaveError: string | null;
  onJoin: () => void;
  onLeave: () => void;
  onRequestJoin: (message?: string) => void;
  onDismissError: () => void;
  onDismissLeaveError: () => void;
  isAuthenticated: boolean;
}) {
  const [requestMessage, setRequestMessage] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const ctx = event.viewer_context;

  // Host doesn't see join actions
  if (ctx.is_host) return null;

  // Already participating states
  if (ctx.participation_status === 'JOINED') {
    const isCompletedOrCanceled = event.status === 'COMPLETED' || event.status === 'CANCELED';
    const joinedBannerClass = event.status === 'COMPLETED'
      ? 'ed-participation-attended'
      : 'ed-participation-joined';
    const joinedBannerText = event.status === 'COMPLETED'
      ? 'You attended this event'
      : 'You are participating in this event';

    return (
      <div className="ed-section">
        <div className={`ed-participation-banner ${joinedBannerClass}`}>
          {joinedBannerText}
        </div>
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
              onClick={() => {
                if (window.confirm('Are you sure you want to leave this event?')) {
                  onLeave();
                }
              }}
              disabled={leaveLoading}
            >
              {leaveLoading ? <span className="spinner" /> : 'Leave Event'}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (ctx.participation_status === 'PENDING') {
    return (
      <div className="ed-section">
        <div className="ed-participation-banner ed-participation-pending">
          Your join request is pending approval
        </div>
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
                Request to Join
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
              <div className="ed-request-actions">
                <button
                  type="button"
                  className="btn-primary ed-join-btn"
                  onClick={() => {
                    onRequestJoin(requestMessage.trim() || undefined);
                    setShowRequestForm(false);
                    setRequestMessage('');
                  }}
                  disabled={joinLoading}
                >
                  {joinLoading ? <span className="spinner" /> : 'Send Request'}
                </button>
                <button
                  type="button"
                  className="ed-request-cancel"
                  onClick={() => { setShowRequestForm(false); setRequestMessage(''); }}
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
    && event.viewer_context.participation_status === 'JOINED'
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
      <UserAvatar
        username={participant.user.username}
        displayName={participant.user.display_name}
        avatarUrl={participant.user.avatar_url}
        size="sm"
        variant="muted"
      />

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
          ) : (
            <span className="ed-participant-rating-empty">No host rating yet</span>
          )}
        </div>
      </div>

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
  favoriteLoading,
  onFavoriteToggle,
  isAuthenticated,
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
  coverImageUploading,
  coverImageError,
  coverImageSuccessMessage,
  onCoverImageFileSelected,
  onDismissCoverImageError,
  onDismissCoverImageSuccess,
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
  onRequestJoin: (message?: string) => void;
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
  favoriteLoading: boolean;
  onFavoriteToggle: () => void;
  isAuthenticated: boolean;
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
  coverImageUploading: boolean;
  coverImageError: string | null;
  coverImageSuccessMessage: string | null;
  onCoverImageFileSelected: (file: File) => void;
  onDismissCoverImageError: () => void;
  onDismissCoverImageSuccess: () => void;
}) {
  const navigate = useNavigate();
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
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
          <span className="ed-metric-value">{event.approved_participant_count}</span>
          <span className="ed-metric-label">Participant{event.approved_participant_count !== 1 ? 's' : ''}</span>
        </div>
        {event.viewer_context.is_host && (
          <div className="ed-metric">
            <span className="ed-metric-value">{event.pending_participant_count}</span>
            <span className="ed-metric-label">Pending</span>
          </div>
        )}
        <div className="ed-metric">
          <span className="ed-metric-value">{event.favorite_count}</span>
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
        leaveLoading={leaveLoading}
        leaveError={leaveError}
        onJoin={onJoin}
        onLeave={onLeave}
        onRequestJoin={onRequestJoin}
        onDismissError={onDismissError}
        onDismissLeaveError={onDismissLeaveError}
        isAuthenticated={isAuthenticated}
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

        {/* Location */}
        <div className="ed-section">
          <h2 className="ed-section-title">Location</h2>
          <div className="ed-info-row">
            <span className="ed-info-icon">&#128205;</span>
            <div>
              {event.location.address ? (
                <p className="ed-info-primary">{event.location.address}</p>
              ) : (
                <p className="ed-info-secondary">No address provided</p>
              )}
              <p className="ed-info-secondary">
                {event.location.type === 'ROUTE' ? 'Route-based event' : 'Point location'}
                {event.location.point && (
                  <> &middot; {event.location.point.lat.toFixed(4)}, {event.location.point.lon.toFixed(4)}</>
                )}
              </p>
            </div>
          </div>
        </div>

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
            <UserAvatar
              username={event.host.username}
              displayName={event.host.display_name}
              avatarUrl={event.host.avatar_url}
              size="md"
              variant="accent"
            />
            <div className="ed-host-info">
              <p className="ed-host-name">{event.host.display_name ?? event.host.username}</p>
              <p className="ed-host-username">@{event.host.username}</p>
            </div>
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

            {/* Invitations */}
            {(invitations.length > 0 || (hostContextSummary?.invitation_count ?? 0) > 0) && (
              <div className="ed-mgmt-group">
                <h3 className="ed-mgmt-title">
                  Invitations ({hostContextSummary?.invitation_count ?? invitations.length})
                </h3>
                {invitationsLoading && invitations.length === 0 ? (
                  <p className="ed-mgmt-empty">Loading invitations...</p>
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
              </div>
            )}
          </div>
        )}
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
      coverImageUploading={vm.coverImageUploading}
      coverImageError={vm.coverImageError}
      coverImageSuccessMessage={vm.coverImageSuccessMessage}
      onCoverImageFileSelected={vm.handleCoverImageUpload}
      onDismissCoverImageError={vm.dismissCoverImageError}
      onDismissCoverImageSuccess={vm.dismissCoverImageSuccess}
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
      favoriteLoading={vm.favoriteLoading}
      onFavoriteToggle={vm.handleFavoriteToggle}
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
    />
  );
}
