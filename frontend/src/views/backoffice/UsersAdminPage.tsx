import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminUserFilters } from '@/models/admin';
import { listAdminUsers } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { BackofficePageShell, BackofficePagination, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

const INITIAL_FILTERS: AdminUserFilters = {
  q: '',
  status: '',
  role: undefined,
  created_from: '',
  created_to: '',
};

export default function UsersAdminPage() {
  const { token } = useAuth();
  const initialFilters = useMemo(() => INITIAL_FILTERS, []);
  const vm = useAdminListViewModel({
    token,
    initialFilters,
    fetchPage: listAdminUsers,
  });

  return (
    <BackofficePageShell
      title="Users"
      subtitle="Search accounts by identity, status, role, and creation window."
      filters={(
        <>
          <input aria-label="Search users" placeholder="Search username, email, phone" value={vm.filters.q ?? ''} onChange={(event) => vm.setFilter('q', event.target.value)} />
          <select aria-label="User status" value={vm.filters.status ?? ''} onChange={(event) => vm.setFilter('status', event.target.value)}>
            <option value="">Any status</option>
            <option value="active">active</option>
          </select>
          <select aria-label="User role" value={vm.filters.role ?? ''} onChange={(event) => vm.setFilter('role', event.target.value === '' ? undefined : event.target.value as AdminUserFilters['role'])}>
            <option value="">Any role</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
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
              <th>Username</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Verified</th>
              <th>Created</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {vm.items.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>{user.phone_number ?? '-'}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
                <td>{user.email_verified ? 'Yes' : 'No'}</td>
                <td>{formatAdminDate(user.created_at)}</td>
                <td>{formatAdminDate(user.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
    </BackofficePageShell>
  );
}
