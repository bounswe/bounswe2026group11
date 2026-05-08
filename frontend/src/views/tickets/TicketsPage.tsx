import { Link } from 'react-router-dom';
import { useTicketsViewModel } from '@/viewmodels/tickets/useTicketsViewModel';
import { getTicketStatusPresentation } from '@/utils/ticketStatus';
import type { TicketListItem } from '@/models/ticket';
import '@/styles/tickets.css';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function TicketRow({ ticket }: { ticket: TicketListItem }) {
  const presentation = getTicketStatusPresentation(ticket.status);

  return (
    <Link
      to={`/tickets/${ticket.ticket_id}`}
      className="tk-card"
      data-testid={`ticket-${ticket.ticket_id}`}
    >
      <div className="tk-card-main">
        <div className="tk-card-header">
          <span className={`tk-status-badge tk-status-${presentation.tone}`}>
            {presentation.label}
          </span>
          <span className="tk-card-event-time">
            {formatDateTime(ticket.event.start_time)}
          </span>
        </div>

        <h3 className="tk-card-title">{ticket.event.title}</h3>

        {ticket.event.address && (
          <p className="tk-card-address">{ticket.event.address}</p>
        )}

        <div className="tk-card-footer">
          <span className="tk-card-meta">
            Expires {formatDateTime(ticket.expires_at)}
          </span>
          <span className="tk-card-link">View ticket &rarr;</span>
        </div>
      </div>
    </Link>
  );
}

export default function TicketsPage() {
  const vm = useTicketsViewModel();

  return (
    <div className="tk-page">
      <header className="tk-page-header">
        <h1 className="tk-page-title">My Tickets</h1>
        <p className="tk-page-subtitle">
          Tickets for events you&rsquo;re approved to attend &mdash; public, protected, or private.
          The live scannable QR is available in the mobile app at the venue.
        </p>
      </header>

      {vm.error && (
        <div className="tk-error" role="alert">
          <span>{vm.error}</span>
          <button
            type="button"
            className="tk-error-dismiss"
            onClick={vm.dismissError}
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {vm.isLoading && vm.tickets.length === 0 && (
        <div className="tk-loading">
          <span className="spinner" />
          <p>Loading tickets...</p>
        </div>
      )}

      {!vm.isLoading && vm.tickets.length === 0 && !vm.error && (
        <div className="tk-empty">
          <h2>No tickets yet</h2>
          <p>
            Tickets appear here once you join an event &mdash; either by joining a public event,
            being approved on a protected event, or accepting a private event invitation.
          </p>
        </div>
      )}

      {vm.tickets.length > 0 && (
        <div className="tk-list">
          {vm.tickets.map((t) => (
            <TicketRow key={t.ticket_id} ticket={t} />
          ))}
        </div>
      )}
    </div>
  );
}
