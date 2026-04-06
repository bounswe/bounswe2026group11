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
    activeTab: 'active',
    setActiveTab: vi.fn(),
    retry: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

describe('MyEventsPage tabs', () => {
  it('renders tabs in the updated order with Hosted label', () => {
    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    const tabs = screen.getAllByRole('button');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'In Progress0',
      'Upcoming0',
      'Hosted0',
      'Past0',
      'Canceled0',
    ]);
  });
});
