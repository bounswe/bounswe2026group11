import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminRatingFilters } from '@/models/admin';
import { deleteAdminEventRating, deleteAdminParticipantRating, listAdminEventRatings, listAdminParticipantRatings } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { useAdminMutation } from '@/viewmodels/admin/useAdminMutation';
import { BackofficeConfirmAction, BackofficeIdCell, BackofficePageShell, BackofficePagination, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

const INITIAL_FILTERS: AdminRatingFilters = { event_id: '', user_id: '', host_id: '', created_from: '', created_to: '' };

export default function RatingsAdminPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<'events' | 'participants'>('events');
  const eventVm = useAdminListViewModel({ token, initialFilters: useMemo(() => INITIAL_FILTERS, []), fetchPage: listAdminEventRatings });
  const participantVm = useAdminListViewModel({ token, initialFilters: useMemo(() => INITIAL_FILTERS, []), fetchPage: listAdminParticipantRatings });
  const vm = tab === 'events' ? eventVm : participantVm;
  const mutation = useAdminMutation(vm.retry);
  return (
    <BackofficePageShell title="Ratings" subtitle="Review event and participant ratings; delete outliers when moderation requires it." filters={(
      <>
        <button type="button" className={tab === 'events' ? '' : 'bo-secondary-button'} onClick={() => setTab('events')}>Event ratings</button>
        <button type="button" className={tab === 'participants' ? '' : 'bo-secondary-button'} onClick={() => setTab('participants')}>Participant ratings</button>
        <input aria-label="Event ID" placeholder="Event ID" value={vm.filters.event_id ?? ''} onChange={(e) => vm.setFilter('event_id', e.target.value)} />
        <input aria-label="User ID" placeholder="User ID" value={vm.filters.user_id ?? ''} onChange={(e) => vm.setFilter('user_id', e.target.value)} />
        {tab === 'participants' && <input aria-label="Host ID" placeholder="Host ID" value={participantVm.filters.host_id ?? ''} onChange={(e) => participantVm.setFilter('host_id', e.target.value)} />}
        <button type="button" onClick={vm.applyFilters}>Apply</button><button type="button" className="bo-secondary-button" onClick={vm.clearFilters}>Clear</button>
      </>
    )}>
      <BackofficeTableState isLoading={vm.isLoading} error={vm.error} empty={vm.items.length === 0} onRetry={vm.retry} />
      <div className="bo-table-wrap"><table className="bo-table"><thead><tr><th>ID</th><th>Event</th><th>User</th><th>Score</th><th>Created</th><th>Actions</th></tr></thead><tbody>
        {tab === 'events' ? eventVm.items.map((item) => <tr key={item.id}><td><BackofficeIdCell id={item.id} /></td><td>{item.event_title}</td><td>{item.username}<br /><span className="bo-muted">{item.user_email}</span></td><td>{item.score}</td><td>{formatAdminDate(item.created_at)}</td><td><BackofficeConfirmAction label="Delete" confirmLabel="Delete" busy={mutation.busyId === item.id} onConfirm={() => void mutation.run(item.id, () => deleteAdminEventRating(token!, item.id), 'Rating deleted.')} /></td></tr>) : participantVm.items.map((item) => <tr key={item.id}><td><BackofficeIdCell id={item.id} /></td><td>{item.event_title}</td><td>{item.participant_username}<br /><span className="bo-muted">Host: {item.host_username}</span></td><td>{item.score}</td><td>{formatAdminDate(item.created_at)}</td><td><BackofficeConfirmAction label="Delete" confirmLabel="Delete" busy={mutation.busyId === item.id} onConfirm={() => void mutation.run(item.id, () => deleteAdminParticipantRating(token!, item.id), 'Rating deleted.')} /></td></tr>)}
      </tbody></table></div>
      {mutation.error && <div className="bo-state bo-state-error">{mutation.error}</div>}
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
    </BackofficePageShell>
  );
}
