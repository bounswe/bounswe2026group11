// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from './App';

vi.mock('./contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Stub all page/shell components to avoid pulling in CSS and heavy deps
vi.mock('./views/auth/LandingPage', () => ({ default: () => <div>Landing Page</div> }));
vi.mock('./views/discover/DiscoverPage', () => ({ default: () => <div>Discover Page</div> }));
vi.mock('./components/AppShell', () => {
  const React = require('react');
  const { Outlet } = require('react-router-dom');
  return { default: () => React.createElement(Outlet) };
});
vi.mock('./views/auth/LoginView', () => ({ default: () => <div>Login</div> }));
vi.mock('./views/auth/RegisterView', () => ({ default: () => <div>Register</div> }));
vi.mock('./views/auth/ForgotPasswordView', () => ({ default: () => <div>Forgot Password</div> }));
vi.mock('./views/backoffice/UsersAdminPage', () => ({ default: () => <div>Users Admin Page</div> }));
vi.mock('./views/backoffice/EventsAdminPage', () => ({ default: () => <div>Events Admin Page</div> }));
vi.mock('./views/backoffice/ParticipationsAdminPage', () => ({ default: () => <div>Participations Admin Page</div> }));
vi.mock('./views/backoffice/TicketsAdminPage', () => ({ default: () => <div>Tickets Admin Page</div> }));
vi.mock('./views/backoffice/NotificationsAdminPage', () => ({ default: () => <div>Notifications Admin Page</div> }));
vi.mock('./components/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { useAuth } from './contexts/AuthContext';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

// Helper: captures the current pathname in the rendered tree
function CurrentPath() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <CurrentPath />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('App / route', () => {
  it('shows landing page when unauthenticated', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, token: null });

    renderAt('/');

    expect(screen.getByText('Landing Page')).toBeDefined();
    expect(screen.getByTestId('path').textContent).toBe('/');
  });

  it('redirects authenticated user from / to /discover', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, token: 'valid-token' });

    renderAt('/');

    expect(screen.getByText('Discover Page')).toBeDefined();
    expect(screen.getByTestId('path').textContent).toBe('/discover');
  });

  it('renders nothing while auth is loading', () => {
    mockUseAuth.mockReturnValue({ isLoading: true, token: null });

    const { container } = renderAt('/');

    // App returns null while loading; only CurrentPath should be in the DOM
    expect(container.querySelector('[data-testid="path"]')).toBeDefined();
    expect(screen.queryByText('Landing Page')).toBeNull();
  });

  it('denies /backoffice child pages to non-admin users', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, token: 'valid-token', role: 'USER' });

    renderAt('/backoffice/users');

    expect(screen.getByText('Admin Access Required')).toBeDefined();
    expect(screen.queryByText('Users Admin Page')).toBeNull();
  });

  it('renders /backoffice child pages for admins', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, token: 'valid-token', role: 'ADMIN' });

    renderAt('/backoffice/users');

    expect(screen.getByText('Users Admin Page')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Users' })).toBeDefined();
  });
});
