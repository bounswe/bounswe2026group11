import { useNavigate } from 'react-router-dom';
import { useInvitationsViewModel } from '@/viewmodels/invitations/useInvitationsViewModel';
import { UserAvatar } from '@/components/UserAvatar';
import { EventCoverImage } from '@/components/EventCoverImage';
import type { ReceivedInvitation } from '@/models/invitation';
import '@/styles/invitations.css';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function InvitationCard({
  invitation,
  isLoading,
  onAccept,
  onDecline,
  onView,
}: {
  invitation: ReceivedInvitation;
  isLoading: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onView: () => void;
}) {
  const hostName = invitation.host.display_name ?? invitation.host.username;

  return (
    <article className="inv-card" data-testid={`invitation-${invitation.invitation_id}`}>
      <div className="inv-card-cover">
        <EventCoverImage
          src={invitation.event.image_url ?? undefined}
          alt={invitation.event.title}
          imgClassName="inv-card-cover-img"
          variant="card"
        />
        <span className="inv-card-privacy">Private</span>
      </div>

      <div className="inv-card-body">
        <div className="inv-card-header">
          <h2 className="inv-card-title">{invitation.event.title}</h2>
          <span className="inv-card-meta">
            {formatDate(invitation.event.start_time)} &middot; {formatTime(invitation.event.start_time)}
          </span>
        </div>

        <div className="inv-card-host">
          <UserAvatar
            username={invitation.host.username}
            displayName={invitation.host.display_name ?? null}
            avatarUrl={invitation.host.avatar_url ?? null}
            size="sm"
            variant="muted"
          />
          <div className="inv-card-host-info">
            <span className="inv-card-host-name">{hostName}</span>
            <span className="inv-card-host-username">@{invitation.host.username}</span>
          </div>
        </div>

        {invitation.message && (
          <blockquote className="inv-card-message">
            <span className="inv-card-quote">&ldquo;</span>
            {invitation.message}
            <span className="inv-card-quote">&rdquo;</span>
          </blockquote>
        )}

        <div className="inv-card-actions">
          <button
            type="button"
            className="inv-card-btn inv-card-decline"
            onClick={onDecline}
            disabled={isLoading}
          >
            Decline
          </button>
          <button
            type="button"
            className="inv-card-btn inv-card-accept"
            onClick={onAccept}
            disabled={isLoading}
            data-testid={`accept-${invitation.invitation_id}`}
          >
            {isLoading ? <span className="spinner" /> : 'Accept'}
          </button>
          <button
            type="button"
            className="inv-card-btn inv-card-view"
            onClick={onView}
            disabled={isLoading}
          >
            View Event
          </button>
        </div>
      </div>
    </article>
  );
}

export default function InvitationsPage() {
  const navigate = useNavigate();
  const vm = useInvitationsViewModel();

  const handleAccept = async (invitationId: string) => {
    const result = await vm.handleAccept(invitationId);
    if (result) {
      navigate(`/events/${result.event_id}`);
    }
  };

  return (
    <div className="inv-page">
      <header className="inv-page-header">
        <h1 className="inv-page-title">Invitations</h1>
        <p className="inv-page-subtitle">
          Private event invitations sent to you by hosts.
        </p>
      </header>

      {vm.error && (
        <div className="inv-error" role="alert">
          <span>{vm.error}</span>
          <button
            type="button"
            className="inv-error-dismiss"
            onClick={vm.dismissError}
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {vm.isLoading && vm.invitations.length === 0 && (
        <div className="inv-loading">
          <span className="spinner" />
          <p>Loading invitations...</p>
        </div>
      )}

      {!vm.isLoading && vm.invitations.length === 0 && !vm.error && (
        <div className="inv-empty">
          <h2>No invitations yet</h2>
          <p>When a host invites you to a private event, it will show up here.</p>
        </div>
      )}

      {vm.invitations.length > 0 && (
        <div className="inv-list">
          {vm.invitations.map((inv) => (
            <InvitationCard
              key={inv.invitation_id}
              invitation={inv}
              isLoading={vm.isActionLoading === inv.invitation_id}
              onAccept={() => handleAccept(inv.invitation_id)}
              onDecline={() => vm.handleDecline(inv.invitation_id)}
              onView={() => navigate(`/events/${inv.event.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
