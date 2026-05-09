import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminUserBadgeFilters } from '@/models/admin';
import { listAdminUserBadges } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { BackofficeIdCell, BackofficePageShell, BackofficePagination, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

const INITIAL_FILTERS: AdminUserBadgeFilters = { q: '', user_id: '' };

export default function BadgesAdminPage() {
  const { token } = useAuth();
  const vm = useAdminListViewModel({ token, initialFilters: useMemo(() => INITIAL_FILTERS, []), fetchPage: listAdminUserBadges });
  return (
    <BackofficePageShell title="Badges" subtitle="Read-only visibility into earned user badges." filters={(
      <>
        <input aria-label="Search badges" placeholder="Search badge or user" value={vm.filters.q ?? ''} onChange={(e) => vm.setFilter('q', e.target.value)} />
        <input aria-label="User ID" placeholder="User ID" value={vm.filters.user_id ?? ''} onChange={(e) => vm.setFilter('user_id', e.target.value)} />
        <button type="button" onClick={vm.applyFilters}>Apply</button><button type="button" className="bo-secondary-button" onClick={vm.clearFilters}>Clear</button>
      </>
    )}>
      <BackofficeTableState isLoading={vm.isLoading} error={vm.error} empty={vm.items.length === 0} onRetry={vm.retry} />
      <div className="bo-table-wrap"><table className="bo-table"><thead><tr><th>User</th><th>Badge ID</th><th>Badge</th><th>Category</th><th>Earned</th></tr></thead><tbody>
        {vm.items.map((item) => <tr key={`${item.user_id}:${item.badge_id}`}><td><BackofficeIdCell id={item.user_id} /> {item.username}<br /><span className="bo-muted">{item.user_email}</span></td><td>{item.badge_id}</td><td>{item.badge_name}<br /><span className="bo-muted">{item.badge_slug}</span></td><td>{item.badge_category}</td><td>{formatAdminDate(item.earned_at)}</td></tr>)}
      </tbody></table></div>
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
    </BackofficePageShell>
  );
}
