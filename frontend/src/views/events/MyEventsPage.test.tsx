// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyEventsPage from './MyEventsPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'token' }),
}));

vi.mock('@/viewmodels/event/useMyEventsViewModel', () => ({
  useMyEventsViewModel: () => ({
    organized: [],
    upcoming: [],
    active: [],
    past: [],
    canceled: [],
    isLoading: false,
    error: null,
    activeTab: 'organized',
    setActiveTab: vi.fn(),
    retry: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

describe('MyEventsPage tabs', () => {
  it('renders all five tabs including Active', () => {
    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /organized/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /upcoming/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /active/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /past/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /canceled/i })).toBeDefined();
  });
});
