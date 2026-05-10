import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { UserAvatar } from '@/components/UserAvatar';
import { isActiveEventParticipantStatus, type EventComment, type EventDetailResponse } from '@/models/event';
import { useEventCommentsViewModel } from '@/viewmodels/event/useEventCommentsViewModel';

const COMMENT_MAX_LENGTH = 1000;
const REVIEW_MIN_LENGTH = 1;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type InteractionTab = 'DISCUSSION' | 'REVIEW';

export interface EventInteractionPanelProps {
  event: EventDetailResponse;
  token: string | null;
  isAuthenticated: boolean;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(1, Math.floor((now - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return new Date(iso).toLocaleDateString();
}

function getDisplayName(user: { display_name: string | null; username: string }): string {
  return user.display_name ?? user.username;
}

function renderStarsInline(rating: number): string {
  const full = Math.max(0, Math.min(5, rating));
  return `${'★'.repeat(full)}${'☆'.repeat(5 - full)}`;
}

interface ReviewStarsInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function ReviewStarsInput({ value, onChange, disabled }: ReviewStarsInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value;
  return (
    <div className="ed-comments-stars-input" role="radiogroup" aria-label="Select a star rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          className={`ed-comments-star-btn ${active >= star ? 'is-active' : ''}`}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(star)}
          onBlur={() => setHovered(null)}
          disabled={disabled}
        >
          <span aria-hidden="true">★</span>
        </button>
      ))}
    </div>
  );
}

interface CommentItemProps {
  comment: EventComment;
  hostUserId: string;
  variant: 'top-level' | 'reply';
}

function CommentAuthorBlock({ comment, hostUserId, variant }: CommentItemProps) {
  const isHost = comment.user.id === hostUserId;
  return (
    <div className="ed-comments-item-header">
      <UserAvatar
        username={comment.user.username}
        displayName={comment.user.display_name}
        avatarUrl={comment.user.avatar_url}
        size={variant === 'reply' ? 'sm' : 'sm'}
        variant={isHost ? 'accent' : 'muted'}
      />
      <div className="ed-comments-item-author">
        <div className="ed-comments-item-author-line">
          <span className="ed-comments-item-name">{getDisplayName(comment.user)}</span>
          {isHost && <span className="ed-comments-host-badge">Host</span>}
        </div>
        <span className="ed-comments-item-meta">
          @{comment.user.username} · {timeAgo(comment.created_at)}
        </span>
      </div>
    </div>
  );
}

interface DiscussionCommentNodeProps {
  comment: EventComment;
  hostUserId: string;
  vm: ReturnType<typeof useEventCommentsViewModel>;
  canReply: boolean;
  onRequireSignIn: () => void;
}

function DiscussionCommentNode({
  comment,
  hostUserId,
  vm,
  canReply,
  onRequireSignIn,
}: DiscussionCommentNodeProps) {
  const repliesState = vm.repliesByCommentId[comment.id];
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');

  const submittingThisReply =
    vm.replySubmitState.parentId === comment.id && vm.replySubmitState.loading;
  const replyError =
    vm.replySubmitState.parentId === comment.id ? vm.replySubmitState.error : null;

  const replies = repliesState?.items ?? [];
  const expanded = repliesState?.expanded ?? false;
  const replyCount = comment.reply_count;

  const handleReplyClick = () => {
    if (!canReply) {
      onRequireSignIn();
      return;
    }
    setShowReplyForm((prev) => !prev);
  };

  const handleReplySubmit = async () => {
    const success = await vm.submitReply(comment.id, replyText);
    if (success) {
      setReplyText('');
      setShowReplyForm(false);
    }
  };

  const repliesToggleLabel = expanded
    ? 'Hide replies'
    : replyCount === 0
      ? 'Show replies'
      : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;

  return (
    <li className="ed-comments-item ed-comments-item-top">
      <CommentAuthorBlock comment={comment} hostUserId={hostUserId} variant="top-level" />
      <p className="ed-comments-item-message">{comment.message}</p>

      <div className="ed-comments-item-actions">
        {(replyCount > 0 || expanded) && (
          <button
            type="button"
            className="ed-comments-link-btn"
            onClick={() => vm.toggleReplies(comment)}
            disabled={repliesState?.loading}
          >
            {repliesState?.loading && !expanded ? 'Loading…' : repliesToggleLabel}
          </button>
        )}
        <button
          type="button"
          className="ed-comments-link-btn"
          onClick={handleReplyClick}
          disabled={submittingThisReply}
        >
          {showReplyForm ? 'Cancel reply' : 'Reply'}
        </button>
      </div>

      {expanded && (
        <ul className="ed-comments-replies">
          {replies.length === 0 && !repliesState?.loading && replyCount === 0 && (
            <li className="ed-comments-empty-inline">No replies yet.</li>
          )}
          {replies.map((reply) => (
            <li key={reply.id} className="ed-comments-item ed-comments-item-reply">
              <CommentAuthorBlock comment={reply} hostUserId={hostUserId} variant="reply" />
              <p className="ed-comments-item-message">{reply.message}</p>
            </li>
          ))}
          {repliesState?.error && (
            <li className="ed-comments-error" role="alert">
              {repliesState.error}
            </li>
          )}
          {repliesState?.hasNext && (
            <li>
              <button
                type="button"
                className="ed-comments-link-btn"
                onClick={() => vm.loadMoreReplies(comment.id)}
                disabled={repliesState.loading}
              >
                {repliesState.loading ? 'Loading…' : 'Load more replies'}
              </button>
            </li>
          )}
        </ul>
      )}

      {showReplyForm && canReply && (
        <div className="ed-comments-reply-form">
          <textarea
            className="ed-comments-textarea"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            rows={2}
            maxLength={COMMENT_MAX_LENGTH}
            disabled={submittingThisReply}
          />
          {replyError && (
            <div className="ed-comments-error" role="alert">
              <span>{replyError}</span>
              <button
                type="button"
                className="ed-comments-error-dismiss"
                onClick={() => vm.dismissReplySubmitError()}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}
          <div className="ed-comments-form-actions">
            <span className="ed-comments-char-count">
              {replyText.trim().length}/{COMMENT_MAX_LENGTH}
            </span>
            <div className="ed-comments-form-buttons">
              <button
                type="button"
                className="ed-comments-secondary-btn"
                onClick={() => {
                  setReplyText('');
                  setShowReplyForm(false);
                }}
                disabled={submittingThisReply}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ed-comments-primary-btn"
                onClick={handleReplySubmit}
                disabled={submittingThisReply || replyText.trim().length === 0}
              >
                {submittingThisReply ? <span className="spinner" /> : 'Post reply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

interface ReviewItemProps {
  comment: EventComment;
  hostUserId: string;
}

function ReviewItem({ comment, hostUserId }: ReviewItemProps) {
  return (
    <li className="ed-comments-item ed-comments-item-review">
      <CommentAuthorBlock comment={comment} hostUserId={hostUserId} variant="top-level" />
      {comment.rating != null && (
        <div className="ed-comments-review-rating">
          <span className="ed-comments-review-stars" aria-hidden="true">
            {renderStarsInline(comment.rating)}
          </span>
          <span className="ed-comments-review-rating-text">
            {comment.rating}/5
          </span>
        </div>
      )}
      <p className="ed-comments-item-message">{comment.message}</p>
      {comment.image_url && (
        <a
          href={comment.image_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ed-comments-review-image-link"
        >
          <img
            src={comment.image_url}
            alt={`Memory shared by ${getDisplayName(comment.user)}`}
            className="ed-comments-review-image"
            loading="lazy"
          />
        </a>
      )}
    </li>
  );
}

interface DiscussionSectionProps {
  event: EventDetailResponse;
  vm: ReturnType<typeof useEventCommentsViewModel>;
  isAuthenticated: boolean;
}

function DiscussionSection({ event, vm, isAuthenticated }: DiscussionSectionProps) {
  const [composerText, setComposerText] = useState('');

  const writesAllowed = (() => {
    if (!isAuthenticated) return false;
    if (event.privacy_level === 'PRIVATE') return false;
    if (event.status === 'ACTIVE') return true;
    if (event.status === 'IN_PROGRESS') {
      return event.viewer_context.is_host
        || isActiveEventParticipantStatus(event.viewer_context.participation_status);
    }
    return false;
  })();

  const composerDisabledReason = (() => {
    if (event.privacy_level === 'PRIVATE') return 'Discussion is unavailable for private events.';
    if (event.status === 'COMPLETED')
      return 'This event has ended. Past discussion is read-only — share your experience in the Review tab.';
    if (event.status === 'CANCELED') return 'This event was canceled. Discussion is closed.';
    if (event.status === 'IN_PROGRESS' && !writesAllowed)
      return 'Only the host and joined participants can post during the event.';
    if (!isAuthenticated) return null;
    return null;
  })();

  const handleSubmit = async () => {
    const success = await vm.submitDiscussion(composerText);
    if (success) setComposerText('');
  };

  const composerCount = composerText.trim().length;

  return (
    <div className="ed-comments-tab-content" data-testid="ed-discussion-section">
      {/* Composer */}
      {writesAllowed ? (
        <div className="ed-comments-composer">
          <textarea
            className="ed-comments-textarea"
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder={
              event.status === 'IN_PROGRESS'
                ? 'Share an update from the event…'
                : 'Ask a question or share something with attendees…'
            }
            rows={3}
            maxLength={COMMENT_MAX_LENGTH}
            disabled={vm.discussionSubmitLoading}
            data-testid="ed-discussion-composer"
          />
          {vm.discussionSubmitError && (
            <div className="ed-comments-error" role="alert">
              <span>{vm.discussionSubmitError}</span>
              <button
                type="button"
                className="ed-comments-error-dismiss"
                onClick={vm.dismissDiscussionSubmitError}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}
          <div className="ed-comments-form-actions">
            <span className="ed-comments-char-count">
              {composerCount}/{COMMENT_MAX_LENGTH}
            </span>
            <button
              type="button"
              className="ed-comments-primary-btn"
              onClick={handleSubmit}
              disabled={vm.discussionSubmitLoading || composerCount === 0}
              data-testid="ed-discussion-submit"
            >
              {vm.discussionSubmitLoading ? <span className="spinner" /> : 'Post'}
            </button>
          </div>
        </div>
      ) : !isAuthenticated ? (
        <div className="ed-comments-callout">
          <span>Sign in to join the discussion.</span>
          <Link to="/login" className="ed-comments-link">
            Sign in
          </Link>
        </div>
      ) : composerDisabledReason ? (
        <div className="ed-comments-callout ed-comments-callout-muted">
          <span>{composerDisabledReason}</span>
        </div>
      ) : null}

      {/* List */}
      {vm.status === 'loading' ? (
        <div className="ed-comments-state">
          <span className="spinner" />
          <p>Loading discussion…</p>
        </div>
      ) : vm.status === 'error' ? (
        <div className="ed-comments-state ed-comments-state-error">
          <p>{vm.errorMessage ?? 'Failed to load discussion.'}</p>
          <button type="button" className="ed-comments-secondary-btn" onClick={vm.retry}>
            Try again
          </button>
        </div>
      ) : vm.discussionComments.length === 0 ? (
        <div className="ed-comments-empty">
          <p>No comments yet. Start the conversation!</p>
        </div>
      ) : (
        <>
          <ul className="ed-comments-list">
            {vm.discussionComments.map((comment) => (
              <DiscussionCommentNode
                key={comment.id}
                comment={comment}
                hostUserId={event.host.id}
                vm={vm}
                canReply={writesAllowed}
                onRequireSignIn={() => {
                  // The composer above already nudges sign-in; nothing to do here.
                }}
              />
            ))}
          </ul>
          {vm.discussionHasNext && (
            <button
              type="button"
              className="ed-comments-secondary-btn ed-comments-load-more"
              onClick={vm.loadMoreDiscussion}
              disabled={vm.discussionLoadingMore}
            >
              {vm.discussionLoadingMore ? 'Loading…' : 'Load more comments'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

interface ReviewSectionProps {
  event: EventDetailResponse;
  vm: ReturnType<typeof useEventCommentsViewModel>;
  isAuthenticated: boolean;
}

function ReviewSection({ event, vm, isAuthenticated }: ReviewSectionProps) {
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const isVerifiedAttendee =
    !event.viewer_context.is_host
    && isActiveEventParticipantStatus(event.viewer_context.participation_status)
    && event.status === 'COMPLETED'
    && event.privacy_level !== 'PRIVATE';

  const validateAndSetImage = (file: File | null) => {
    setImageError(null);
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image must be 8MB or smaller.');
      return;
    }
    setImageFile(file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    validateAndSetImage(file);
    event.target.value = '';
  };

  const handleSubmit = async () => {
    const success = await vm.submitReview(rating, message, imageFile);
    if (success) {
      setMessage('');
      setRating(0);
      setImageFile(null);
    }
  };

  const composerCount = message.trim().length;
  const submitDisabled =
    vm.reviewSubmitLoading || rating < 1 || composerCount < REVIEW_MIN_LENGTH;

  return (
    <div className="ed-comments-tab-content" data-testid="ed-review-section">
      {!isAuthenticated ? (
        <div className="ed-comments-callout">
          <span>Sign in to leave a review for this event.</span>
          <Link to="/login" className="ed-comments-link">
            Sign in
          </Link>
        </div>
      ) : !isVerifiedAttendee ? (
        <div className="ed-comments-callout ed-comments-callout-muted">
          <span>
            Only verified attendees of this event can leave a review and share memories.
          </span>
        </div>
      ) : (
        <div className="ed-comments-composer ed-comments-review-composer">
          <h3 className="ed-comments-composer-title">Share your experience</h3>
          <div className="ed-comments-review-rating-row">
            <ReviewStarsInput
              value={rating}
              onChange={setRating}
              disabled={vm.reviewSubmitLoading}
            />
            <span
              className={`ed-comments-review-rating-summary ${rating > 0 ? 'is-selected' : ''}`}
            >
              {rating > 0 ? `${rating}/5` : 'Tap to rate'}
            </span>
          </div>
          <textarea
            className="ed-comments-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What was memorable about this event?"
            rows={4}
            maxLength={COMMENT_MAX_LENGTH}
            disabled={vm.reviewSubmitLoading}
            data-testid="ed-review-message"
          />

          {/* Image upload area */}
          <div
            className={`ed-comments-image-drop ${isDragging ? 'is-dragging' : ''} ${imagePreviewUrl ? 'has-image' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0] ?? null;
              validateAndSetImage(file);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(',')}
              className="ed-comments-image-input"
              onChange={handleFileChange}
              disabled={vm.reviewSubmitLoading}
            />
            {imagePreviewUrl ? (
              <div className="ed-comments-image-preview">
                <img
                  src={imagePreviewUrl}
                  alt="Selected memory preview"
                  className="ed-comments-image-preview-img"
                />
                <div className="ed-comments-image-preview-actions">
                  <button
                    type="button"
                    className="ed-comments-secondary-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={vm.reviewSubmitLoading}
                  >
                    Replace image
                  </button>
                  <button
                    type="button"
                    className="ed-comments-secondary-btn ed-comments-image-remove"
                    onClick={() => {
                      setImageFile(null);
                      setImageError(null);
                    }}
                    disabled={vm.reviewSubmitLoading}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="ed-comments-image-drop-trigger"
                onClick={() => fileInputRef.current?.click()}
                disabled={vm.reviewSubmitLoading}
              >
                <span className="ed-comments-image-drop-icon" aria-hidden="true">
                  📷
                </span>
                <span className="ed-comments-image-drop-text">
                  <strong>Add a memory</strong>
                  <span>Click to upload or drag &amp; drop a photo (optional)</span>
                </span>
              </button>
            )}
          </div>

          {imageError && (
            <div className="ed-comments-error" role="alert">
              <span>{imageError}</span>
              <button
                type="button"
                className="ed-comments-error-dismiss"
                onClick={() => setImageError(null)}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {vm.reviewSubmitError && (
            <div className="ed-comments-error" role="alert">
              <span>{vm.reviewSubmitError}</span>
              <button
                type="button"
                className="ed-comments-error-dismiss"
                onClick={vm.dismissReviewSubmitError}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {vm.reviewSubmitSuccess && (
            <div className="ed-comments-success" role="status">
              <span>{vm.reviewSubmitSuccess}</span>
              <button
                type="button"
                className="ed-comments-error-dismiss"
                onClick={vm.dismissReviewSubmitSuccess}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          <div className="ed-comments-form-actions">
            <span className="ed-comments-char-count">
              {composerCount}/{COMMENT_MAX_LENGTH}
            </span>
            <button
              type="button"
              className="ed-comments-primary-btn"
              onClick={handleSubmit}
              disabled={submitDisabled}
              data-testid="ed-review-submit"
            >
              {vm.reviewSubmitLoading ? <span className="spinner" /> : 'Submit review'}
            </button>
          </div>
        </div>
      )}

      {vm.status === 'loading' ? (
        <div className="ed-comments-state">
          <span className="spinner" />
          <p>Loading reviews…</p>
        </div>
      ) : vm.status === 'error' ? (
        <div className="ed-comments-state ed-comments-state-error">
          <p>{vm.errorMessage ?? 'Failed to load reviews.'}</p>
          <button type="button" className="ed-comments-secondary-btn" onClick={vm.retry}>
            Try again
          </button>
        </div>
      ) : vm.reviewComments.length === 0 ? (
        <div className="ed-comments-empty">
          <p>No reviews yet. Be the first to share your experience.</p>
        </div>
      ) : (
        <>
          <ul className="ed-comments-list">
            {vm.reviewComments.map((comment) => (
              <ReviewItem key={comment.id} comment={comment} hostUserId={event.host.id} />
            ))}
          </ul>
          {vm.reviewHasNext && (
            <button
              type="button"
              className="ed-comments-secondary-btn ed-comments-load-more"
              onClick={vm.loadMoreReviews}
              disabled={vm.reviewLoadingMore}
            >
              {vm.reviewLoadingMore ? 'Loading…' : 'Load more reviews'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function EventInteractionPanel({
  event,
  token,
  isAuthenticated,
}: EventInteractionPanelProps) {
  const vm = useEventCommentsViewModel(event.id, token);

  // Discussion appears for ACTIVE/IN_PROGRESS/COMPLETED. Hide entire panel for CANCELED or PRIVATE.
  const panelHidden = event.privacy_level === 'PRIVATE' || event.status === 'CANCELED';

  const reviewVisible = event.status === 'COMPLETED';
  const discussionVisible = event.status !== 'CANCELED';

  const defaultTab: InteractionTab = useMemo(() => {
    if (reviewVisible) return 'REVIEW';
    return 'DISCUSSION';
  }, [reviewVisible]);

  const [activeTab, setActiveTab] = useState<InteractionTab>(defaultTab);

  // If status changes (rare in this view), align selected tab with new default.
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  if (panelHidden) return null;
  if (vm.status === 'unavailable') return null;

  const showTabs = discussionVisible && reviewVisible;

  return (
    <section className="ed-section ed-comments-section" aria-label="Event interaction">
      <div className="ed-comments-header">
        <h2 className="ed-section-title ed-comments-title">Community</h2>
        {showTabs ? (
          <div className="ed-comments-tabs" role="tablist" aria-label="Discussion or review">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'DISCUSSION'}
              className={`ed-comments-tab ${activeTab === 'DISCUSSION' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('DISCUSSION')}
              data-testid="ed-tab-discussion"
            >
              Discussion
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'REVIEW'}
              className={`ed-comments-tab ${activeTab === 'REVIEW' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('REVIEW')}
              data-testid="ed-tab-review"
            >
              Reviews
            </button>
          </div>
        ) : (
          <span className="ed-comments-single-tab-label">
            {discussionVisible ? 'Discussion' : 'Reviews'}
          </span>
        )}
      </div>

      {showTabs ? (
        activeTab === 'REVIEW' ? (
          <ReviewSection event={event} vm={vm} isAuthenticated={isAuthenticated} />
        ) : (
          <DiscussionSection event={event} vm={vm} isAuthenticated={isAuthenticated} />
        )
      ) : discussionVisible ? (
        <DiscussionSection event={event} vm={vm} isAuthenticated={isAuthenticated} />
      ) : (
        <ReviewSection event={event} vm={vm} isAuthenticated={isAuthenticated} />
      )}
    </section>
  );
}
