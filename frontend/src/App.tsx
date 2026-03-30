import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginView from './views/auth/LoginView';
import RegisterView from './views/auth/RegisterView';
import ForgotPasswordView from './views/auth/ForgotPasswordView';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import DiscoverPage from './views/discover/DiscoverPage';
import CreateEventPage from './views/events/CreateEventPage';
import MyEventsPage from './views/events/MyEventsPage';
import InvitationsPage from './views/invitations/InvitationsPage';
import FavoritesPage from './views/favorites/FavoritesPage';
import ProfilePage from './views/profile/ProfilePage';

export default function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Routes>
      {/* App shell wraps all main pages (public + protected) */}
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/discover" replace />} />
        <Route path="/discover" element={<DiscoverPage />} />

        {/* Protected routes — require auth */}
        <Route path="/events/create" element={<ProtectedRoute><CreateEventPage /></ProtectedRoute>} />
        <Route path="/my-events" element={<ProtectedRoute><MyEventsPage /></ProtectedRoute>} />
        <Route path="/invitations" element={<ProtectedRoute><InvitationsPage /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      </Route>

      {/* Auth pages (no shell) */}
      <Route path="/login" element={<LoginView />} />
      <Route path="/register" element={<RegisterView />} />
      <Route path="/forgot-password" element={<ForgotPasswordView />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
