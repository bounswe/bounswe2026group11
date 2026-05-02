/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useInvitationsViewModel } from './useInvitationsViewModel';
import { useAuth } from '@/contexts/AuthContext';
import * as invitationService from '@/services/invitationService';
import { ApiError } from '@/services/api';

jest.mock('@/contexts/AuthContext');
jest.mock('@/services/invitationService');
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  },
}));

const mockUseAuth = jest.mocked(useAuth);
const mockInvitationService = jest.mocked(invitationService);

describe('useInvitationsViewModel', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: mockToken,
      refreshToken: 'refresh',
      user: {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        phone_number: null,
        email_verified: true,
        status: 'ACTIVE',
      },
      setSession: jest.fn(),
      clearAuth: jest.fn(),
      isHydrating: false,
    });
  });

  it('fetches invitations on mount', async () => {
    const mockInvitations = {
      items: [
        {
          invitation_id: 'inv-1',
          status: 'PENDING',
          event: { title: 'Private Event', start_time: '2026-05-01T10:00:00Z' },
          host: { username: 'host1' },
          created_at: '2026-05-01T10:00:00Z',
        },
      ],
    };
    mockInvitationService.listMyInvitations.mockResolvedValue(mockInvitations as any);

    const { result } = renderHook(() => useInvitationsViewModel());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {}); // Wait for useEffect

    expect(result.current.isLoading).toBe(false);
    expect(result.current.invitations).toHaveLength(1);
    expect(result.current.invitations[0].invitation_id).toBe('inv-1');
  });

  it('handles errors during fetch', async () => {
    mockInvitationService.listMyInvitations.mockRejectedValue(
      new ApiError(400, { error: { code: 'load_failed', message: 'Failed to load' } }),
    );

    const { result } = renderHook(() => useInvitationsViewModel());

    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Failed to load');
  });

  it('removes invitation from list after successful accept', async () => {
    const mockInvitations = {
      items: [
        { invitation_id: 'inv-1', status: 'PENDING', event: { title: 'E1' }, host: { username: 'h1' } },
      ],
    };
    mockInvitationService.listMyInvitations.mockResolvedValue(mockInvitations as any);
    mockInvitationService.acceptInvitation.mockResolvedValue({} as any);

    const { result } = renderHook(() => useInvitationsViewModel());

    await act(async () => {});

    expect(result.current.invitations).toHaveLength(1);

    await act(async () => {
      await result.current.handleAccept('inv-1');
    });

    expect(result.current.invitations).toHaveLength(0);
    expect(mockInvitationService.acceptInvitation).toHaveBeenCalledWith('inv-1', mockToken);
  });

  it('removes invitation from list after successful decline', async () => {
    const mockInvitations = {
      items: [
        { invitation_id: 'inv-1', status: 'PENDING', event: { title: 'E1' }, host: { username: 'h1' } },
      ],
    };
    mockInvitationService.listMyInvitations.mockResolvedValue(mockInvitations as any);
    mockInvitationService.declineInvitation.mockResolvedValue({} as any);

    const { result } = renderHook(() => useInvitationsViewModel());

    await act(async () => {});

    await act(async () => {
      await result.current.handleDecline('inv-1');
    });

    expect(result.current.invitations).toHaveLength(0);
    expect(mockInvitationService.declineInvitation).toHaveBeenCalledWith('inv-1', mockToken);
  });
});
