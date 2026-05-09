import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminEventReportFilters } from '@/models/admin';
import { listAdminEventReports, updateAdminEventReportStatus } from '@/services/adminService';
import { useAdminListViewModel } from '@/viewmodels/admin/useAdminListViewModel';
import { useAdminMutation } from '@/viewmodels/admin/useAdminMutation';
import { BackofficeIdCell, BackofficeImageModal, BackofficePageShell, BackofficePagination, BackofficeStatusPill, BackofficeTableState, formatAdminDate } from './BackofficeListParts';

const INITIAL_FILTERS: AdminEventReportFilters = {
  q: '',
  status: 'PENDING',
  report_category: undefined,
  event_id: '',
  reporter_user_id: '',
  created_from: '',
  created_to: '',
};

const REPORT_CATEGORY_LABELS: Record<NonNullable<AdminEventReportFilters['report_category']>, string> = {
  SAFETY: 'Safety',
  HARASSMENT: 'Harassment',
  SPAM_OR_SCAM: 'Spam or scam',
  INAPPROPRIATE_CONTENT: 'Inappropriate',
  EVENT_NOT_AS_DESCRIBED: 'Not as described',
  ILLEGAL_OR_DANGEROUS: 'Illegal or dangerous',
  OTHER: 'Other',
};

export default function EventReportsAdminPage() {
  const { token } = useAuth();
  const initialFilters = useMemo(() => INITIAL_FILTERS, []);
  const vm = useAdminListViewModel({ token, initialFilters, fetchPage: listAdminEventReports });
  const mutation = useAdminMutation(vm.retry);
  const [imageReportId, setImageReportId] = useState<string | null>(null);
  const imageReport = vm.items.find((report) => report.id === imageReportId);

  return (
    <BackofficePageShell
      title="Event Reports"
      subtitle="Review user-submitted flags for inappropriate, harassing, or spam event content."
      filters={(
        <>
          <input aria-label="Search reports" placeholder="Search event, reporter, or message" value={vm.filters.q ?? ''} onChange={(event) => vm.setFilter('q', event.target.value)} />
          <select aria-label="Report status" value={vm.filters.status ?? ''} onChange={(event) => vm.setFilter('status', event.target.value === '' ? undefined : event.target.value as AdminEventReportFilters['status'])}>
            <option value="">Any status</option>
            <option value="PENDING">PENDING</option>
            <option value="REVIEWED">REVIEWED</option>
            <option value="DISMISSED">DISMISSED</option>
          </select>
          <select aria-label="Report category" value={vm.filters.report_category ?? ''} onChange={(event) => vm.setFilter('report_category', event.target.value === '' ? undefined : event.target.value as AdminEventReportFilters['report_category'])}>
            <option value="">Any reason</option>
            {Object.entries(REPORT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input aria-label="Event ID" placeholder="Event ID" value={vm.filters.event_id ?? ''} onChange={(event) => vm.setFilter('event_id', event.target.value)} />
          <input aria-label="Reporter user ID" placeholder="Reporter user ID" value={vm.filters.reporter_user_id ?? ''} onChange={(event) => vm.setFilter('reporter_user_id', event.target.value)} />
          <input aria-label="Created from" type="datetime-local" value={vm.filters.created_from ?? ''} onChange={(event) => vm.setFilter('created_from', event.target.value)} />
          <input aria-label="Created to" type="datetime-local" value={vm.filters.created_to ?? ''} onChange={(event) => vm.setFilter('created_to', event.target.value)} />
          <button type="button" onClick={vm.applyFilters}>Apply</button>
          <button type="button" className="bo-secondary-button" onClick={vm.clearFilters}>Clear</button>
        </>
      )}
    >
      <BackofficeTableState isLoading={vm.isLoading} error={vm.error} empty={vm.items.length === 0} onRetry={vm.retry} />
      <div className="bo-table-wrap">
        <table className="bo-table bo-report-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Reason</th>
              <th>Event</th>
              <th>Reporter</th>
              <th>Message</th>
              <th>Image</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vm.items.map((report) => (
              <tr key={report.id}>
                <td><BackofficeIdCell id={report.id} /></td>
                <td>
                  <BackofficeStatusPill status={report.status} />
                </td>
                <td>{REPORT_CATEGORY_LABELS[report.report_category] ?? report.report_category}</td>
                <td>
                  <div className="bo-report-linked-cell">
                    <Link to={`/events/${report.event_id}`}>{report.event_title ?? 'Open event'}</Link>
                    <span>{report.event_id}</span>
                  </div>
                </td>
                <td>
                  <div className="bo-report-linked-cell">
                    <strong>{report.reporter_username ?? 'Unknown user'}</strong>
                    <span>{report.reporter_email ?? report.reporter_user_id}</span>
                  </div>
                </td>
                <td className="bo-report-message">{report.message}</td>
                <td>
                  {report.image_url ? (
                    <button type="button" className="bo-row-action" onClick={() => setImageReportId(report.id)}>View image</button>
                  ) : (
                    '-'
                  )}
                </td>
                <td>{formatAdminDate(report.created_at)}</td>
                <td>{formatAdminDate(report.updated_at)}</td>
                <td>
                  <select
                    aria-label={`Change report status ${report.id}`}
                    value={report.status}
                    disabled={mutation.busyId === report.id}
                    onChange={(event) => void mutation.run(
                      report.id,
                      () => updateAdminEventReportStatus(token!, report.id, { status: event.target.value as typeof report.status }),
                      'Report status updated.',
                    )}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="REVIEWED">REVIEWED</option>
                    <option value="DISMISSED">DISMISSED</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mutation.error && <div className="bo-state bo-state-error">{mutation.error}</div>}
      {mutation.message && <div className="bo-result" role="status"><span>{mutation.message}</span></div>}
      <BackofficePagination {...vm} onPrevious={vm.previousPage} onNext={vm.nextPage} onLimitChange={vm.changeLimit} />
      <BackofficeImageModal
        imageUrl={imageReport?.image_url ?? null}
        title={imageReport?.event_title ?? 'Report image'}
        message={imageReport?.message}
        onClose={() => setImageReportId(null)}
      />
    </BackofficePageShell>
  );
}
