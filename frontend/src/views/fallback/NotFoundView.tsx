import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '@/styles/fallback.css';

interface NotFoundViewProps {
  title?: string;
  message?: string;
  actionText?: string;
  actionTo?: string;
}

export default function NotFoundView({
  title,
  message,
  actionText,
  actionTo = '/discover',
}: NotFoundViewProps) {
  const { t } = useTranslation();
  const resolvedHeading = title ?? t('fallback.not_found.heading');
  const resolvedMessage = message ?? t('fallback.not_found.body');
  const resolvedAction = actionText ?? t('fallback.not_found.back_discover');
  const isGeneric404 = title === undefined;

  return (
    <div className="fallback-page">
      <div className="fallback-content">
        <div className="fallback-icon">{isGeneric404 ? '404' : '👀'}</div>
        <h1 className="fallback-title">{resolvedHeading}</h1>
        <p className="fallback-desc">{resolvedMessage}</p>
        <div className="fallback-actions">
          <Link to={actionTo} className="fallback-btn-primary">
            {resolvedAction}
          </Link>
        </div>
      </div>
    </div>
  );
}
