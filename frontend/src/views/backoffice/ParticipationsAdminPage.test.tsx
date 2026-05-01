// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ParticipationsAdminPage from './ParticipationsAdminPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'admin-token' }),
}));

vi.mock('@/services/adminService', async () => {
  const actual = await vi.importActual<typeof import('@/services/adminService')>('@/services/adminService');
  return {
    ...actual,
    listAdminParticipations: vi.fn(),
    createAdminParticipation: vi.fn(),
    cancelAdminParticipation: vi.fn(),
  };
});

import {
  cancelAdminParticipation,
  createAdminParticipation,
  listAdminParticipations,
} from '@/services/adminService';

const mockListParticipations = listAdminParticipations as ReturnType<typeof vi.fn>;
const mockCreateParticipation = createAdminParticipation as ReturnType<typeof vi.fn>;
const mockCancelParticipation = cancelAdminParticipation as ReturnType<typeof vi.fn>;

const baseRows = [{
  id: '33333333-3333-4333-8333-333333333333',
  event_id: '11111111-1111-4111-8111-111111111111',
  event_title: 'Launch Party',
  user_id: '22222222-2222-4222-8222-222222222222',
  username: 'alice',
  user_email: 'alice@example.com',
  status: 'APPROVED',
  reconfirmed_at: null,
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
}];

beforeEach(() => {
  vi.clearAllMocks();
  mockListParticipations.mockResolvedValue({
    items: baseRows,
    limit: 25,
    offset: 0,
    total_count: 1,
    has_next: false,
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ParticipationsAdminPage', () => {
  it('creates an approved manual participation and refreshes the table', async () => {
    mockCreateParticipation.mockResolvedValue({
      participation_id: '44444444-4444-4444-8444-444444444444',
      event_id: '11111111-1111-4111-8111-111111111111',
      user_id: '22222222-2222-4222-8222-222222222222',
      status: 'APPROVED',
    });

    render(<ParticipationsAdminPage />);
    await screen.findByText('Launch Party');

    fireEvent.change(screen.getByLabelText('Manual event ID'), { target: { value: '11111111-1111-4111-8111-111111111111' } });
    fireEvent.change(screen.getByLabelText('Manual user ID'), { target: { value: '22222222-2222-4222-8222-222222222222' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create approved participation' }));

    await waitFor(() => expect(mockCreateParticipation).toHaveBeenCalledWith('admin-token', {
      event_id: '11111111-1111-4111-8111-111111111111',
      user_id: '22222222-2222-4222-8222-222222222222',
      status: 'APPROVED',
      reason: null,
    }));
    await waitFor(() => expect(mockListParticipations).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Created participation: 44444444-4444-4444-8444-444444444444')).toBeDefined();
  });

  it('shows create validation and backend failures without refreshing', async () => {
    render(<ParticipationsAdminPage />);
    await screen.findByText('Launch Party');

    fireEvent.change(screen.getByLabelText('Manual event ID'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create approved participation' }));

    expect(await screen.findByText('Event ID must be a valid UUID.')).toBeDefined();
    expect(mockCreateParticipation).not.toHaveBeenCalled();

    mockCreateParticipation.mockRejectedValue(new Error('duplicate active participation'));
    fireEvent.change(screen.getByLabelText('Manual event ID'), { target: { value: '11111111-1111-4111-8111-111111111111' } });
    fireEvent.change(screen.getByLabelText('Manual user ID'), { target: { value: '22222222-2222-4222-8222-222222222222' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create approved participation' }));

    expect(await screen.findByText('Failed to create participation.')).toBeDefined();
    expect(mockListParticipations).toHaveBeenCalledTimes(1);
  });

  it('confirms cancellation, sends the cancel action, and refreshes the table', async () => {
    mockCancelParticipation.mockResolvedValue({
      participation_id: '33333333-3333-4333-8333-333333333333',
      event_id: '11111111-1111-4111-8111-111111111111',
      user_id: '22222222-2222-4222-8222-222222222222',
      status: 'CANCELED',
      already_canceled: false,
    });

    render(<ParticipationsAdminPage />);
    await screen.findByText('Launch Party');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(window.confirm).toHaveBeenCalledWith('Cancel this participation?');
    await waitFor(() => expect(mockCancelParticipation).toHaveBeenCalledWith(
      'admin-token',
      '33333333-3333-4333-8333-333333333333',
    ));
    await waitFor(() => expect(mockListParticipations).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Canceled participation: 33333333-3333-4333-8333-333333333333')).toBeDefined();
  });
});
