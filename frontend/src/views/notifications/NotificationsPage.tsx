import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotificationsViewModel } from '@/viewmodels/notifications/useNotificationsViewModel';
import { getNotificationPresentation } from '@/utils/notificationPresentation';
import { resolveNotificationRoute } from '@/utils/notificationRouting';
import type { NotificationItem } from '@/models/notification';
import '@/styles/notifications.css';
import i18n from '@/i18n';

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSeconds = Math.round((then - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(i18n.resolvedLanguage, { numeric: 'auto' });
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return rtf.format(Math.max(-59, Math.min(-1, diffSeconds)), 'second');
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day');
  return new Date(iso).toLocaleDateString(i18n.resolvedLanguage, {
    month: 'short',
    day: 'numeric',
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
  const { t } = useTranslation();
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
        aria-label={presentation.actionLabel ?? t('notifications.open_notification')}
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

        {isUnread && <span className="notif-row-dot" aria-label={t('notifications.unread')} />}
      </button>

      <button
        type="button"
        className="notif-row-delete"
        onClick={onDelete}
        aria-label={t('notifications.delete_notification')}
        title={t('notifications.delete_notification')}
      >
        &times;
      </button>
    </li>
  );
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const vm = useNotificationsViewModel();

  const handleClick = async (notification: NotificationItem) => {
    if (!notification.is_read) {
      // Fire-and-forget; the viewmodel handles optimistic update + rollback
      void vm.markRead(notification.id);
    }
    const route = resolveNotificationRoute(notification);
    if (route) navigate(route);
  };

  const hasAnyUnread = vm.notifications.some((n) => !n.is_read);

  return (
    <div className="notif-page">
      <header className="notif-page-header">
        <div>
          <h1 className="notif-page-title">{t('notifications.title')}</h1>
          <p className="notif-page-subtitle">
            {t('notifications.subtitle')}
          </p>
        </div>
        <div className="notif-page-actions">
          {hasAnyUnread && (
            <button
              type="button"
              className="notif-action-btn"
              onClick={() => vm.markAllRead()}
            >
              {t('notifications.mark_all_read')}
            </button>
          )}
          {vm.notifications.length > 0 && (
            <button
              type="button"
              className="notif-action-btn notif-action-danger"
              onClick={() => vm.deleteAll()}
            >
              {t('notifications.clear_all')}
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
            aria-label={t('notifications.dismiss_error')}
          >
            &times;
          </button>
        </div>
      )}

      {vm.isLoading && vm.notifications.length === 0 && (
        <div className="notif-loading">
          <span className="spinner" />
          <p>{t('notifications.loading')}</p>
        </div>
      )}

      {!vm.isLoading && vm.notifications.length === 0 && !vm.error && (
        <div className="notif-empty">
          <h2>{t('notifications.empty_title')}</h2>
          <p>{t('notifications.empty_body')}</p>
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
            {vm.isLoadingMore ? <span className="spinner" /> : t('notifications.load_more')}
          </button>
        </div>
      )}
    </div>
  );
}
