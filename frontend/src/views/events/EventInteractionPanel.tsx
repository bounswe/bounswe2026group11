import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserAvatar } from '@/components/UserAvatar';
import type { EventComment, EventDetailResponse } from '@/models/event';
import { useEventCommentsViewModel } from '@/viewmodels/event/useEventCommentsViewModel';
import i18n from '@/i18n';

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
  const diffSeconds = Math.round((then - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(i18n.resolvedLanguage, { numeric: 'auto' });
  if (Math.abs(diffSeconds) < 60) return rtf.format(diffSeconds, 'second');
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day');
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, 'month');
  return new Date(iso).toLocaleDateString(i18n.resolvedLanguage);
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
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value;
  return (
    <div className="ed-comments-stars-input" role="radiogroup" aria-label={t('interaction.select_star_rating')}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={t('interaction.star_rating_label', { count: star })}
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
  const { t } = useTranslation();
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
          {isHost && <span className="ed-comments-host-badge">{t('interaction.host_badge')}</span>}
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
  const { t } = useTranslation();
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
    ? t('interaction.hide_replies')
    : replyCount === 0
      ? t('interaction.show_replies')
      : t('interaction.view_replies', { count: replyCount });

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
            {repliesState?.loading && !expanded ? t('common.loading') : repliesToggleLabel}
          </button>
        )}
        <button
          type="button"
          className="ed-comments-link-btn"
          onClick={handleReplyClick}
          disabled={submittingThisReply}
        >
          {showReplyForm ? t('interaction.cancel_reply') : t('interaction.reply')}
        </button>
      </div>

      {expanded && (
        <ul className="ed-comments-replies">
          {replies.length === 0 && !repliesState?.loading && replyCount === 0 && (
            <li className="ed-comments-empty-inline">{t('interaction.no_replies')}</li>
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
                {repliesState.loading ? t('common.loading') : t('interaction.load_more_replies')}
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
            placeholder={t('interaction.write_reply_placeholder')}
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
                aria-label={t('notifications.dismiss_error')}
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
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="ed-comments-primary-btn"
                onClick={handleReplySubmit}
                disabled={submittingThisReply || replyText.trim().length === 0}
              >
                {submittingThisReply ? <span className="spinner" /> : t('interaction.post_reply')}
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
  const { t } = useTranslation();
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
            alt={t('interaction.selected_memory_preview')}
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
  const { t } = useTranslation();
  const [composerText, setComposerText] = useState('');

  const writesAllowed = (() => {
    if (!isAuthenticated) return false;
    if (event.privacy_level === 'PRIVATE') return false;
    if (event.status === 'ACTIVE') return true;
    if (event.status === 'IN_PROGRESS') {
      return event.viewer_context.is_host || event.viewer_context.participation_status === 'JOINED';
    }
    return false;
  })();

  const composerDisabledReason = (() => {
    if (event.privacy_level === 'PRIVATE') return t('interaction.discussion_private_unavailable');
    if (event.status === 'COMPLETED')
      return t('interaction.discussion_completed_readonly');
    if (event.status === 'CANCELED') return t('interaction.discussion_canceled_closed');
    if (event.status === 'IN_PROGRESS' && !writesAllowed)
      return t('interaction.discussion_in_progress_restricted');
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
                ? t('interaction.discussion_placeholder_live')
                : t('interaction.discussion_placeholder_default')
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
                aria-label={t('notifications.dismiss_error')}
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
              {vm.discussionSubmitLoading ? <span className="spinner" /> : t('interaction.post')}
            </button>
          </div>
        </div>
      ) : !isAuthenticated ? (
        <div className="ed-comments-callout">
          <span>{t('interaction.sign_in_discussion')}</span>
          <Link to="/login" className="ed-comments-link">
            {t('shell.sign_in')}
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
          <p>{t('interaction.loading_discussion')}</p>
        </div>
      ) : vm.status === 'error' ? (
        <div className="ed-comments-state ed-comments-state-error">
          <p>{vm.errorMessage ?? t('interaction.failed_discussion')}</p>
          <button type="button" className="ed-comments-secondary-btn" onClick={vm.retry}>
            {t('event_detail.try_again')}
          </button>
        </div>
      ) : vm.discussionComments.length === 0 ? (
        <div className="ed-comments-empty">
          <p>{t('interaction.empty_discussion')}</p>
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
              {vm.discussionLoadingMore ? t('common.loading') : t('interaction.load_more_comments')}
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
  const { t } = useTranslation();
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
    && event.viewer_context.participation_status === 'JOINED'
    && event.status === 'COMPLETED'
    && event.privacy_level !== 'PRIVATE';

  const validateAndSetImage = (file: File | null) => {
    setImageError(null);
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError(t('interaction.image_type_error'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(t('interaction.image_size_error'));
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
          <span>{t('interaction.sign_in_review')}</span>
          <Link to="/login" className="ed-comments-link">
            {t('shell.sign_in')}
          </Link>
        </div>
      ) : !isVerifiedAttendee ? (
        <div className="ed-comments-callout ed-comments-callout-muted">
          <span>
            {t('interaction.verified_attendee_only')}
          </span>
        </div>
      ) : (
        <div className="ed-comments-composer ed-comments-review-composer">
          <h3 className="ed-comments-composer-title">{t('interaction.share_experience')}</h3>
          <div className="ed-comments-review-rating-row">
            <ReviewStarsInput
              value={rating}
              onChange={setRating}
              disabled={vm.reviewSubmitLoading}
            />
            <span
              className={`ed-comments-review-rating-summary ${rating > 0 ? 'is-selected' : ''}`}
            >
              {rating > 0 ? `${rating}/5` : t('interaction.tap_to_rate')}
            </span>
          </div>
          <textarea
            className="ed-comments-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('interaction.review_placeholder')}
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
                  alt={t('interaction.selected_memory_preview')}
                  className="ed-comments-image-preview-img"
                />
                <div className="ed-comments-image-preview-actions">
                  <button
                    type="button"
                    className="ed-comments-secondary-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={vm.reviewSubmitLoading}
                  >
                    {t('interaction.replace_image')}
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
                    {t('common.remove')}
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
                  <strong>{t('interaction.add_memory')}</strong>
                  <span>{t('interaction.add_memory_body')}</span>
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
                aria-label={t('notifications.dismiss_error')}
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
                aria-label={t('notifications.dismiss_error')}
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
                aria-label={t('common.close')}
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
              {vm.reviewSubmitLoading ? <span className="spinner" /> : t('interaction.submit_review')}
            </button>
          </div>
        </div>
      )}

      {vm.status === 'loading' ? (
        <div className="ed-comments-state">
          <span className="spinner" />
          <p>{t('interaction.loading_reviews')}</p>
        </div>
      ) : vm.status === 'error' ? (
        <div className="ed-comments-state ed-comments-state-error">
          <p>{vm.errorMessage ?? t('interaction.failed_reviews')}</p>
          <button type="button" className="ed-comments-secondary-btn" onClick={vm.retry}>
            {t('event_detail.try_again')}
          </button>
        </div>
      ) : vm.reviewComments.length === 0 ? (
        <div className="ed-comments-empty">
          <p>{t('interaction.empty_reviews')}</p>
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
              {vm.reviewLoadingMore ? t('common.loading') : t('interaction.load_more_reviews')}
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
  const { t } = useTranslation();
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
    <section className="ed-section ed-comments-section" aria-label={t('interaction.event_interaction')}>
      <div className="ed-comments-header">
        <h2 className="ed-section-title ed-comments-title">{t('interaction.community')}</h2>
        {showTabs ? (
          <div className="ed-comments-tabs" role="tablist" aria-label={t('interaction.discussion_or_review')}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'DISCUSSION'}
              className={`ed-comments-tab ${activeTab === 'DISCUSSION' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('DISCUSSION')}
              data-testid="ed-tab-discussion"
            >
              {t('interaction.discussion')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'REVIEW'}
              className={`ed-comments-tab ${activeTab === 'REVIEW' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('REVIEW')}
              data-testid="ed-tab-review"
            >
              {t('interaction.reviews')}
            </button>
          </div>
        ) : (
          <span className="ed-comments-single-tab-label">
            {discussionVisible ? t('interaction.discussion') : t('interaction.reviews')}
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
