import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminParticipationFilters } from '@/models/admin';
import { listAdminParticipations } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { useAdminParticipationActionsViewModel } from '@/viewmodels/admin/useAdminParticipationActionsViewModel';
import { BackofficeIdCell, BackofficePageShell, BackofficePagination, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

const INITIAL_FILTERS: AdminParticipationFilters = {
  q: '',
  status: undefined,
  event_id: '',
  user_id: '',
  created_from: '',
  created_to: '',
};

export default function ParticipationsAdminPage() {
  const { token } = useAuth();
  const initialFilters = useMemo(() => INITIAL_FILTERS, []);
  const vm = useAdminListViewModel({ token, initialFilters, fetchPage: listAdminParticipations });
  const actions = useAdminParticipationActionsViewModel(token, vm.retry);

  return (
    <BackofficePageShell
      title="Participations"
      subtitle="Review user-event participation rows and current lifecycle status."
      filters={(
        <>
          <input aria-label="Search participations" placeholder="Search event or user" value={vm.filters.q ?? ''} onChange={(event) => vm.setFilter('q', event.target.value)} />
          <select aria-label="Participation status" value={vm.filters.status ?? ''} onChange={(event) => vm.setFilter('status', event.target.value === '' ? undefined : event.target.value as AdminParticipationFilters['status'])}>
            <option value="">Any status</option>
            <option value="APPROVED">APPROVED</option>
            <option value="PENDING">PENDING</option>
            <option value="CANCELED">CANCELED</option>
            <option value="LEAVED">LEAVED</option>
          </select>
          <input aria-label="Event ID" placeholder="Event ID" value={vm.filters.event_id ?? ''} onChange={(event) => vm.setFilter('event_id', event.target.value)} />
          <input aria-label="User ID" placeholder="User ID" value={vm.filters.user_id ?? ''} onChange={(event) => vm.setFilter('user_id', event.target.value)} />
          <input aria-label="Created from" type="datetime-local" value={vm.filters.created_from ?? ''} onChange={(event) => vm.setFilter('created_from', event.target.value)} />
          <input aria-label="Created to" type="datetime-local" value={vm.filters.created_to ?? ''} onChange={(event) => vm.setFilter('created_to', event.target.value)} />
          <button type="button" onClick={vm.applyFilters}>Apply</button>
          <button type="button" className="bo-secondary-button" onClick={vm.clearFilters}>Clear</button>
        </>
      )}
    >
      <form
        className="bo-action-form bo-participation-form"
        onSubmit={(event) => {
          event.preventDefault();
          void actions.submitCreate();
        }}
      >
        <label className="bo-field">
          <span>Event ID</span>
          <input
            aria-label="Manual event ID"
            value={actions.createForm.eventId}
            onChange={(event) => actions.setCreateField('eventId', event.target.value)}
          />
          {actions.createErrors.eventId && <strong>{actions.createErrors.eventId}</strong>}
        </label>
        <label className="bo-field">
          <span>User ID</span>
          <input
            aria-label="Manual user ID"
            value={actions.createForm.userId}
            onChange={(event) => actions.setCreateField('userId', event.target.value)}
          />
          {actions.createErrors.userId && <strong>{actions.createErrors.userId}</strong>}
        </label>
        <label className="bo-field bo-field-wide">
          <span>Reason</span>
          <input
            aria-label="Manual participation reason"
            value={actions.createForm.reason}
            onChange={(event) => actions.setCreateField('reason', event.target.value)}
            placeholder="Optional admin note"
          />
        </label>
        {actions.createError && <div className="bo-state bo-state-error bo-inline-state">{actions.createError}</div>}
        {actions.createResult && (
          <div className="bo-result" role="status">
            <span>Created participation: {actions.createResult.participation_id}</span>
            <span>Status: {actions.createResult.status}</span>
            {actions.createResult.ticket_status && <span>Ticket: {actions.createResult.ticket_status}</span>}
          </div>
        )}
        <div className="bo-form-actions">
          <button type="submit" disabled={actions.isCreating}>
            {actions.isCreating ? 'Creating...' : 'Create approved participation'}
          </button>
        </div>
      </form>

      {actions.cancelError && <div className="bo-state bo-state-error">{actions.cancelError}</div>}
      {actions.cancelResult && (
        <div className="bo-result" role="status">
          <span>Canceled participation: {actions.cancelResult.participation_id}</span>
          <span>{actions.cancelResult.already_canceled ? 'Already canceled' : 'Status updated'}</span>
        </div>
      )}

      <BackofficeTableState isLoading={vm.isLoading} error={vm.error} empty={vm.items.length === 0} onRetry={vm.retry} />
      <div className="bo-table-wrap">
        <table className="bo-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Event</th>
              <th>User</th>
              <th>Email</th>
              <th>Status</th>
              <th>Reconfirmed</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vm.items.map((participation) => {
              const cancelable = participation.status === 'APPROVED' || participation.status === 'PENDING';
              return (
                <tr key={participation.id}>
                  <td><BackofficeIdCell id={participation.id} /></td>
                  <td>{participation.event_title}</td>
                  <td>{participation.username}</td>
                  <td>{participation.user_email}</td>
                  <td>{participation.status}</td>
                  <td>{formatAdminDate(participation.reconfirmed_at)}</td>
                  <td>{formatAdminDate(participation.created_at)}</td>
                  <td>{formatAdminDate(participation.updated_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="bo-row-action"
                      disabled={!cancelable || actions.cancelingId === participation.id}
                      onClick={() => void actions.cancelParticipation(participation.id)}
                    >
                      {actions.cancelingId === participation.id ? 'Canceling...' : 'Cancel'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
    </BackofficePageShell>
  );
}
