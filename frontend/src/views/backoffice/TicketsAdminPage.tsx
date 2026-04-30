import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminTicketFilters } from '@/models/admin';
import { listAdminTickets } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { BackofficeIdCell, BackofficePageShell, BackofficePagination, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

const INITIAL_FILTERS: AdminTicketFilters = {
  q: '',
  status: undefined,
  event_id: '',
  user_id: '',
  participation_id: '',
  created_from: '',
  created_to: '',
};

export default function TicketsAdminPage() {
  const { token } = useAuth();
  const initialFilters = useMemo(() => INITIAL_FILTERS, []);
  const vm = useAdminListViewModel({ token, initialFilters, fetchPage: listAdminTickets });

  return (
    <BackofficePageShell
      title="Tickets"
      subtitle="Inspect ticket state across events, users, and participations."
      filters={(
        <>
          <input aria-label="Search tickets" placeholder="Search event or user" value={vm.filters.q ?? ''} onChange={(event) => vm.setFilter('q', event.target.value)} />
          <select aria-label="Ticket status" value={vm.filters.status ?? ''} onChange={(event) => vm.setFilter('status', event.target.value === '' ? undefined : event.target.value as AdminTicketFilters['status'])}>
            <option value="">Any status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PENDING">PENDING</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="USED">USED</option>
            <option value="CANCELED">CANCELED</option>
          </select>
          <input aria-label="Event ID" placeholder="Event ID" value={vm.filters.event_id ?? ''} onChange={(event) => vm.setFilter('event_id', event.target.value)} />
          <input aria-label="User ID" placeholder="User ID" value={vm.filters.user_id ?? ''} onChange={(event) => vm.setFilter('user_id', event.target.value)} />
          <input aria-label="Participation ID" placeholder="Participation ID" value={vm.filters.participation_id ?? ''} onChange={(event) => vm.setFilter('participation_id', event.target.value)} />
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
              <th>ID</th>
              <th>Event</th>
              <th>User</th>
              <th>Email</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Used</th>
              <th>Canceled</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {vm.items.map((ticket) => (
              <tr key={ticket.id}>
                <td><BackofficeIdCell id={ticket.id} /></td>
                <td>{ticket.event_title}</td>
                <td>{ticket.username}</td>
                <td>{ticket.user_email}</td>
                <td>{ticket.status}</td>
                <td>{formatAdminDate(ticket.expires_at)}</td>
                <td>{formatAdminDate(ticket.used_at)}</td>
                <td>{formatAdminDate(ticket.canceled_at)}</td>
                <td>{formatAdminDate(ticket.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
    </BackofficePageShell>
  );
}
