import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTicketDetailViewModel } from '@/viewmodels/tickets/useTicketDetailViewModel';
import { getTicketStatusPresentation } from '@/utils/ticketStatus';
import NotFoundView from '../fallback/NotFoundView';
import '@/styles/tickets.css';

function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function MobileQRIcon() {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3M14 17h3M14 21h7M17 14v7M21 14v3" />
    </svg>
  );
}

export default function TicketDetailPage() {
  const { t } = useTranslation();
  const { ticketId } = useParams<{ ticketId: string }>();
  const vm = useTicketDetailViewModel(ticketId);

  if (vm.status === 'loading') {
    return (
      <div className="tk-page">
        <div className="tk-loading">
          <span className="spinner" />
          <p>{t('tickets.loading_ticket')}</p>
        </div>
      </div>
    );
  }

  if (vm.status === 'not-found') {
    return <NotFoundView />;
  }

  if (vm.status === 'error' || !vm.ticket) {
    return (
      <div className="tk-page">
        <div className="tk-error" role="alert">
          <span>{vm.errorMessage ?? t('tickets.load_failed')}</span>
          <button type="button" className="tk-retry-btn" onClick={vm.refresh}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const { ticket, participation, event, location, qr_access } = vm.ticket;
  const presentation = getTicketStatusPresentation(ticket.status);
  const canShowMobileHint = ticket.status === 'ACTIVE';
  const eligibilityNotice =
    ticket.status === 'ACTIVE' && qr_access.eligible_now === false
      ? qr_access.reason ?? t('tickets.qr_not_eligible')
      : null;

  return (
    <div className="tk-page">
      <Link to="/tickets" className="tk-back-link">
        &larr; {t('tickets.back_to_tickets')}
      </Link>

      <article className="tk-detail" data-testid="ticket-detail">
        <header className="tk-detail-header">
          <span className={`tk-status-badge tk-status-${presentation.tone}`}>
            {presentation.label}
          </span>
          <h1 className="tk-detail-title">{event.title}</h1>
          <p className="tk-detail-status-desc">{presentation.description}</p>
        </header>

        <section className="tk-detail-section">
          <h2 className="tk-detail-section-title">{t('tickets.event_section')}</h2>
          <div className="tk-detail-row">
            <span className="tk-detail-label">{t('tickets.when')}</span>
            <span className="tk-detail-value">
              {formatDateTime(event.start_time)}
              {event.end_time && (
                <>
                  <br />
                  <span className="tk-detail-secondary">
                    {t('tickets.until', { date: formatDateTime(event.end_time) })}
                  </span>
                </>
              )}
            </span>
          </div>
          {event.address && (
            <div className="tk-detail-row">
              <span className="tk-detail-label">{t('tickets.where')}</span>
              <span className="tk-detail-value">{event.address}</span>
            </div>
          )}
          <div className="tk-detail-row">
            <span className="tk-detail-label">{t('tickets.coordinates')}</span>
            <span className="tk-detail-value tk-detail-mono">
              {location.anchor_lat.toFixed(5)}, {location.anchor_lon.toFixed(5)}
            </span>
          </div>
          <Link to={`/events/${event.id}`} className="tk-detail-link">
            {t('tickets.view_event_details')}
          </Link>
        </section>

        <section className="tk-detail-section">
          <h2 className="tk-detail-section-title">{t('tickets.ticket_section')}</h2>
          <div className="tk-detail-row">
            <span className="tk-detail-label">{t('tickets.ticket_id')}</span>
            <span className="tk-detail-value tk-detail-mono">{ticket.id}</span>
          </div>
          <div className="tk-detail-row">
            <span className="tk-detail-label">{t('tickets.participation')}</span>
            <span className="tk-detail-value">{participation.status}</span>
          </div>
          <div className="tk-detail-row">
            <span className="tk-detail-label">{t('tickets.expires_label')}</span>
            <span className="tk-detail-value">{formatDateTime(ticket.expires_at)}</span>
          </div>
          {ticket.used_at && (
            <div className="tk-detail-row">
              <span className="tk-detail-label">{t('tickets.used')}</span>
              <span className="tk-detail-value">{formatDateTime(ticket.used_at)}</span>
            </div>
          )}
        </section>

        {canShowMobileHint && (
          <section
            className={`tk-mobile-hint ${eligibilityNotice ? 'tk-mobile-hint-warn' : ''}`}
          >
            <span className="tk-mobile-hint-icon">
              <MobileQRIcon />
            </span>
            <div className="tk-mobile-hint-body">
              <p className="tk-mobile-hint-title">{t('tickets.show_qr_title')}</p>
              <p className="tk-mobile-hint-text">{t('tickets.show_qr_body')}</p>
              {eligibilityNotice && (
                <p className="tk-mobile-hint-notice">
                  {t('tickets.eligibility_note', { reason: eligibilityNotice })}
                </p>
              )}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
