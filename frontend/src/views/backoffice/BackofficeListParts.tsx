import { useState, type ReactNode } from 'react';

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ShellProps {
  title: string;
  subtitle: string;
  filters: ReactNode;
  children: ReactNode;
}

export function BackofficePageShell({ title, subtitle, filters, children }: ShellProps) {
  return (
    <div className="bo-page">
      <div className="bo-page-header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="bo-filter-bar">{filters}</div>
      {children}
    </div>
  );
}

export function BackofficeIdCell({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="bo-id-cell">
      <button type="button" onClick={copyId} aria-label={`Copy ID ${id}`} title={id}>
        {copied ? (
          <span className="bo-copy-check" aria-hidden="true">✓</span>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="9" width="10" height="10" rx="2" />
            <path d="M5 15V7a2 2 0 0 1 2-2h8" />
          </svg>
        )}
      </button>
    </div>
  );
}

interface PaginationProps {
  offset: number;
  limit: number;
  totalCount: number;
  hasNext: boolean;
  isLoading: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onLimitChange: (limit: number) => void;
}

export function BackofficePagination({
  offset,
  limit,
  totalCount,
  hasNext,
  isLoading,
  onPrevious,
  onNext,
  onLimitChange,
}: PaginationProps) {
  const first = totalCount === 0 ? 0 : offset + 1;
  const last = Math.min(offset + limit, totalCount);

  return (
    <div className="bo-pagination">
      <div className="bo-pagination-summary">
        Showing {first}-{last} of {totalCount}
      </div>
      <div className="bo-pagination-controls">
        <label>
          Rows
          <select
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            disabled={isLoading}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <button type="button" onClick={onPrevious} disabled={isLoading || offset === 0}>
          Previous
        </button>
        <button type="button" onClick={onNext} disabled={isLoading || !hasNext}>
          Next
        </button>
      </div>
    </div>
  );
}

interface StateProps {
  isLoading: boolean;
  error: string | null;
  empty: boolean;
  onRetry: () => void;
}

export function BackofficeTableState({ isLoading, error, empty, onRetry }: StateProps) {
  if (isLoading) {
    return <div className="bo-state">Loading...</div>;
  }
  if (error) {
    return (
      <div className="bo-state bo-state-error">
        <span>{error}</span>
        <button type="button" onClick={onRetry}>Retry</button>
      </div>
    );
  }
  if (empty) {
    return <div className="bo-state">No rows match the current filters.</div>;
  }
  return null;
}
