// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAdminListViewModel } from './useAdminListViewModel';
import type { AdminListResponse } from '@/models/admin';

interface Row {
  id: string;
}

interface Filters {
  q?: string;
}

function Harness({ fetchPage }: { fetchPage: ReturnType<typeof vi.fn> }) {
  const vm = useAdminListViewModel<Row, Filters>({
    token: 'token',
    initialFilters: { q: '' },
    fetchPage,
  });

  return (
    <div>
      <input aria-label="Search" value={vm.filters.q ?? ''} onChange={(event) => vm.setFilter('q', event.target.value)} />
      <button type="button" onClick={vm.applyFilters}>Apply</button>
      <button type="button" onClick={vm.nextPage}>Next</button>
      <button type="button" onClick={vm.previousPage}>Previous</button>
      <div data-testid="offset">{vm.offset}</div>
      <div data-testid="count">{vm.items.length}</div>
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe('useAdminListViewModel', () => {
  it('applies filters and advances offset pagination', async () => {
    const fetchPage = vi.fn<[], Promise<AdminListResponse<Row>>>().mockResolvedValue({
      items: [{ id: '1' }],
      limit: 25,
      offset: 0,
      total_count: 60,
      has_next: true,
    });

    render(<Harness fetchPage={fetchPage} />);

    await waitFor(() => expect(fetchPage).toHaveBeenCalledWith('token', { q: '', limit: 25, offset: 0 }));

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'alice' } });
    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => expect(fetchPage).toHaveBeenCalledWith('token', { q: 'alice', limit: 25, offset: 0 }));

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => expect(fetchPage).toHaveBeenCalledWith('token', { q: 'alice', limit: 25, offset: 25 }));
    expect(screen.getByTestId('offset').textContent).toBe('25');

    fireEvent.click(screen.getByText('Previous'));

    await waitFor(() => expect(fetchPage).toHaveBeenCalledWith('token', { q: 'alice', limit: 25, offset: 0 }));
  });
});
