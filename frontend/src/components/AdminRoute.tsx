import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AccessDeniedView from '@/views/fallback/AccessDeniedView';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="spinner" style={{ borderTopColor: '#111827', borderColor: 'rgba(17,24,39,0.2)' }} />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  if (role !== 'ADMIN') {
    return (
      <AccessDeniedView
        title="Admin Access Required"
        message="This admin panel area is only available to administrators."
      />
    );
  }

  return <>{children}</>;
}
