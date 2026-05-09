import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminPushDeviceFilters } from '@/models/admin';
import { listAdminPushDevices, revokeAdminPushDevice } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { useAdminMutation } from '@/viewmodels/admin/useAdminMutation';
import { BackofficeConfirmAction, BackofficeIdCell, BackofficePageShell, BackofficePagination, BackofficeStatusPill, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

const INITIAL_FILTERS: AdminPushDeviceFilters = { user_id: '', platform: undefined, active: '', created_from: '', created_to: '' };

export default function PushDevicesAdminPage() {
  const { token } = useAuth();
  const vm = useAdminListViewModel({ token, initialFilters: useMemo(() => INITIAL_FILTERS, []), fetchPage: listAdminPushDevices });
  const mutation = useAdminMutation(vm.retry);
  return (
    <BackofficePageShell title="Push Devices" subtitle="Inspect and revoke registered push devices." filters={(
      <>
        <input aria-label="User ID" placeholder="User ID" value={vm.filters.user_id ?? ''} onChange={(e) => vm.setFilter('user_id', e.target.value)} />
        <select aria-label="Platform" value={vm.filters.platform ?? ''} onChange={(e) => vm.setFilter('platform', e.target.value === '' ? undefined : e.target.value as AdminPushDeviceFilters['platform'])}><option value="">Any platform</option><option value="IOS">IOS</option><option value="ANDROID">ANDROID</option></select>
        <select aria-label="Active" value={vm.filters.active ?? ''} onChange={(e) => vm.setFilter('active', e.target.value)}><option value="">Any state</option><option value="true">Active</option><option value="false">Revoked</option></select>
        <button type="button" onClick={vm.applyFilters}>Apply</button><button type="button" className="bo-secondary-button" onClick={vm.clearFilters}>Clear</button>
      </>
    )}>
      <BackofficeTableState isLoading={vm.isLoading} error={vm.error} empty={vm.items.length === 0} onRetry={vm.retry} />
      <div className="bo-table-wrap"><table className="bo-table"><thead><tr><th>ID</th><th>User</th><th>Platform</th><th>State</th><th>Last seen</th><th>Actions</th></tr></thead><tbody>
        {vm.items.map((item) => <tr key={item.id}><td><BackofficeIdCell id={item.id} /></td><td>{item.username}<br /><span className="bo-muted">{item.user_email}</span></td><td>{item.platform}</td><td><BackofficeStatusPill status={item.revoked_at ? 'REVOKED' : 'ACTIVE'} /></td><td>{formatAdminDate(item.last_seen_at)}</td><td><BackofficeConfirmAction label="Revoke" disabled={Boolean(item.revoked_at)} busy={mutation.busyId === item.id} onConfirm={() => void mutation.run(item.id, () => revokeAdminPushDevice(token!, item.id), 'Device revoked.')} /></td></tr>)}
      </tbody></table></div>
      {mutation.error && <div className="bo-state bo-state-error">{mutation.error}</div>}
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
    </BackofficePageShell>
  );
}
