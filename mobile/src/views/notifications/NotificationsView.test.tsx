/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

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
});
