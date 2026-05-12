// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { setCurrentLocale } from '@/i18n';
import AppShell from './AppShell';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/authService', () => ({
  logout: vi.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

function renderShell() {
  return render(
    <LocaleProvider>
      <MemoryRouter initialEntries={['/discover']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/discover" element={<div>Discover</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  return setCurrentLocale('en');
});

afterEach(() => {
  cleanup();
});

describe('AppShell admin entry', () => {
  it('exposes skip link, main landmark, and navigation state', () => {
    mockUseAuth.mockReturnValue({
      token: null,
      refreshToken: null,
      username: null,
      role: null,
      avatarUrl: null,
      displayName: null,
      clearAuth: vi.fn(),
    });

    const { container } = renderShell();

    expect(screen.getByRole('link', { name: 'Skip to main content' }).getAttribute('href')).toBe('#main-content');
    expect(container.querySelector('main#main-content')?.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeDefined();

    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows non-admin header actions as locked when unauthenticated', () => {
    mockUseAuth.mockReturnValue({
      token: null,
      refreshToken: null,
      username: null,
      role: null,
      avatarUrl: null,
      displayName: null,
      clearAuth: vi.fn(),
    });

    renderShell();

    for (const name of ['My Events', 'Favorites', 'My Tickets', 'Invitations', 'Notifications', '+ Create Event']) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('aria-disabled')).toBe('true');
      expect(link.getAttribute('title')).toBe('You must sign in');
      expect(link.className).toContain('locked');
    }
    expect(screen.queryByRole('link', { name: 'Admin Panel' })).toBeNull();
  });

  it('shows Admin Panel for authenticated admins', () => {
    mockUseAuth.mockReturnValue({
      token: 'token',
      refreshToken: 'refresh',
      username: 'admin',
      role: 'ADMIN',
      avatarUrl: null,
      displayName: null,
      clearAuth: vi.fn(),
    });

    renderShell();

    expect(screen.getByRole('link', { name: 'Admin Panel' }).getAttribute('href')).toBe('/backoffice');
  });

  it('hides Admin Panel for regular authenticated users', () => {
    mockUseAuth.mockReturnValue({
      token: 'token',
      refreshToken: 'refresh',
      username: 'user',
      role: 'USER',
      avatarUrl: null,
      displayName: null,
      clearAuth: vi.fn(),
    });

    renderShell();

    expect(screen.queryByRole('link', { name: 'Admin Panel' })).toBeNull();
  });
});
