import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import AccessDeniedView from '@/views/fallback/AccessDeniedView';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { token, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="spinner spinner-themed" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  if (role !== 'ADMIN') {
    return (
      <AccessDeniedView
        title={t('fallback.access_denied.admin_title')}
        message={t('fallback.access_denied.admin_body')}
      />
    );
  }

  return <>{children}</>;
}
