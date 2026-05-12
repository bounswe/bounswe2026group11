import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '@/styles/fallback.css';

interface AccessDeniedViewProps {
  title?: string;
  message?: string;
  actionText?: string;
  actionTo?: string;
  isPrivateEvent?: boolean;
}

export default function AccessDeniedView({
  title,
  message,
  actionText,
  actionTo = '/discover',
  isPrivateEvent = false,
}: AccessDeniedViewProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('fallback.access_denied.heading');
  const displayMessage = isPrivateEvent
    ? t('fallback.access_denied.private_event_body')
    : (message ?? t('fallback.access_denied.body'));
  const resolvedAction = actionText ?? t('fallback.access_denied.back_discover');

  return (
    <div className="fallback-page">
      <div className="fallback-content">
        <div className="fallback-icon">🔒</div>
        <h1 className="fallback-title">{resolvedTitle}</h1>
        <p className="fallback-desc">{displayMessage}</p>
        <div className="fallback-actions">
          <Link to={actionTo} className="fallback-btn-primary">
            {resolvedAction}
          </Link>
          <button
            type="button"
            className="fallback-btn-secondary"
            onClick={() => window.history.back()}
          >
            {t('fallback.access_denied.go_back')}
          </button>
        </div>
      </div>
    </div>
  );
}
