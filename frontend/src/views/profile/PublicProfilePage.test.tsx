// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PublicProfile } from '@/models/profile';
import PublicProfilePage from './PublicProfilePage';

const mockUsePublicProfileViewModel = vi.fn();

vi.mock('../../viewmodels/profile/usePublicProfileViewModel', () => ({
  usePublicProfileViewModel: (...args: unknown[]) => mockUsePublicProfileViewModel(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makePublicProfile(): PublicProfile {
  return {
    user_id: 'user-1',
    username: 'summitseeker',
    display_name: 'Summit Seeker',
    avatar_url: null,
    bio: 'Weekend hiker and route planner.',
    final_score: 4.8,
    host_rating_count: 7,
    participant_rating_count: 3,
    equipment: [
      {
        id: 'equipment-1',
        name: 'Trail Shoes',
        description: 'Reliable grip for mixed terrain.',
        image_url: null,
      },
    ],
    showcase_images: [
      {
        id: 'showcase-1',
        image_url: 'https://cdn.example.com/showcase-1.jpg',
      },
    ],
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/users/user-1']}>
      <Routes>
        <Route path="/users/:userId" element={<PublicProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicProfilePage', () => {
  it('renders public profile sections without private account fields', () => {
    mockUsePublicProfileViewModel.mockReturnValue({
      profile: makePublicProfile(),
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('Summit Seeker')).toBeDefined();
    expect(screen.getByText('@summitseeker')).toBeDefined();
    expect(screen.getByText(/weekend hiker and route planner/i)).toBeDefined();
    expect(screen.getByText('Trail Shoes')).toBeDefined();
    expect(screen.queryByText(/email/i)).toBeNull();
    expect(screen.queryByText(/default location/i)).toBeNull();
  });

  it('renders a loading state while the profile is being fetched', () => {
    mockUsePublicProfileViewModel.mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
      retry: vi.fn(),
    });

    renderPage();

    expect(screen.getByText(/loading profile/i)).toBeDefined();
  });

  it('renders an error state and retries when requested', () => {
    const retry = vi.fn();
    mockUsePublicProfileViewModel.mockReturnValue({
      profile: null,
      isLoading: false,
      error: 'Profile not found.',
      retry,
    });

    renderPage();

    expect(screen.getByText(/profile not found/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(retry).toHaveBeenCalled();
  });
});
