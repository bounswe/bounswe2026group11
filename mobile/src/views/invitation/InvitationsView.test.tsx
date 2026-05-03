/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InvitationsView from './InvitationsView';
import { useInvitationsViewModel, InvitationsViewModel } from '@/viewmodels/invitation/useInvitationsViewModel';

jest.mock('@/viewmodels/invitation/useInvitationsViewModel');
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('react-native', () => {
  const ReactLocal = require('react');
  const RN = jest.requireActual('react-native');

  const filterRNProps = (props: any) => {
    const {
      onPress,
      accessibilityLabel,
      activeOpacity,
      underlayColor,
      refreshing,
      onRefresh,
      ...rest
    } = props;
    const filtered: any = { ...rest };
    if (onPress) filtered.onClick = onPress;
    if (accessibilityLabel) filtered['aria-label'] = accessibilityLabel;
    return filtered;
  };
  
  return {
    ...RN,
    View: ({ children, ...props }: any) => ReactLocal.createElement('div', filterRNProps(props), children),
    Text: ({ children, ...props }: any) => ReactLocal.createElement('span', filterRNProps(props), children),
    TouchableOpacity: ({ children, ...props }: any) => ReactLocal.createElement('button', filterRNProps(props), children),
    FlatList: ({ data, renderItem, ListEmptyComponent, keyExtractor }: any) => (
      ReactLocal.createElement('div', null, 
        data.length > 0 
          ? data.map((item: any, index: number) => {
              const key = keyExtractor ? keyExtractor(item, index) : index;
              return ReactLocal.createElement('div', { key }, renderItem({ item, index }));
            }) 
          : ListEmptyComponent && (typeof ListEmptyComponent === 'function' ? ReactLocal.createElement(ListEmptyComponent) : ListEmptyComponent)
      )
    ),
    ActivityIndicator: () => ReactLocal.createElement('div', { 'role': 'progressbar' }),
    RefreshControl: () => ReactLocal.createElement('div'),
    StyleSheet: {
      create: (obj: any) => obj,
    },
    Platform: {
      OS: 'ios',
      select: (objs: any) => objs.ios,
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement('div', null, children),
  };
});

jest.mock('@/components/invitation/InvitationCard', () => {
  const ReactLocal = require('react');
  return jest.fn(({ invitation, onAccept, onDecline }: any) => (
    ReactLocal.createElement('div', { 'data-testid': 'invitation-card' }, [
      ReactLocal.createElement('span', { key: 'title' }, invitation.event.title),
      ReactLocal.createElement('span', { key: 'host' }, `Host: ${invitation.host.display_name || invitation.host.username}`),
      invitation.message && ReactLocal.createElement('span', { key: 'message' }, `"${invitation.message}"`),
      ReactLocal.createElement('button', { key: 'accept', onClick: () => onAccept(invitation.invitation_id) }, 'Accept'),
      ReactLocal.createElement('button', { key: 'decline', onClick: () => onDecline(invitation.invitation_id) }, 'Decline'),
    ])
  ));
});

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');
  return {
    MaterialIcons: ({ name }: { name: string }) =>
      ReactLocal.createElement('span', { 'data-icon': name }),
  };
});

const mockUseInvitationsViewModel = jest.mocked(useInvitationsViewModel);

function buildViewModel(overrides: Partial<InvitationsViewModel> = {}): InvitationsViewModel {
  return {
    invitations: [],
    isLoading: false,
    isActionLoading: null,
    error: null,
    fetchInvitations: jest.fn(),
    handleAccept: jest.fn(),
    handleDecline: jest.fn(),
    ...overrides,
  };
}

describe('InvitationsView', () => {
  it('renders loading state', () => {
    mockUseInvitationsViewModel.mockReturnValue(buildViewModel({ isLoading: true }));
    render(<InvitationsView />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('renders empty state when no invitations', () => {
    mockUseInvitationsViewModel.mockReturnValue(buildViewModel({ invitations: [] }));
    render(<InvitationsView />);
    expect(screen.getByText('No invitations yet')).toBeTruthy();
  });

  it('renders list of invitations', () => {
    const invitations = [
      {
        invitation_id: 'inv-1',
        status: 'PENDING' as any,
        event: {
          id: 'evt-1',
          title: 'Secret Party',
          start_time: '2026-05-01T20:00:00Z',
          image_url: null,
        },
        host: {
          username: 'gatsby',
          display_name: 'Jay Gatsby',
          profile_image_url: null,
        },
        message: 'Old Sport!',
        created_at: '2026-05-01T10:00:00Z',
        updated_at: '2026-05-01T10:00:00Z',
      },
    ];
    mockUseInvitationsViewModel.mockReturnValue(buildViewModel({ invitations }));
    render(<InvitationsView />);

    expect(screen.getByText('Secret Party')).toBeTruthy();
    expect(screen.getByText('Host: Jay Gatsby')).toBeTruthy();
    expect(screen.getByText('"Old Sport!"')).toBeTruthy();
  });

  it('triggers accept and decline actions', () => {
    const handleAccept = jest.fn();
    const handleDecline = jest.fn();
    const invitations = [
      {
        invitation_id: 'inv-1',
        status: 'PENDING' as any,
        event: {
          id: 'evt-1',
          title: 'Secret Party',
          start_time: '2026-05-01T20:00:00Z',
          image_url: null,
        },
        host: {
          username: 'gatsby',
          display_name: null,
          profile_image_url: null,
        },
        message: null,
        created_at: '2026-05-01T10:00:00Z',
        updated_at: '2026-05-01T10:00:00Z',
      },
    ];
    mockUseInvitationsViewModel.mockReturnValue(
      buildViewModel({ invitations, handleAccept, handleDecline }),
    );
    render(<InvitationsView />);

    fireEvent.click(screen.getByText('Accept'));
    expect(handleAccept).toHaveBeenCalledWith('inv-1');

    fireEvent.click(screen.getByText('Decline'));
    expect(handleDecline).toHaveBeenCalledWith('inv-1');
  });
});
