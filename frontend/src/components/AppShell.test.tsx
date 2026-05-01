// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
    <MemoryRouter initialEntries={['/discover']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/discover" element={<div>Discover</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('AppShell admin entry', () => {
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
