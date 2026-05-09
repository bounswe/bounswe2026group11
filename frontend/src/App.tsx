import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LandingPage from './views/auth/LandingPage';
import LoginView from './views/auth/LoginView';
import RegisterView from './views/auth/RegisterView';
import ForgotPasswordView from './views/auth/ForgotPasswordView';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import DiscoverPage from './views/discover/DiscoverPage';
import CreateEventPage from './views/events/CreateEventPage';
import EventDetailPage from './views/events/EventDetailPage';
import MyEventsPage from './views/events/MyEventsPage';
import InvitationsPage from './views/invitations/InvitationsPage';
import NotificationsPage from './views/notifications/NotificationsPage';
import TicketsPage from './views/tickets/TicketsPage';
import TicketDetailPage from './views/tickets/TicketDetailPage';
import FavoritesPage from './views/favorites/FavoritesPage';
import ProfilePage from './views/profile/ProfilePage';
import NotFoundView from './views/fallback/NotFoundView';
import BackofficeLayout from './views/backoffice/BackofficeLayout';
import UsersAdminPage from './views/backoffice/UsersAdminPage';
import EventsAdminPage from './views/backoffice/EventsAdminPage';
import EventReportsAdminPage from './views/backoffice/EventReportsAdminPage';
import ParticipationsAdminPage from './views/backoffice/ParticipationsAdminPage';
import TicketsAdminPage from './views/backoffice/TicketsAdminPage';
import NotificationsAdminPage from './views/backoffice/NotificationsAdminPage';

export default function App() {
  const { isLoading, token } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={token ? <Navigate to="/discover" replace /> : <LandingPage />} />

      {/* App shell wraps all main pages (public + protected) */}
      <Route element={<AppShell />}>
        <Route path="/discover" element={<DiscoverPage />} />

        {/* Protected routes — require auth */}
        <Route path="/events/create" element={<ProtectedRoute><CreateEventPage /></ProtectedRoute>} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/my-events" element={<ProtectedRoute><MyEventsPage /></ProtectedRoute>} />
        <Route path="/invitations" element={<ProtectedRoute><InvitationsPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/tickets" element={<ProtectedRoute><TicketsPage /></ProtectedRoute>} />
        <Route path="/tickets/:ticketId" element={<ProtectedRoute><TicketDetailPage /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route
          path="/backoffice"
          element={<AdminRoute><BackofficeLayout /></AdminRoute>}
        >
          <Route index element={<Navigate to="/backoffice/users" replace />} />
          <Route path="users" element={<UsersAdminPage />} />
          <Route path="events" element={<EventsAdminPage />} />
          <Route path="event-reports" element={<EventReportsAdminPage />} />
          <Route path="participations" element={<ParticipationsAdminPage />} />
          <Route path="tickets" element={<TicketsAdminPage />} />
          <Route path="notifications" element={<NotificationsAdminPage />} />
        </Route>
        <Route path="/admin-panel" element={<Navigate to="/backoffice" replace />} />
        <Route path="/admin-panel/*" element={<Navigate to="/backoffice" replace />} />
      </Route>

      {/* Auth pages (no shell) */}
      <Route path="/login" element={<LoginView />} />
      <Route path="/register" element={<RegisterView />} />
      <Route path="/forgot-password" element={<ForgotPasswordView />} />

      {/* Fallback */}
      <Route path="*" element={<NotFoundView />} />
    </Routes>
  );
}
