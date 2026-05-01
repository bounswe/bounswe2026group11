import { BackofficePageShell } from './BackofficeListParts';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminNotificationFilters } from '@/models/admin';
import { listAdminNotifications } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { useAdminNotificationViewModel } from '@/viewmodels/admin/useAdminNotificationViewModel';
import { BackofficeIdCell, BackofficePagination, BackofficeTableState, formatAdminDate } from './BackofficeListParts';
import { useMemo } from 'react';

const INITIAL_FILTERS: AdminNotificationFilters = {
  q: '',
  user_id: '',
  event_id: '',
  type: '',
  is_read: '',
  created_from: '',
  created_to: '',
};

export default function NotificationsAdminPage() {
  const { token } = useAuth();
  const vm = useAdminNotificationViewModel(token);
  const initialFilters = useMemo(() => INITIAL_FILTERS, []);
  const list = useAdminListViewModel({ token, initialFilters, fetchPage: listAdminNotifications });

  return (
    <BackofficePageShell
      title="Notifications"
      subtitle="Send targeted notifications and inspect recent notification inbox rows."
      filters={(
        <>
          <input aria-label="Search notifications" placeholder="Search title, body, user" value={list.filters.q ?? ''} onChange={(event) => list.setFilter('q', event.target.value)} />
          <input aria-label="Notification user filter" placeholder="User ID" value={list.filters.user_id ?? ''} onChange={(event) => list.setFilter('user_id', event.target.value)} />
          <input aria-label="Notification event filter" placeholder="Event ID" value={list.filters.event_id ?? ''} onChange={(event) => list.setFilter('event_id', event.target.value)} />
          <input aria-label="Notification type filter" placeholder="Type" value={list.filters.type ?? ''} onChange={(event) => list.setFilter('type', event.target.value)} />
          <select aria-label="Notification read filter" value={list.filters.is_read ?? ''} onChange={(event) => list.setFilter('is_read', event.target.value)}>
            <option value="">Any read state</option>
            <option value="false">Unread</option>
            <option value="true">Read</option>
          </select>
          <input aria-label="Notification created from" type="datetime-local" value={list.filters.created_from ?? ''} onChange={(event) => list.setFilter('created_from', event.target.value)} />
          <input aria-label="Notification created to" type="datetime-local" value={list.filters.created_to ?? ''} onChange={(event) => list.setFilter('created_to', event.target.value)} />
          <button type="button" onClick={list.applyFilters}>Apply</button>
          <button type="button" className="bo-secondary-button" onClick={list.clearFilters}>Clear</button>
        </>
      )}
    >
      <form
        className="bo-notification-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void vm.submit().then((sent) => {
            if (sent) void list.retry();
          });
        }}
      >
        <div className="bo-composer-targets">
          <label className="bo-field">
            <span>Target user</span>
            <div className="bo-add-row">
              <input
                aria-label="Target user ID"
                value={vm.form.targetUserInput}
                onChange={(event) => vm.setField('targetUserInput', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    vm.addTargetUser();
                  }
                }}
                placeholder="User UUID"
              />
              <button type="button" onClick={vm.addTargetUser} aria-label="Add target user">+</button>
            </div>
            {vm.fieldErrors.targetUserInput && <strong>{vm.fieldErrors.targetUserInput}</strong>}
          </label>

          <div className="bo-target-list" aria-label="Selected target users">
            {vm.targetUserIds.length === 0 ? (
              <span className="bo-muted">No users selected</span>
            ) : vm.targetUserIds.map((userId, index) => (
              <span className="bo-chip" key={userId} title={userId}>
                User {index + 1}
                <button type="button" aria-label={`Remove ${userId}`} onClick={() => vm.removeTargetUser(userId)}>x</button>
              </span>
            ))}
          </div>
        </div>

        <div className="bo-composer-main-fields">
          <label className="bo-field bo-delivery-field">
          <span>Delivery mode</span>
          <select
            aria-label="Delivery mode"
            value={vm.form.deliveryMode}
            onChange={(event) => vm.setField('deliveryMode', event.target.value as typeof vm.form.deliveryMode)}
          >
            <option value="IN_APP">IN_APP</option>
            <option value="PUSH">PUSH</option>
            <option value="BOTH">BOTH</option>
          </select>
        </label>

          <label className="bo-field bo-title-field">
          <span>Title</span>
          <input
            aria-label="Notification title"
            value={vm.form.title}
            onChange={(event) => vm.setField('title', event.target.value)}
          />
          {vm.fieldErrors.title && <strong>{vm.fieldErrors.title}</strong>}
        </label>
        </div>

        <label className="bo-field bo-body-field">
          <span>Body</span>
          <textarea
            aria-label="Notification body"
            value={vm.form.body}
            onChange={(event) => vm.setField('body', event.target.value)}
            rows={3}
          />
          {vm.fieldErrors.body && <strong>{vm.fieldErrors.body}</strong>}
        </label>

        <details className="bo-advanced-fields">
          <summary>Optional metadata</summary>
          <div className="bo-advanced-grid">
            <label className="bo-field">
          <span>Type</span>
          <input
            aria-label="Notification type"
            value={vm.form.type}
            onChange={(event) => vm.setField('type', event.target.value)}
          />
        </label>

        <label className="bo-field">
          <span>Deep link</span>
          <input
            aria-label="Deep link"
            value={vm.form.deepLink}
            onChange={(event) => vm.setField('deepLink', event.target.value)}
          />
        </label>

        <label className="bo-field">
          <span>Event ID</span>
          <input
            aria-label="Notification event ID"
            value={vm.form.eventId}
            onChange={(event) => vm.setField('eventId', event.target.value)}
          />
          {vm.fieldErrors.eventId && <strong>{vm.fieldErrors.eventId}</strong>}
        </label>

        <label className="bo-field bo-field-wide">
          <span>Data JSON</span>
          <textarea
            aria-label="Notification data JSON"
            value={vm.form.dataText}
            onChange={(event) => vm.setField('dataText', event.target.value)}
            placeholder='{"source":"backoffice"}'
            rows={3}
          />
          {vm.fieldErrors.dataText && <strong>{vm.fieldErrors.dataText}</strong>}
        </label>
          </div>
        </details>

        {vm.submitError && <div className="bo-state bo-state-error bo-inline-state">{vm.submitError}</div>}

        {vm.result && (
          <div className="bo-result" role="status">
            <span>Targets: {vm.result.target_user_count}</span>
            <span>Created: {vm.result.created_count}</span>
            <span>Idempotent: {vm.result.idempotent_count}</span>
            <span>SSE: {vm.result.sse_delivery_count}</span>
            <span>Push sent: {vm.result.push_sent_count}</span>
            <span>Push failed: {vm.result.push_failed_count}</span>
            <span>Invalid tokens: {vm.result.invalid_token_count}</span>
          </div>
        )}

        <div className="bo-form-actions">
          <button type="submit" disabled={vm.isSubmitting}>
            {vm.isSubmitting ? 'Sending...' : 'Send notification'}
          </button>
        </div>
      </form>

      <section className="bo-history-section" aria-label="Sent notifications">
        <div className="bo-section-heading">
          <h2>Sent notifications</h2>
          <button type="button" className="bo-secondary-button" onClick={list.retry}>Refresh</button>
        </div>
        <BackofficeTableState isLoading={list.isLoading} error={list.error} empty={list.items.length === 0} onRetry={list.retry} />
        <div className="bo-table-wrap">
          <table className="bo-table bo-notification-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Title</th>
                <th>Type</th>
                <th>Read</th>
                <th>Delivery</th>
                <th>Event</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((notification) => (
                <tr key={notification.id}>
                  <td><BackofficeIdCell id={notification.id} /></td>
                  <td>
                    <div className="bo-cell-stack">
                      <strong>{notification.username}</strong>
                      <span>{notification.user_email}</span>
                    </div>
                  </td>
                  <td>
                    <div className="bo-cell-stack bo-message-cell">
                      <strong>{notification.title}</strong>
                      <span>{notification.body}</span>
                    </div>
                  </td>
                  <td>{notification.type ?? '-'}</td>
                  <td>{notification.is_read ? 'Read' : 'Unread'}</td>
                  <td>
                    <div className="bo-cell-stack">
                      <span>SSE {notification.sse_sent_count}</span>
                      <span>Push {notification.push_sent_count}/{notification.push_failed_count}</span>
                    </div>
                  </td>
                  <td>{notification.event_title ?? (notification.event_id ? <BackofficeIdCell id={notification.event_id} /> : '-')}</td>
                  <td>{formatAdminDate(notification.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <BackofficePagination {...list} onPrevious={list.previousPage} onNext={list.nextPage} onLimitChange={list.changeLimit} />
      </section>
    </BackofficePageShell>
  );
}
