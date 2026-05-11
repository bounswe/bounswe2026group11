import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { EventComment } from '@/models/comment';
import { EventDiscussionViewModel } from '@/viewmodels/event/useEventDiscussionViewModel';
import { useTranslation } from 'react-i18next';

interface Props {
  vm: EventDiscussionViewModel;
  eventStatus: string;
  isAuthenticated: boolean;
  canPostDiscussion: boolean;
  canPostReview: boolean;
  hasExistingReview: boolean;
  reviewWindowClosed?: boolean;
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function renderStars(rating: number): string {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(r)}${'☆'.repeat(5 - r)}`;
}

function StarRatingInput({
  value,
  onChange,
  disabled,
  styles,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onChange(star)}
          disabled={disabled}
          activeOpacity={0.75}
          style={styles.starBtn}
        >
          <Text style={[styles.starIcon, star <= value && styles.starIconActive]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CommentAvatar({
  avatarUrl,
  size,
  styles,
}: {
  avatarUrl?: string | null;
  size: number;
  styles: ReturnType<typeof makeStyles>;
}) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Feather name="user" size={size * 0.45} color="#94A3B8" />
    </View>
  );
}

function DiscussionCommentItem({
  comment,
  vm,
  styles,
  isAuthenticated,
  canPost,
}: {
  comment: EventComment;
  vm: EventDiscussionViewModel;
  styles: ReturnType<typeof makeStyles>;
  isAuthenticated: boolean;
  canPost: boolean;
}) {
  const { t } = useTranslation();
  const replies = vm.repliesMap[comment.id];
  const isReplying = vm.replyingToId === comment.id;
  const [isExpanded, setIsExpanded] = React.useState(false);
  const showReplies = isExpanded && Boolean(replies);
  const replyCount = replies ? replies.items.length : comment.reply_count;
  const replyCountLabel = `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;

  const handleToggleReplies = () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }
    setIsExpanded(true);
    if (!replies) {
      void vm.loadReplies(comment.id);
    }
  };

  return (
    <View style={styles.commentCard}>
      <View style={styles.commentHeader}>
        <CommentAvatar avatarUrl={comment.user.avatar_url} size={36} styles={styles} />
        <View style={styles.commentMeta}>
          <Text style={styles.commentDisplayName}>
            {comment.user.display_name ?? comment.user.username}
          </Text>
          <Text style={styles.commentTimestamp}>{formatRelativeTime(comment.created_at)}</Text>
        </View>
      </View>

      <Text style={styles.commentMessage}>{comment.message}</Text>

      <View style={styles.commentActions}>
        {replyCount > 0 && (
          <TouchableOpacity
            onPress={handleToggleReplies}
            style={styles.replyToggle}
            testID={`reply-toggle-${comment.id}`}
          >
            <Feather
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={13}
              color="#6366F1"
            />
            <Text style={styles.replyToggleText}>
              {isExpanded
                ? t('events.discussion.hideReplies', { label: replyCountLabel })
                : t('events.discussion.viewReplies', { label: replyCountLabel })}
            </Text>
          </TouchableOpacity>
        )}
        {isAuthenticated && canPost && !isReplying && (
          <TouchableOpacity
            onPress={() => {
              vm.setReplyingToId(comment.id);
              vm.setReplyMessage('');
            }}
            style={styles.replyBtn}
          >
            <Feather name="corner-down-right" size={13} color="#94A3B8" />
            <Text style={styles.replyBtnText}>{t('events.discussion.reply')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isReplying && (
        <View style={styles.replyInputContainer}>
          <TextInput
            style={styles.replyInput}
            placeholder={t('events.discussion.replyPlaceholder')}
            placeholderTextColor="#94A3B8"
            value={vm.replyMessage}
            onChangeText={vm.setReplyMessage}
            multiline
            maxLength={1000}
            editable={!vm.discussionSubmitting}
          />
          <View style={styles.replyInputActions}>
            <TouchableOpacity
              onPress={() => {
                vm.setReplyingToId(null);
                vm.setReplyMessage('');
              }}
              style={styles.replyCancelBtn}
              disabled={vm.discussionSubmitting}
            >
              <Text style={styles.replyCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void vm.submitReply(comment.id)}
              style={[
                styles.replySubmitBtn,
                (!vm.replyMessage.trim() || vm.discussionSubmitting) && styles.submitBtnDisabled,
              ]}
              disabled={!vm.replyMessage.trim() || vm.discussionSubmitting}
            >
              {vm.discussionSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.replySubmitText}>{t('common.post')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showReplies && (
        <View style={styles.repliesContainer}>
          {replies.loading && replies.items.length === 0 ? (
            <ActivityIndicator size="small" color="#6366F1" style={{ marginTop: 8 }} />
          ) : (
            replies.items.map((reply) => (
              <View key={reply.id} style={styles.replyCard}>
                <View style={styles.commentHeader}>
                  <CommentAvatar avatarUrl={reply.user.avatar_url} size={28} styles={styles} />
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentDisplayName}>
                      {reply.user.display_name ?? reply.user.username}
                    </Text>
                    <Text style={styles.commentTimestamp}>
                      {formatRelativeTime(reply.created_at)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.commentMessage}>{reply.message}</Text>
              </View>
            ))
          )}
          {replies.hasNext && (
            <TouchableOpacity
              onPress={() => void vm.loadMoreReplies(comment.id)}
              style={styles.loadMoreBtn}
              disabled={replies.loading}
            >
              {replies.loading ? (
                <ActivityIndicator size="small" color="#6366F1" />
              ) : (
                <Text style={styles.loadMoreText}>Load more replies</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function ReviewCommentItem({
  comment,
  styles,
}: {
  comment: EventComment;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.commentCard}>
      <View style={styles.commentHeader}>
        <CommentAvatar avatarUrl={comment.user.avatar_url} size={36} styles={styles} />
        <View style={styles.commentMeta}>
          <Text style={styles.commentDisplayName}>
            {comment.user.display_name ?? comment.user.username}
          </Text>
          <Text style={styles.commentTimestamp}>{formatRelativeTime(comment.created_at)}</Text>
        </View>
        {comment.rating != null && (
          <Text style={styles.reviewStars}>{renderStars(comment.rating)}</Text>
        )}
      </View>
      <Text style={styles.commentMessage}>{comment.message}</Text>
      {comment.image_url && (
        <Image source={{ uri: comment.image_url }} style={styles.reviewImage} resizeMode="cover" />
      )}
    </View>
  );
}

export default function EventDiscussionSection({
  vm,
  eventStatus,
  isAuthenticated,
  canPostDiscussion,
  canPostReview,
  hasExistingReview,
  reviewWindowClosed = false,
}: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [activeTab, setActiveTab] = React.useState<'qa' | 'reviews'>('qa');

  const isCompleted = eventStatus === 'COMPLETED';

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'qa' && styles.tabActive]}
          onPress={() => setActiveTab('qa')}
        >
          <Text style={[styles.tabText, activeTab === 'qa' && styles.tabTextActive]}>
            {t('events.detail.qaLabel', { count: vm.discussions.items.length })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
          onPress={() => setActiveTab('reviews')}
        >
          <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
            {t('events.detail.reviewsLabel', { count: vm.reviews.items.length })}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'qa' && (
        <View>
          {canPostDiscussion && (
            <View style={styles.inputCard}>
              <TextInput
                style={styles.messageInput}
                placeholder={t('events.discussion.askPlaceholder')}
                placeholderTextColor="#94A3B8"
                value={vm.newDiscussionMessage}
                onChangeText={vm.setNewDiscussionMessage}
                multiline
                maxLength={1000}
                editable={!vm.discussionSubmitting}
              />
              <View style={styles.inputFooter}>
                <Text style={styles.charCount}>{vm.newDiscussionMessage.length}/1000</Text>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (!vm.newDiscussionMessage.trim() || vm.discussionSubmitting) &&
                      styles.submitBtnDisabled,
                  ]}
                  onPress={() => void vm.submitDiscussionComment()}
                  disabled={!vm.newDiscussionMessage.trim() || vm.discussionSubmitting}
                >
                  {vm.discussionSubmitting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.submitBtnText}>{t('common.post')}</Text>
                  )}
                </TouchableOpacity>
              </View>
              {vm.discussionError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{vm.discussionError}</Text>
                  <TouchableOpacity onPress={vm.dismissDiscussionError}>
                    <Feather name="x" size={14} color={theme.errorText} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {!isAuthenticated && (
            <View style={styles.authNotice}>
              <Feather name="lock" size={14} color="#94A3B8" />
              <Text style={styles.authNoticeText}>{t('events.discussion.signInToJoin')}</Text>
            </View>
          )}

          {isCompleted && (
            <View style={styles.closedNotice}>
              <Feather name="info" size={14} color={theme.warningText} />
              <Text style={styles.closedNoticeText}>
                {t('events.discussion.closedQa')}
              </Text>
            </View>
          )}

          {vm.discussions.loading && vm.discussions.items.length === 0 ? (
            <ActivityIndicator size="small" color={theme.primary} style={styles.loadingSpinner} />
          ) : vm.discussions.items.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="message-circle" size={32} color="#CBD5E1" />
              <Text style={styles.emptyStateText}>{t('events.discussion.emptyQuestions')}</Text>
            </View>
          ) : (
            vm.discussions.items.map((comment) => (
              <DiscussionCommentItem
                key={comment.id}
                comment={comment}
                vm={vm}
                styles={styles}
                isAuthenticated={isAuthenticated}
                canPost={canPostDiscussion}
              />
            ))
          )}

          {vm.discussions.hasNext && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => void vm.loadMoreDiscussions()}
              disabled={vm.discussions.loading}
            >
              {vm.discussions.loading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={styles.loadMoreText}>{t('events.discussion.loadMoreQuestions')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {activeTab === 'reviews' && (
        <View>
          {canPostReview && (
            <View style={styles.inputCard}>
              <Text style={styles.reviewInputLabel}>
                {hasExistingReview
                  ? t('events.discussion.updateReview')
                  : t('events.discussion.leaveReview')}
              </Text>
              <StarRatingInput
                value={vm.newReviewRating}
                onChange={vm.setNewReviewRating}
                disabled={vm.reviewSubmitting}
                styles={styles}
              />
              <TextInput
                style={styles.messageInput}
                placeholder={t('events.discussion.reviewPlaceholder')}
                placeholderTextColor="#94A3B8"
                value={vm.newReviewMessage}
                onChangeText={vm.setNewReviewMessage}
                multiline
                maxLength={1000}
                editable={!vm.reviewSubmitting}
              />
              <View style={styles.inputFooter}>
                <Text style={styles.charCount}>{vm.newReviewMessage.length}/1000</Text>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (!vm.newReviewMessage.trim() || vm.newReviewRating < 1 || vm.reviewSubmitting) &&
                      styles.submitBtnDisabled,
                  ]}
                  onPress={() => void vm.submitReview()}
                  disabled={
                    !vm.newReviewMessage.trim() || vm.newReviewRating < 1 || vm.reviewSubmitting
                  }
                >
                  {vm.reviewSubmitting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {hasExistingReview ? t('common.update') : t('common.submit')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              {vm.reviewError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{vm.reviewError}</Text>
                  <TouchableOpacity onPress={vm.dismissReviewError}>
                    <Feather name="x" size={14} color={theme.errorText} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {!isAuthenticated && (
            <View style={styles.authNotice}>
              <Feather name="lock" size={14} color="#94A3B8" />
              <Text style={styles.authNoticeText}>{t('events.discussion.signInToReview')}</Text>
            </View>
          )}

          {isAuthenticated && reviewWindowClosed && (
            <View style={styles.closedNotice}>
              <Feather name="clock" size={14} color={theme.warningText} />
              <Text style={styles.closedNoticeText}>
                {t('events.discussion.reviewsClosed')}
              </Text>
            </View>
          )}

          {vm.reviews.loading && vm.reviews.items.length === 0 ? (
            <ActivityIndicator size="small" color={theme.primary} style={styles.loadingSpinner} />
          ) : vm.reviews.items.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="star" size={32} color="#CBD5E1" />
              <Text style={styles.emptyStateText}>{t('events.discussion.emptyReviews')}</Text>
            </View>
          ) : (
            vm.reviews.items.map((comment) => (
              <ReviewCommentItem key={comment.id} comment={comment} styles={styles} />
            ))
          )}

          {vm.reviews.hasNext && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => void vm.loadMoreReviews()}
              disabled={vm.reviews.loading}
            >
              {vm.reviews.loading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={styles.loadMoreText}>{t('events.discussion.loadMoreReviews')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      backgroundColor: t.surface,
    },
    tabRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: t.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textTertiary,
    },
    tabTextActive: {
      color: t.text,
    },
    inputCard: {
      margin: 16,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceVariant,
      gap: 10,
    },
    reviewInputLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: t.textSecondary,
    },
    starRow: {
      flexDirection: 'row',
      gap: 4,
    },
    starBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    starIcon: {
      fontSize: 34,
      color: t.border,
    },
    starIconActive: {
      color: '#F59E0B',
    },
    messageInput: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
      color: t.text,
      backgroundColor: t.surface,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    inputFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    charCount: {
      fontSize: 12,
      color: t.textMuted,
    },
    submitBtn: {
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: t.primary,
      minWidth: 70,
      alignItems: 'center',
    },
    submitBtnDisabled: {
      opacity: 0.45,
    },
    submitBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: t.textOnPrimary,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 10,
      borderRadius: 8,
      backgroundColor: t.errorBg,
      borderWidth: 1,
      borderColor: t.errorBorder,
      gap: 8,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: t.errorText,
    },
    authNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
    },
    authNoticeText: {
      fontSize: 13,
      color: t.textTertiary,
    },
    closedNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 10,
      borderRadius: 8,
      backgroundColor: t.warningBg,
      borderWidth: 1,
      borderColor: t.warningBorder,
    },
    closedNoticeText: {
      flex: 1,
      fontSize: 13,
      color: t.warningText,
    },
    loadingSpinner: {
      marginVertical: 24,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 10,
    },
    emptyStateText: {
      fontSize: 14,
      color: t.textTertiary,
    },
    commentCard: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      gap: 8,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    avatar: {
      backgroundColor: t.imagePlaceholder,
    },
    avatarPlaceholder: {
      backgroundColor: t.imagePlaceholder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentMeta: {
      flex: 1,
      gap: 2,
    },
    commentDisplayName: {
      fontSize: 13,
      fontWeight: '700',
      color: t.text,
    },
    commentTimestamp: {
      fontSize: 11,
      color: t.textMuted,
    },
    reviewStars: {
      fontSize: 14,
      color: '#F59E0B',
    },
    commentMessage: {
      fontSize: 14,
      lineHeight: 21,
      color: t.textSecondary,
    },
    reviewImage: {
      width: '100%',
      height: 180,
      borderRadius: 10,
      marginTop: 4,
    },
    commentActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 2,
    },
    replyToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    replyToggleText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#6366F1',
    },
    replyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    replyBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: t.textTertiary,
    },
    replyInputContainer: {
      marginTop: 8,
      gap: 8,
    },
    replyInput: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      padding: 10,
      fontSize: 13,
      color: t.text,
      backgroundColor: t.surfaceVariant,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    replyInputActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 10,
    },
    replyCancelBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    replyCancelText: {
      fontSize: 13,
      fontWeight: '600',
      color: t.textSecondary,
    },
    replySubmitBtn: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: t.primary,
      minWidth: 56,
      alignItems: 'center',
    },
    replySubmitText: {
      fontSize: 13,
      fontWeight: '700',
      color: t.textOnPrimary,
    },
    repliesContainer: {
      marginTop: 6,
      paddingLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: t.border,
      gap: 8,
    },
    replyCard: {
      gap: 6,
    },
    loadMoreBtn: {
      alignItems: 'center',
      paddingVertical: 14,
    },
    loadMoreText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#6366F1',
    },
  });
}
