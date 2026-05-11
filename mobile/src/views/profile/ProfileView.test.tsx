/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Keyboard } from 'react-native';
import { router } from 'expo-router';
import ProfileView from './ProfileView';
import { useAuth } from '@/contexts/AuthContext';
import { useLogoutViewModel } from '@/viewmodels/auth/useLogoutViewModel';
import { usePushNotificationPreference } from '@/viewmodels/notifications/usePushNotificationPreference';
import { useProfileViewModel, type ProfileViewModel } from '@/viewmodels/profile/useProfileViewModel';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/contexts/LocaleContext', () => ({
  useLocale: () => ({
    locale: 'en',
    isHydrating: false,
    setLocale: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('@/viewmodels/auth/useLogoutViewModel', () => ({
  useLogoutViewModel: jest.fn(),
}));

jest.mock('@/viewmodels/notifications/usePushNotificationPreference', () => ({
  usePushNotificationPreference: jest.fn(),
}));

jest.mock('@/viewmodels/profile/useProfileViewModel', () => ({
  useProfileViewModel: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement('div', null, children),
  };
});

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');
  return {
    Ionicons: ({ name }: { name: string }) =>
      ReactLocal.createElement('span', { 'data-icon': name }),
  };
});

jest.mock('@/components/invitation/InvitationCard', () => {
  const ReactLocal = require('react');
  return ({ invitation, onAccept, onDecline, compact }: any) =>
    ReactLocal.createElement('div', { 'data-testid': 'profile-invitation-card', 'data-compact': String(Boolean(compact)) }, [
      ReactLocal.createElement('span', { key: 'title' }, invitation.event.title),
      ReactLocal.createElement(
        'button',
        { key: 'accept', onClick: () => onAccept(invitation.invitation_id) },
        'Accept invitation',
      ),
      ReactLocal.createElement(
        'button',
        { key: 'decline', onClick: () => onDecline(invitation.invitation_id) },
        'Decline invitation',
      ),
    ]);
});

jest.mock('@/components/profile/BadgeList', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', null, 'Badges mock');
});

jest.mock('@/components/profile/EquipmentList', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', null, 'Equipment mock');
});

jest.mock('@/components/profile/ShowcaseImageGrid', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', null, 'Showcase mock');
});

jest.mock('@/components/profile/ProfileEventCard', () => {
  const ReactLocal = require('react');
  return ({ title }: { title: string }) => ReactLocal.createElement('div', null, title);
});

const mockUseAuth = jest.mocked(useAuth);
const mockUseLogoutViewModel = jest.mocked(useLogoutViewModel);
const mockUsePushNotificationPreference = jest.mocked(usePushNotificationPreference);
const mockUseProfileViewModel = jest.mocked(useProfileViewModel);

function buildViewModel(overrides: Partial<ProfileViewModel> = {}): ProfileViewModel {
  return {
    profile: {
      id: 'user-1',
      username: 'john_doe',
      email: 'john@example.com',
      phone_number: '+905551112233',
      gender: 'MALE',
      birth_date: '1998-05-14',
      email_verified: true,
      status: 'active',
      default_location_address: 'Istanbul, Turkey',
      default_location_lat: 41.0082,
      default_location_lon: 28.9784,
      display_name: 'John Doe',
      bio: null,
      avatar_url: null,
      final_score: 4.2,
      host_score: null,
      participant_score: null,
      equipment: [],
      showcase_images: [],
      badges: [],
      locale: 'en',
    },
    isLoading: false,
    isUploadingAvatar: false,
    apiError: null,
    imageError: null,
    imageUploadSuccessMessage: null,
    primaryName: 'John Doe',
    secondaryName: 'john_doe',
    avatarInitial: 'J',
    overallRatingLabel: '4.2',
    hostRatingLabel: 'New',
    participantRatingLabel: 'New',
    hostedEvents: [
      {
        id: 'hosted-1',
        title: 'Hosted Event',
        start_time: '2026-05-10T10:00:00Z',
        end_time: null,
        image_url: null,
        category_label: 'Social',
        status: 'IN_PROGRESS',
        privacy_level: 'PUBLIC',
      },
    ],
    attendedEvents: [],
    hostedCount: 1,
    attendedCount: 0,
    equipment: [],
    invitations: [
      {
        invitation_id: 'inv-1',
        status: 'PENDING',
        event: {
          id: 'event-1',
          title: 'Private Picnic',
          start_time: '2026-05-12T10:00:00Z',
          image_url: null,
        },
        host: {
          username: 'host_user',
          display_name: 'Host User',
          profile_image_url: null,
        },
        message: null,
        created_at: '2026-05-01T10:00:00Z',
        updated_at: '2026-05-01T10:00:00Z',
      },
    ],
    invitationCount: 1,
    badges: [],
    showcaseImages: [],
    isActionLoading: false,
    isInvitationActionLoading: null,
    invitationError: null,
    catalogVisible: false,
    setCatalogVisible: jest.fn(),
    pickAvatar: jest.fn(),
    refresh: jest.fn().mockResolvedValue(undefined),
    handleAcceptInvitation: jest.fn().mockResolvedValue(undefined),
    handleDeclineInvitation: jest.fn().mockResolvedValue(undefined),
    addEquipment: jest.fn().mockResolvedValue(undefined),
    editEquipment: jest.fn().mockResolvedValue(undefined),
    removeEquipment: jest.fn().mockResolvedValue(undefined),
    uploadShowcaseImage: jest.fn().mockResolvedValue(undefined),
    removeShowcaseImage: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ProfileView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: 'token',
      refreshToken: 'refresh',
      user: null,
      setSession: jest.fn(),
      clearAuth: jest.fn(),
    } as any);
    mockUseLogoutViewModel.mockReturnValue({
      isLoggingOut: false,
      logoutError: null,
      handleLogout: jest.fn(),
    });
    mockUsePushNotificationPreference.mockReturnValue({
      pushNotificationsEnabled: true,
      isHydrating: false,
      isSaving: false,
      errorMessage: null,
      setPushNotificationsEnabled: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('renders invitations as a profile section with actions', () => {
    const handleAcceptInvitation = jest.fn().mockResolvedValue(undefined);
    const handleDeclineInvitation = jest.fn().mockResolvedValue(undefined);
    mockUseProfileViewModel.mockReturnValue(
      buildViewModel({ handleAcceptInvitation, handleDeclineInvitation }),
    );

    render(<ProfileView />);

    expect(screen.getByText('Invitations')).toBeTruthy();
    expect(screen.getByText('Private Picnic')).toBeTruthy();
    expect(screen.getByTestId('profile-invitation-card').getAttribute('data-compact')).toBe('true');

    fireEvent.click(screen.getByText('Accept invitation'));
    expect(handleAcceptInvitation).toHaveBeenCalledWith('inv-1');

    fireEvent.click(screen.getByText('Decline invitation'));
    expect(handleDeclineInvitation).toHaveBeenCalledWith('inv-1');
  });

  it('previews only one invitation on profile and links to the full invitations page', () => {
    const secondInvitation = {
      ...buildViewModel().invitations[0],
      invitation_id: 'inv-2',
      event: {
        id: 'event-2',
        title: 'Second Private Event',
        start_time: '2026-05-13T10:00:00Z',
        image_url: null,
      },
    };
    mockUseProfileViewModel.mockReturnValue(
      buildViewModel({
        invitations: [...buildViewModel().invitations, secondInvitation],
        invitationCount: 2,
      }),
    );

    render(<ProfileView />);

    expect(screen.getByText('Private Picnic')).toBeTruthy();
    expect(screen.queryByText('Second Private Event')).toBeNull();

    fireEvent.click(screen.getByLabelText('View all invitations'));
    expect(router.push).toHaveBeenCalledWith('/profile/invitations');
  });

  it('dismisses the keyboard when tapping the equipment modal surface', () => {
    mockUseProfileViewModel.mockReturnValue(buildViewModel());

    render(<ProfileView />);

    fireEvent.click(screen.getByLabelText('Add Equipment'));
    fireEvent.click(screen.getByTestId('equipment-modal-dismiss-layer'));

    expect(Keyboard.dismiss).toHaveBeenCalled();
  });
});
