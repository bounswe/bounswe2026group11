import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminEventFilters } from '@/models/admin';
import { listAdminEvents } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { BackofficePageShell, BackofficePagination, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

const INITIAL_FILTERS: AdminEventFilters = {
  q: '',
  host_id: '',
  category_id: undefined,
  privacy_level: undefined,
  status: undefined,
  start_from: '',
  start_to: '',
};

export default function EventsAdminPage() {
  const { token } = useAuth();
  const initialFilters = useMemo(() => INITIAL_FILTERS, []);
  const vm = useAdminListViewModel({ token, initialFilters, fetchPage: listAdminEvents });

  return (
    <BackofficePageShell
      title="Events"
      subtitle="Inspect event rows by host, category, privacy, lifecycle, and start time."
      filters={(
        <>
          <input aria-label="Search events" placeholder="Search title or host" value={vm.filters.q ?? ''} onChange={(event) => vm.setFilter('q', event.target.value)} />
          <input aria-label="Host ID" placeholder="Host ID" value={vm.filters.host_id ?? ''} onChange={(event) => vm.setFilter('host_id', event.target.value)} />
          <input aria-label="Category ID" type="number" placeholder="Category ID" value={vm.filters.category_id ?? ''} onChange={(event) => vm.setFilter('category_id', event.target.value === '' ? undefined : event.target.value)} />
          <select aria-label="Privacy level" value={vm.filters.privacy_level ?? ''} onChange={(event) => vm.setFilter('privacy_level', event.target.value === '' ? undefined : event.target.value as AdminEventFilters['privacy_level'])}>
            <option value="">Any privacy</option>
            <option value="PUBLIC">PUBLIC</option>
            <option value="PROTECTED">PROTECTED</option>
            <option value="PRIVATE">PRIVATE</option>
          </select>
          <select aria-label="Event status" value={vm.filters.status ?? ''} onChange={(event) => vm.setFilter('status', event.target.value === '' ? undefined : event.target.value as AdminEventFilters['status'])}>
            <option value="">Any status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="CANCELED">CANCELED</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
          <input aria-label="Start from" type="datetime-local" value={vm.filters.start_from ?? ''} onChange={(event) => vm.setFilter('start_from', event.target.value)} />
          <input aria-label="Start to" type="datetime-local" value={vm.filters.start_to ?? ''} onChange={(event) => vm.setFilter('start_to', event.target.value)} />
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
              <th>Title</th>
              <th>Host</th>
              <th>Category</th>
              <th>Privacy</th>
              <th>Status</th>
              <th>Start</th>
              <th>End</th>
              <th>Capacity</th>
              <th>Approved</th>
              <th>Pending</th>
            </tr>
          </thead>
          <tbody>
            {vm.items.map((event) => (
              <tr key={event.id}>
                <td>{event.title}</td>
                <td>{event.host_username}</td>
                <td>{event.category_name ?? event.category_id ?? '-'}</td>
                <td>{event.privacy_level}</td>
                <td>{event.status}</td>
                <td>{formatAdminDate(event.start_time)}</td>
                <td>{formatAdminDate(event.end_time)}</td>
                <td>{event.capacity ?? '-'}</td>
                <td>{event.approved_participant_count}</td>
                <td>{event.pending_participant_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
    </BackofficePageShell>
  );
}
