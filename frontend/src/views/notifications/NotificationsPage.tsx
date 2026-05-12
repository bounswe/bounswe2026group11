import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationsViewModel } from '@/viewmodels/notifications/useNotificationsViewModel';
import { getNotificationPresentation } from '@/utils/notificationPresentation';
import { resolveNotificationRoute } from '@/utils/notificationRouting';
import type { NotificationItem } from '@/models/notification';
import type { ReceivedInvitation } from '@/models/invitation';
import {
  acceptInvitation,
  declineInvitation,
  getMyInvitation,
} from '@/services/invitationService';
import { ApiError } from '@/services/api';
import '@/styles/notifications.css';

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function NotificationIcon({ kind }: { kind: 'mail' | 'check' | 'cross' | 'bell' }) {
  if (kind === 'mail') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    );
  }
  if (kind === 'check') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  if (kind === 'cross') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function NotificationRow({
  notification,
  onClick,
  onDelete,
}: {
  notification: NotificationItem;
  onClick: () => void;
  onDelete: () => void;
}) {
  const presentation = getNotificationPresentation(notification);
  const isUnread = !notification.is_read;

  return (
    <li
      className={`notif-row ${isUnread ? 'notif-row-unread' : ''}`}
      data-testid={`notification-${notification.id}`}
    >
      <button
        type="button"
        className="notif-row-main"
        onClick={onClick}
        aria-label={presentation.actionLabel ?? 'Open notification'}
      >
        <span
          className="notif-row-icon"
          style={{
            color: presentation.accentColor,
            background: presentation.accentBackgroundColor,
          }}
        >
          <NotificationIcon kind={presentation.iconKind} />
        </span>

        <span className="notif-row-content">
          <span className="notif-row-header">
            {presentation.badgeLabel && (
              <span
                className="notif-row-badge"
                style={{
                  color: presentation.accentColor,
                  background: presentation.accentBackgroundColor,
                }}
              >
                {presentation.badgeLabel}
              </span>
            )}
            <span className="notif-row-title">{presentation.title}</span>
            <span className="notif-row-time">{timeAgo(notification.created_at)}</span>
          </span>

          {presentation.eventTitle && (
            <span className="notif-row-event">{presentation.eventTitle}</span>
          )}

          <span className="notif-row-summary">{presentation.summary}</span>

          {presentation.metadata.length > 0 && (
            <span className="notif-row-meta">{presentation.metadata.join(' · ')}</span>
          )}

          {presentation.actionLabel && (
            <span
              className="notif-row-action"
              style={{ color: presentation.accentColor }}
            >
              {presentation.actionLabel} &rarr;
            </span>
          )}
        </span>

        {isUnread && <span className="notif-row-dot" aria-label="Unread" />}
      </button>

      <button
        type="button"
        className="notif-row-delete"
        onClick={onDelete}
        aria-label="Delete notification"
        title="Delete notification"
      >
        &times;
      </button>
    </li>
  );
}

function invitationIdFromNotification(notification: NotificationItem): string | null {
  const dataId = notification.data?.invitation_id?.trim();
  if (dataId) return dataId;

  const link = notification.deep_link?.trim();
  const match = link?.match(/(?:^|:\/\/|\/)invitations\/([0-9a-fA-F-]{20,})(?:$|[/?#])/);
  return match?.[1] ?? null;
}

function invitationStatusMessage(invitation: ReceivedInvitation): string {
  switch (invitation.status) {
    case 'ACCEPTED':
      return 'You already accepted this invitation.';
    case 'DECLINED':
      return 'You already declined this invitation.';
    case 'CANCELED':
      return 'The host canceled this invitation.';
    case 'EXPIRED':
      return 'This invitation has expired.';
    case 'PENDING':
      return 'This invitation is ready for your response.';
    default:
      return 'This invitation is no longer actionable.';
  }
}

function InvitationNotificationModal({
  invitation,
  isLoading,
  isActionLoading,
  error,
  onAccept,
  onDecline,
  onClose,
}: {
  invitation: ReceivedInvitation | null;
  isLoading: boolean;
  isActionLoading: boolean;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}) {
  const canAct = invitation?.status === 'PENDING';
  const hostName = invitation
    ? invitation.host.display_name ?? invitation.host.username
    : null;

  return (
    <div className="notif-inv-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="notif-inv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-inv-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="notif-inv-modal-header">
          <h2 id="notif-inv-modal-title">Invitation details</h2>
          <button
            type="button"
            className="notif-inv-modal-close"
            onClick={onClose}
            aria-label="Close invitation details"
          >
            &times;
          </button>
        </div>

        {isLoading && (
          <div className="notif-inv-modal-state">
            <span className="spinner" />
            <p>Loading invitation...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="notif-inv-modal-error" role="alert">
            {error}
          </div>
        )}

        {!isLoading && invitation && (
          <>
            <div className="notif-inv-modal-event">
              <span className={`notif-inv-modal-status status-${invitation.status.toLowerCase()}`}>
                {invitation.status}
              </span>
              <h3>{invitation.event.title}</h3>
              <p>
                {formatDate(invitation.event.start_time)} at {formatTime(invitation.event.start_time)}
              </p>
              {hostName && <p>From {hostName}</p>}
            </div>

            {invitation.message && (
              <blockquote className="notif-inv-modal-message">
                {invitation.message}
              </blockquote>
            )}

            <p className="notif-inv-modal-status-text">
              {invitationStatusMessage(invitation)}
            </p>

            {canAct ? (
              <div className="notif-inv-modal-actions">
                <button
                  type="button"
                  className="notif-action-btn notif-inv-decline"
                  onClick={onDecline}
                  disabled={isActionLoading}
                >
                  Decline
                </button>
                <button
                  type="button"
                  className="notif-action-btn notif-inv-accept"
                  onClick={onAccept}
                  disabled={isActionLoading}
                >
                  {isActionLoading ? <span className="spinner" /> : 'Accept'}
                </button>
              </div>
            ) : (
              <div className="notif-inv-modal-actions">
                <button
                  type="button"
                  className="notif-action-btn"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const vm = useNotificationsViewModel();
  const [modalInvitationId, setModalInvitationId] = useState<string | null>(null);
  const [modalInvitation, setModalInvitation] = useState<ReceivedInvitation | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalActionLoading, setModalActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const openInvitationModal = async (invitationId: string) => {
    setModalInvitationId(invitationId);
    setModalInvitation(null);
    setModalError(null);
    if (!token) {
      setModalError('You need to sign in to view this invitation.');
      return;
    }

    setModalLoading(true);
    try {
      const invitation = await getMyInvitation(invitationId, token);
      setModalInvitation(invitation);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Failed to load invitation');
    } finally {
      setModalLoading(false);
    }
  };

  const closeInvitationModal = () => {
    setModalInvitationId(null);
    setModalInvitation(null);
    setModalError(null);
    setModalLoading(false);
    setModalActionLoading(false);
  };

  const handleModalAccept = async () => {
    if (!token || !modalInvitationId) return;
    setModalActionLoading(true);
    setModalError(null);
    try {
      const response = await acceptInvitation(modalInvitationId, token);
      closeInvitationModal();
      navigate(`/events/${response.event_id}`);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Failed to accept invitation');
      try {
        const latest = await getMyInvitation(modalInvitationId, token);
        setModalInvitation(latest);
      } catch {
        /* Keep the action error visible. */
      }
    } finally {
      setModalActionLoading(false);
    }
  };

  const handleModalDecline = async () => {
    if (!token || !modalInvitationId) return;
    setModalActionLoading(true);
    setModalError(null);
    try {
      await declineInvitation(modalInvitationId, token);
      const latest = await getMyInvitation(modalInvitationId, token);
      setModalInvitation(latest);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Failed to decline invitation');
      try {
        const latest = await getMyInvitation(modalInvitationId, token);
        setModalInvitation(latest);
      } catch {
        /* Keep the action error visible. */
      }
    } finally {
      setModalActionLoading(false);
    }
  };

  const handleClick = async (notification: NotificationItem) => {
    if (!notification.is_read) {
      // Fire-and-forget; the viewmodel handles optimistic update + rollback
      void vm.markRead(notification.id);
    }

    if (notification.type === 'PRIVATE_EVENT_INVITATION_RECEIVED') {
      const invitationId = invitationIdFromNotification(notification);
      if (invitationId) {
        void openInvitationModal(invitationId);
        return;
      }
    }

    const route = resolveNotificationRoute(notification);
    if (route) navigate(route);
  };

  const hasAnyUnread = vm.notifications.some((n) => !n.is_read);

  return (
    <div className="notif-page">
      <header className="notif-page-header">
        <div>
          <h1 className="notif-page-title">Notifications</h1>
          <p className="notif-page-subtitle">
            Updates about your events, invitations, and join requests.
          </p>
        </div>
        <div className="notif-page-actions">
          {hasAnyUnread && (
            <button
              type="button"
              className="notif-action-btn"
              onClick={() => vm.markAllRead()}
            >
              Mark all read
            </button>
          )}
          {vm.notifications.length > 0 && (
            <button
              type="button"
              className="notif-action-btn notif-action-danger"
              onClick={() => vm.deleteAll()}
            >
              Clear all
            </button>
          )}
        </div>
      </header>

      {vm.error && (
        <div className="notif-error" role="alert">
          <span>{vm.error}</span>
          <button
            type="button"
            className="notif-error-dismiss"
            onClick={vm.dismissError}
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {vm.isLoading && vm.notifications.length === 0 && (
        <div className="notif-loading">
          <span className="spinner" />
          <p>Loading notifications...</p>
        </div>
      )}

      {!vm.isLoading && vm.notifications.length === 0 && !vm.error && (
        <div className="notif-empty">
          <h2>No notifications yet</h2>
          <p>You&rsquo;ll see updates here when something happens with your events.</p>
        </div>
      )}

      {vm.notifications.length > 0 && (
        <ul className="notif-list">
          {vm.notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onClick={() => handleClick(n)}
              onDelete={() => vm.deleteOne(n.id)}
            />
          ))}
        </ul>
      )}

      {vm.hasNext && (
        <div className="notif-load-more">
          <button
            type="button"
            className="notif-action-btn"
            onClick={() => vm.loadMore()}
            disabled={vm.isLoadingMore}
          >
            {vm.isLoadingMore ? <span className="spinner" /> : 'Load more'}
          </button>
        </div>
      )}

      {modalInvitationId && (
        <InvitationNotificationModal
          invitation={modalInvitation}
          isLoading={modalLoading}
          isActionLoading={modalActionLoading}
          error={modalError}
          onAccept={handleModalAccept}
          onDecline={handleModalDecline}
          onClose={closeInvitationModal}
        />
      )}
    </div>
  );
}
