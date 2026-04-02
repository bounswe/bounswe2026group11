import { Link } from 'react-router-dom';
import '@/styles/fallback.css';

interface AccessDeniedViewProps {
  title?: string;
  message?: string;
  actionText?: string;
  actionTo?: string;
  isPrivateEvent?: boolean;
}

export default function AccessDeniedView({
  title = 'Access Denied',
  message = "You don't have permission to view this page. If you believe this is a mistake, contact the host or return to the main dashboard.",
  actionText = 'Back to Discover',
  actionTo = '/discover',
  isPrivateEvent = false,
}: AccessDeniedViewProps) {
  // Enhance messaging for private event restriction
  const displayMessage = isPrivateEvent 
    ? "This is a private event. Only approved participants and invited guests are allowed to view its details."
    : message;

  return (
    <div className="fallback-page">
      <div className="fallback-content">
        <div className="fallback-icon">🔒</div>
        <h1 className="fallback-title">{title}</h1>
        <p className="fallback-desc">{displayMessage}</p>
        <div className="fallback-actions">
          <Link to={actionTo} className="fallback-btn-primary">
            {actionText}
          </Link>
          <button 
            type="button" 
            className="fallback-btn-secondary"
            onClick={() => window.history.back()}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
