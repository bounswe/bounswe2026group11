/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import i18n from '@/i18n';

// 1. Mocks (BEFORE imports)
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: any) => <span data-icon={name} />,
}));

jest.mock('@/viewmodels/notifications/useNotificationsViewModel', () => ({
  useNotificationsViewModel: jest.fn(),
}));

// 2. Imports
import NotificationsView from './NotificationsView';
import { useNotificationsViewModel } from '@/viewmodels/notifications/useNotificationsViewModel';
import { router } from 'expo-router';

const mockUseNotificationsViewModel = jest.mocked(useNotificationsViewModel);
const fixedNow = new Date('2026-05-11T12:00:00.000Z').getTime();

const mockNotifications = [
  {
    id: '1',
    title: 'Today notification',
    created_at: new Date().toISOString(),
    is_read: false,
    type: 'EVENT_CANCELED',
    data: { event_title: 'Test Event' }
  },
];

describe('NotificationsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('renders notifications grouped in sections', () => {
    mockUseNotificationsViewModel.mockReturnValue({
      notifications: mockNotifications as any,
      unreadCount: 1,
      isLoading: false,
      isRefreshing: false,
      refresh: jest.fn(),
      loadMore: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
      removeNotification: jest.fn(),
      apiError: null,
    } as any);

    render(<NotificationsView />);
    
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText(/Test Event/)).toBeTruthy();
  });

  it('renders accepted and declined invitation notification labels', () => {
    mockUseNotificationsViewModel.mockReturnValue({
      notifications: [
        {
          ...mockNotifications[0],
          id: 'accepted',
          type: 'PRIVATE_EVENT_INVITATION_ACCEPTED',
          data: { event_title: 'Sunset Walk', actor_username: 'guest' },
          is_read: true,
        },
        {
          ...mockNotifications[0],
          id: 'declined',
          type: 'PRIVATE_EVENT_INVITATION_DECLINED',
          data: { event_title: 'Sunset Walk', actor_username: 'guest' },
          is_read: true,
        },
      ] as any,
      unreadCount: 0,
      isLoading: false,
      isRefreshing: false,
      refresh: jest.fn(),
      loadMore: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
      removeNotification: jest.fn(),
      apiError: null,
    } as any);

    render(<NotificationsView />);

    expect(screen.getByText('Accepted')).toBeTruthy();
    expect(screen.getByText('Invitation accepted')).toBeTruthy();
    expect(screen.getByText('Declined')).toBeTruthy();
    expect(screen.getByText('Invitation declined')).toBeTruthy();
  });

  it('shows empty state', () => {
    mockUseNotificationsViewModel.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      refresh: jest.fn(),
      apiError: null,
    } as any);

    render(<NotificationsView />);
    expect(screen.getByText('All caught up!')).toBeTruthy();
  });

  it('navigates back', () => {
    mockUseNotificationsViewModel.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      refresh: jest.fn(),
      apiError: null,
    } as any);

    render(<NotificationsView />);
    const backBtn = screen.getByLabelText('Go back');
    fireEvent.click(backBtn);
    expect(router.back).toHaveBeenCalled();
  });

  it('localizes notification relative time in Turkish', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
    await act(async () => {
      await i18n.changeLanguage('tr');
    });
    mockUseNotificationsViewModel.mockReturnValue({
      notifications: [
        {
          ...mockNotifications[0],
          created_at: new Date(fixedNow - 10 * 60 * 60 * 1000).toISOString(),
        },
      ] as any,
      unreadCount: 1,
      isLoading: false,
      isRefreshing: false,
      refresh: jest.fn(),
      loadMore: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
      removeNotification: jest.fn(),
      apiError: null,
    } as any);

    render(<NotificationsView />);

    expect(screen.getByText('10 saat önce')).toBeTruthy();
    expect(screen.queryByText(/ago/)).toBeNull();
  });
});
