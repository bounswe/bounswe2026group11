import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminCommentFilters } from '@/models/admin';
import { deleteAdminComment, listAdminComments } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { useAdminMutation } from '@/viewmodels/admin/useAdminMutation';
import { BackofficeConfirmAction, BackofficeIdCell, BackofficePageShell, BackofficePagination, BackofficeStatusPill, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

const INITIAL_FILTERS: AdminCommentFilters = { q: '', event_id: '', user_id: '', type: undefined, created_from: '', created_to: '' };

export default function CommentsAdminPage() {
  const { token } = useAuth();
  const vm = useAdminListViewModel({ token, initialFilters: useMemo(() => INITIAL_FILTERS, []), fetchPage: listAdminComments });
  const mutation = useAdminMutation(vm.retry);
  return (
    <BackofficePageShell title="Comments" subtitle="Inspect discussion and review comments." filters={(
      <>
        <input aria-label="Search comments" placeholder="Search message, event, user" value={vm.filters.q ?? ''} onChange={(e) => vm.setFilter('q', e.target.value)} />
        <select aria-label="Comment type" value={vm.filters.type ?? ''} onChange={(e) => vm.setFilter('type', e.target.value === '' ? undefined : e.target.value as AdminCommentFilters['type'])}><option value="">Any type</option><option value="DISCUSSION">DISCUSSION</option><option value="REVIEW">REVIEW</option></select>
        <input aria-label="Event ID" placeholder="Event ID" value={vm.filters.event_id ?? ''} onChange={(e) => vm.setFilter('event_id', e.target.value)} />
        <input aria-label="User ID" placeholder="User ID" value={vm.filters.user_id ?? ''} onChange={(e) => vm.setFilter('user_id', e.target.value)} />
        <button type="button" onClick={vm.applyFilters}>Apply</button><button type="button" className="bo-secondary-button" onClick={vm.clearFilters}>Clear</button>
      </>
    )}>
      <BackofficeTableState isLoading={vm.isLoading} error={vm.error} empty={vm.items.length === 0} onRetry={vm.retry} />
      <div className="bo-table-wrap"><table className="bo-table"><thead><tr><th>ID</th><th>Event</th><th>User</th><th>Type</th><th>Message</th><th>Created</th><th>Actions</th></tr></thead><tbody>
        {vm.items.map((item) => <tr key={item.id}><td><BackofficeIdCell id={item.id} /></td><td>{item.event_title}</td><td>{item.username}<br /><span className="bo-muted">{item.user_email}</span></td><td><BackofficeStatusPill status={item.type} /></td><td className="bo-report-message">{item.message}</td><td>{formatAdminDate(item.created_at)}</td><td><BackofficeConfirmAction label="Delete" confirmLabel="Delete" busy={mutation.busyId === item.id} onConfirm={() => void mutation.run(item.id, () => deleteAdminComment(token!, item.id), 'Comment deleted.')} /></td></tr>)}
      </tbody></table></div>
      {mutation.error && <div className="bo-state bo-state-error">{mutation.error}</div>}
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
    </BackofficePageShell>
  );
}
