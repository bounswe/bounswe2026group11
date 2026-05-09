import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminJoinRequestFilters } from '@/models/admin';
import { listAdminJoinRequests, updateAdminJoinRequestStatus } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { useAdminMutation } from '@/viewmodels/admin/useAdminMutation';
import { BackofficeConfirmAction, BackofficeIdCell, BackofficePageShell, BackofficePagination, BackofficeStatusPill, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

const INITIAL_FILTERS: AdminJoinRequestFilters = { q: '', status: undefined, event_id: '', user_id: '', host_user_id: '', created_from: '', created_to: '' };

export default function JoinRequestsAdminPage() {
  const { token } = useAuth();
  const vm = useAdminListViewModel({ token, initialFilters: useMemo(() => INITIAL_FILTERS, []), fetchPage: listAdminJoinRequests });
  const mutation = useAdminMutation(vm.retry);
  return (
    <BackofficePageShell title="Join Requests" subtitle="Inspect protected-event join requests and moderate pending rows." filters={(
      <>
        <input aria-label="Search join requests" placeholder="Search event or user" value={vm.filters.q ?? ''} onChange={(e) => vm.setFilter('q', e.target.value)} />
        <select aria-label="Join request status" value={vm.filters.status ?? ''} onChange={(e) => vm.setFilter('status', e.target.value === '' ? undefined : e.target.value as AdminJoinRequestFilters['status'])}>
          <option value="">Any status</option><option value="PENDING">PENDING</option><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option><option value="CANCELED">CANCELED</option>
        </select>
        <input aria-label="Event ID" placeholder="Event ID" value={vm.filters.event_id ?? ''} onChange={(e) => vm.setFilter('event_id', e.target.value)} />
        <input aria-label="User ID" placeholder="User ID" value={vm.filters.user_id ?? ''} onChange={(e) => vm.setFilter('user_id', e.target.value)} />
        <input aria-label="Host user ID" placeholder="Host user ID" value={vm.filters.host_user_id ?? ''} onChange={(e) => vm.setFilter('host_user_id', e.target.value)} />
        <button type="button" onClick={vm.applyFilters}>Apply</button><button type="button" className="bo-secondary-button" onClick={vm.clearFilters}>Clear</button>
      </>
    )}>
      <BackofficeTableState isLoading={vm.isLoading} error={vm.error} empty={vm.items.length === 0} onRetry={vm.retry} />
      <div className="bo-table-wrap"><table className="bo-table"><thead><tr><th>ID</th><th>Event</th><th>User</th><th>Host</th><th>Status</th><th>Message</th><th>Created</th><th>Actions</th></tr></thead><tbody>
        {vm.items.map((item) => <tr key={item.id}><td><BackofficeIdCell id={item.id} /></td><td>{item.event_title}</td><td>{item.username}<br /><span className="bo-muted">{item.user_email}</span></td><td>{item.host_username}</td><td><BackofficeStatusPill status={item.status} /></td><td className="bo-message-cell"><span>{item.message ?? '-'}</span></td><td>{formatAdminDate(item.created_at)}</td><td><div className="bo-row-actions"><BackofficeConfirmAction label="Reject" disabled={item.status !== 'PENDING'} busy={mutation.busyId === `${item.id}:reject`} onConfirm={() => void mutation.run(`${item.id}:reject`, () => updateAdminJoinRequestStatus(token!, item.id, { status: 'REJECTED' }), 'Join request rejected.')} /><BackofficeConfirmAction label="Cancel" disabled={item.status !== 'PENDING'} busy={mutation.busyId === `${item.id}:cancel`} onConfirm={() => void mutation.run(`${item.id}:cancel`, () => updateAdminJoinRequestStatus(token!, item.id, { status: 'CANCELED' }), 'Join request canceled.')} /></div></td></tr>)}
      </tbody></table></div>
      {mutation.error && <div className="bo-state bo-state-error">{mutation.error}</div>}
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
    </BackofficePageShell>
  );
}
