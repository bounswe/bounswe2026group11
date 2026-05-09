import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminFavoriteFilters } from '@/models/admin';
import { listAdminFavoriteEvents, listAdminFavoriteLocations } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { BackofficeIdCell, BackofficePageShell, BackofficePagination, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

const INITIAL_FILTERS: AdminFavoriteFilters = { q: '', user_id: '', event_id: '', created_from: '', created_to: '' };

export default function FavoritesAdminPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<'events' | 'locations'>('events');
  const eventVm = useAdminListViewModel({ token, initialFilters: useMemo(() => INITIAL_FILTERS, []), fetchPage: listAdminFavoriteEvents });
  const locationVm = useAdminListViewModel({ token, initialFilters: useMemo(() => INITIAL_FILTERS, []), fetchPage: listAdminFavoriteLocations });
  const vm = tab === 'events' ? eventVm : locationVm;
  return (
    <BackofficePageShell title="Favorites" subtitle="Read-only visibility into saved events and locations." filters={(
      <>
        <button type="button" className={tab === 'events' ? '' : 'bo-secondary-button'} onClick={() => setTab('events')}>Events</button>
        <button type="button" className={tab === 'locations' ? '' : 'bo-secondary-button'} onClick={() => setTab('locations')}>Locations</button>
        {tab === 'locations' && <input aria-label="Search locations" placeholder="Search location or user" value={locationVm.filters.q ?? ''} onChange={(e) => locationVm.setFilter('q', e.target.value)} />}
        <input aria-label="User ID" placeholder="User ID" value={vm.filters.user_id ?? ''} onChange={(e) => vm.setFilter('user_id', e.target.value)} />
        {tab === 'events' && <input aria-label="Event ID" placeholder="Event ID" value={eventVm.filters.event_id ?? ''} onChange={(e) => eventVm.setFilter('event_id', e.target.value)} />}
        <button type="button" onClick={vm.applyFilters}>Apply</button><button type="button" className="bo-secondary-button" onClick={vm.clearFilters}>Clear</button>
      </>
    )}>
      <BackofficeTableState isLoading={vm.isLoading} error={vm.error} empty={vm.items.length === 0} onRetry={vm.retry} />
      <div className="bo-table-wrap"><table className="bo-table"><thead><tr><th>ID</th><th>User</th><th>{tab === 'events' ? 'Event' : 'Location'}</th><th>Created</th></tr></thead><tbody>
        {tab === 'events' ? eventVm.items.map((item) => <tr key={item.id}><td><BackofficeIdCell id={item.id} /></td><td>{item.username}<br /><span className="bo-muted">{item.user_email}</span></td><td>{item.event_title}</td><td>{formatAdminDate(item.created_at)}</td></tr>) : locationVm.items.map((item) => <tr key={item.id}><td><BackofficeIdCell id={item.id} /></td><td>{item.username}<br /><span className="bo-muted">{item.user_email}</span></td><td>{item.name ?? item.address ?? '-'}</td><td>{formatAdminDate(item.created_at)}</td></tr>)}
      </tbody></table></div>
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
    </BackofficePageShell>
  );
}
