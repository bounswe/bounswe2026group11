import { Link } from 'react-router-dom';
import '@/styles/fallback.css';

interface NotFoundViewProps {
  title?: string;
  message?: string;
  actionText?: string;
  actionTo?: string;
}

export default function NotFoundView({
  title = '404',
  message = "We couldn't find the page you're looking for. It might have been moved, deleted, or perhaps it never existed.",
  actionText = 'Back to Discover',
  actionTo = '/discover',
}: NotFoundViewProps) {
  return (
    <div className="fallback-page">
      <div className="fallback-content">
        <div className="fallback-icon">{title === '404' ? '404' : '👀'}</div>
        <h1 className="fallback-title">{title === '404' ? 'Page Not Found' : title}</h1>
        <p className="fallback-desc">{message}</p>
        <div className="fallback-actions">
          <Link to={actionTo} className="fallback-btn-primary">
            {actionText}
          </Link>
        </div>
      </div>
    </div>
  );
}
