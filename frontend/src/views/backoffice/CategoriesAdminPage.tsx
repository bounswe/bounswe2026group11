import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminCategory } from '@/models/admin';
import { createAdminCategory, deleteAdminCategory, listAdminCategories } from '@/services/adminService';
import { ApiError } from '@/services/api';
import { BackofficeConfirmAction, BackofficeIdCell, BackofficePageShell, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

export default function CategoriesAdminPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listAdminCategories(token);
      setItems(result.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load categories.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setBusyId('create');
    setError(null);
    try {
      await createAdminCategory(token, { name });
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create category.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(categoryId: number) {
    if (!token) return;
    setBusyId(String(categoryId));
    setError(null);
    try {
      await deleteAdminCategory(token, categoryId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete category.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <BackofficePageShell
      title="Categories"
      subtitle="View stable category IDs and manage the event category catalog."
      filters={(
        <form className="bo-inline-form" onSubmit={submitCreate}>
          <input aria-label="New category name" placeholder="New category name" value={name} onChange={(event) => setName(event.target.value)} />
          <button type="submit" disabled={busyId === 'create'}>{busyId === 'create' ? 'Adding...' : 'Add category'}</button>
        </form>
      )}
    >
      <BackofficeTableState isLoading={isLoading} error={error} empty={items.length === 0} onRetry={load} />
      <div className="bo-table-wrap">
        <table className="bo-table">
          <thead><tr><th>ID</th><th>Name</th><th>Created</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((category) => (
              <tr key={category.id}>
                <td><BackofficeIdCell id={String(category.id)} /></td>
                <td>{category.name}</td>
                <td>{formatAdminDate(category.created_at)}</td>
                <td>{formatAdminDate(category.updated_at)}</td>
                <td>
                  <BackofficeConfirmAction
                    label="Delete"
                    confirmLabel="Delete"
                    busy={busyId === String(category.id)}
                    onConfirm={() => void remove(category.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BackofficePageShell>
  );
}
