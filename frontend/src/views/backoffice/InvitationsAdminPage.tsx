import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminInvitationFilters } from '@/models/admin';
import { listAdminInvitations, updateAdminInvitationStatus } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { useAdminMutation } from '@/viewmodels/admin/useAdminMutation';
import { BackofficeConfirmAction, BackofficeIdCell, BackofficePageShell, BackofficePagination, BackofficeStatusPill, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

const INITIAL_FILTERS: AdminInvitationFilters = { q: '', status: undefined, event_id: '', host_id: '', invited_user_id: '', created_from: '', created_to: '' };

export default function InvitationsAdminPage() {
  const { token } = useAuth();
  const vm = useAdminListViewModel({ token, initialFilters: useMemo(() => INITIAL_FILTERS, []), fetchPage: listAdminInvitations });
  const mutation = useAdminMutation(vm.retry);
  return (
    <BackofficePageShell title="Invitations" subtitle="Inspect and cancel pending event invitations." filters={(
      <>
        <input aria-label="Search invitations" placeholder="Search event or user" value={vm.filters.q ?? ''} onChange={(e) => vm.setFilter('q', e.target.value)} />
        <select aria-label="Invitation status" value={vm.filters.status ?? ''} onChange={(e) => vm.setFilter('status', e.target.value === '' ? undefined : e.target.value as AdminInvitationFilters['status'])}>
          <option value="">Any status</option><option value="PENDING">PENDING</option><option value="ACCEPTED">ACCEPTED</option><option value="DECLINED">DECLINED</option><option value="EXPIRED">EXPIRED</option><option value="CANCELED">CANCELED</option>
        </select>
        <input aria-label="Event ID" placeholder="Event ID" value={vm.filters.event_id ?? ''} onChange={(e) => vm.setFilter('event_id', e.target.value)} />
        <input aria-label="Host ID" placeholder="Host ID" value={vm.filters.host_id ?? ''} onChange={(e) => vm.setFilter('host_id', e.target.value)} />
        <input aria-label="Invited user ID" placeholder="Invited user ID" value={vm.filters.invited_user_id ?? ''} onChange={(e) => vm.setFilter('invited_user_id', e.target.value)} />
        <button type="button" onClick={vm.applyFilters}>Apply</button><button type="button" className="bo-secondary-button" onClick={vm.clearFilters}>Clear</button>
      </>
    )}>
      <BackofficeTableState isLoading={vm.isLoading} error={vm.error} empty={vm.items.length === 0} onRetry={vm.retry} />
      <div className="bo-table-wrap"><table className="bo-table"><thead><tr><th>ID</th><th>Event</th><th>Host</th><th>Invited</th><th>Status</th><th>Expires</th><th>Created</th><th>Actions</th></tr></thead><tbody>
        {vm.items.map((item) => <tr key={item.id}><td><BackofficeIdCell id={item.id} /></td><td>{item.event_title}</td><td>{item.host_username}</td><td>{item.invited_username}<br /><span className="bo-muted">{item.invited_email}</span></td><td><BackofficeStatusPill status={item.status} /></td><td>{formatAdminDate(item.expires_at)}</td><td>{formatAdminDate(item.created_at)}</td><td><BackofficeConfirmAction label="Cancel" disabled={item.status !== 'PENDING'} busy={mutation.busyId === item.id} onConfirm={() => void mutation.run(item.id, () => updateAdminInvitationStatus(token!, item.id, { status: 'CANCELED' }), 'Invitation canceled.')} /></td></tr>)}
      </tbody></table></div>
      {mutation.error && <div className="bo-state bo-state-error">{mutation.error}</div>}
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
    </BackofficePageShell>
  );
}
