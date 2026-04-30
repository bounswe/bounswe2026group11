import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminParticipationFilters } from '@/models/admin';
import { listAdminParticipations } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { BackofficePageShell, BackofficePagination, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

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
      <BackofficeTableState isLoading={vm.isLoading} error={vm.error} empty={vm.items.length === 0} onRetry={vm.retry} />
      <div className="bo-table-wrap">
        <table className="bo-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>User</th>
              <th>Email</th>
              <th>Status</th>
              <th>Reconfirmed</th>
              <th>Created</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {vm.items.map((participation) => (
              <tr key={participation.id}>
                <td>{participation.event_title}</td>
                <td>{participation.username}</td>
                <td>{participation.user_email}</td>
                <td>{participation.status}</td>
                <td>{formatAdminDate(participation.reconfirmed_at)}</td>
                <td>{formatAdminDate(participation.created_at)}</td>
                <td>{formatAdminDate(participation.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
    </BackofficePageShell>
  );
}
