/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import CreateEventView from './CreateEventView';
import { jest } from '@jest/globals';
import {
  formatDateForForm,
  type CreateEventViewModel,
} from '@/viewmodels/event/useCreateEventViewModel';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateEventViewModel } from '@/viewmodels/event/useCreateEventViewModel';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native') as any;
  const ReactLocal = require('react');
  return {
    ...actual,
    Switch: ({ trackColor, onValueChange, value, accessibilityLabel, ...props }: any) =>
      ReactLocal.createElement('input', {
        type: 'checkbox',
        checked: value,
        'aria-label': accessibilityLabel,
        onChange: (e: any) => onValueChange?.(e.target.checked),
        ...props,
      }),
  };
});

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      ReactLocal.createElement('div', { 'data-testid': 'SafeAreaView', style }, children),
  };
});

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');
  return {
    MaterialIcons: ({ name }: { name: string }) =>
      ReactLocal.createElement('span', { 'data-icon': name }),
    Ionicons: ({ name }: { name: string }) =>
      ReactLocal.createElement('span', { 'data-icon': name }),
    Feather: ({ name }: { name: string }) =>
      ReactLocal.createElement('span', { 'data-icon': name }),
  };
});

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLocal = require('react');
  return function MockDateTimePicker(props: {
    mode: 'date' | 'time';
    minimumDate?: Date;
    themeVariant?: 'dark' | 'light';
    textColor?: string;
    accentColor?: string;
    onChange?: unknown;
    onValueChange?: unknown;
    onDismiss?: unknown;
  }) {
    return ReactLocal.createElement('div', {
      'data-testid': `datetimepicker-${props.mode}`,
      'data-minimum-date': props.minimumDate?.toISOString() ?? '',
      'data-theme-variant': props.themeVariant ?? '',
      'data-text-color': props.textColor ?? '',
      'data-accent-color': props.accentColor ?? '',
      'data-has-on-change': String(Boolean(props.onChange)),
      'data-has-on-value-change': String(Boolean(props.onValueChange)),
      'data-has-on-dismiss': String(Boolean(props.onDismiss)),
    });
  };
});

jest.mock('@/components/events/PointPickerMap', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'PointPickerMap' });
});

jest.mock('@/components/events/RoutePointsEditor', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'RoutePointsEditor' });
});

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/viewmodels/event/useCreateEventViewModel', () => {
  const actual = jest.requireActual('@/viewmodels/event/useCreateEventViewModel') as Record<string, unknown>;
  return {
    ...actual,
    useCreateEventViewModel: jest.fn(),
  };
});

const mockUseAuth = jest.mocked(useAuth);
const mockUseCreateEventViewModel = jest.mocked(useCreateEventViewModel);

const createdEventResponse = {
  id: 'event-1',
  title: 'Created Event',
  privacy_level: 'PUBLIC',
  status: 'ACTIVE',
  start_time: '2027-05-10T10:00:00Z',
  created_at: '2026-05-01T10:00:00Z',
};

function buildViewModel(
  partial: Partial<CreateEventViewModel> = {},
): CreateEventViewModel {
  return {
    formData: {
      title: '',
      description: '',
      imageUrl: '',
      categoryId: null,
      locationType: 'POINT',
      locationQuery: '',
      address: '',
      lat: null,
      lon: null,
      routePoints: [],
      startDate: formatDateForForm(new Date()),
      startTime: '',
      endDate: '',
      endTime: '',
      privacyLevel: 'PUBLIC',
      tags: [],
      tagInput: '',
      constraints: [],
      constraintType: 'gender',
      genderConstraintValue: null,
      ageMinInput: '',
      ageMaxInput: '',
      capacityInput: '',
      otherConstraintInput: '',
      invitationMessage: '',
      childFriendly: false,
      familyOriented: false,
    },
    errors: {},
    isLoading: false,
    isUploadingImage: false,
    apiError: null,
    imageError: null,
    successMessage: null,
    imageUploadSuccessMessage: null,
    selectedImageUri: null,
    locationSuggestions: [],
    isSearchingLocation: false,
    categoriesExpanded: false,
    constraintTypeCounts: { gender: 0, age: 0, capacity: 0, other: 0 },
    updateField: jest.fn(),
    handleLocationSearch: jest.fn(),
    selectLocation: jest.fn(),
    clearLocation: jest.fn(),
    setLocationType: jest.fn(),
    setPointFromCoordinate: jest.fn(),
    addRoutePointFromCoordinate: jest.fn(),
    addRoutePointFromSuggestion: jest.fn(),
    removeRoutePoint: jest.fn(),
    moveRoutePoint: jest.fn(),
    updateRoutePointLabel: jest.fn(),
    toggleCategoriesExpanded: jest.fn(),
    addTag: jest.fn(),
    removeTag: jest.fn(),
    addGenderConstraint: jest.fn(),
    addConstraint: jest.fn(),
    removeConstraint: jest.fn(),
    pickImage: jest.fn<CreateEventViewModel['pickImage']>().mockResolvedValue(undefined),
    removeImage: jest.fn(),
    invitedUsers: [],
    userSearchQuery: '',
    userSuggestions: [],
    isSearchingUsers: false,
    addInvitedUser: jest.fn(),
    removeInvitedUser: jest.fn(),
    handleUserSearch: jest.fn(),
    pickAndParseUserFile: jest
      .fn<CreateEventViewModel['pickAndParseUserFile']>()
      .mockResolvedValue(undefined),
    handleSubmit: jest.fn<CreateEventViewModel['handleSubmit']>().mockResolvedValue(null),
    ...partial,
  };
}

describe('CreateEventView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
    (router.canGoBack as jest.Mock).mockReturnValue(true);
    mockUseAuth.mockReturnValue({
      token: 'token',
      login: jest.fn(),
      register: jest.fn(),
      forgotPassword: jest.fn(),
      isLoading: false,
      isAuthenticated: true,
      user: null,
    } as any);
  });

  it('renders picker-based date and time controls with image upload messaging', () => {
    mockUseCreateEventViewModel.mockReturnValue(
      buildViewModel({
        imageError: 'The event was created, but uploading the image to storage failed.',
      }),
    );

    render(<CreateEventView />);

    expect(screen.getByLabelText('Pick start date')).toBeTruthy();
    expect(screen.getByLabelText('Pick start time')).toBeTruthy();
    expect(screen.getByLabelText('Pick end date')).toBeTruthy();
    expect(screen.getByLabelText('Pick end time')).toBeTruthy();
    expect(screen.getByText(formatDateForForm(new Date()))).toBeTruthy();
    expect(screen.queryByPlaceholderText('HH:mm')).toBeNull();
    expect(
      screen.getByText('The event was created, but uploading the image to storage failed.'),
    ).toBeTruthy();
  });

  it('lets Android handle keyboard resizing without shrinking the React tree', () => {
    (Platform as any).OS = 'android';
    mockUseCreateEventViewModel.mockReturnValue(buildViewModel());

    render(<CreateEventView />);

    expect(screen.getByTestId('create-event-keyboard-avoider').getAttribute('behavior')).toBeNull();
  });

  it('opens the start pickers and allows today as the minimum date', () => {
    mockUseCreateEventViewModel.mockReturnValue(buildViewModel());

    render(<CreateEventView />);

    fireEvent.click(screen.getByLabelText('Pick start date'));

    const datePicker = screen.getByTestId('datetimepicker-date');
    const minimumDate = new Date(datePicker.getAttribute('data-minimum-date') ?? '');
    const expected = new Date();
    expected.setHours(0, 0, 0, 0);

    expect(minimumDate.getTime()).toBe(expected.getTime());
    expect(datePicker.getAttribute('data-theme-variant')).toBe('light');
    expect(datePicker.getAttribute('data-text-color')).toBe('#0F172A');
    expect(datePicker.getAttribute('data-accent-color')).toBe('#2563EB');
    expect(datePicker.getAttribute('data-has-on-change')).toBe('true');
    expect(datePicker.getAttribute('data-has-on-value-change')).toBe('false');
    expect(datePicker.getAttribute('data-has-on-dismiss')).toBe('false');

    fireEvent.click(screen.getByLabelText('Pick start time'));

    expect(screen.queryByTestId('datetimepicker-date')).toBeNull();
    expect(screen.getByTestId('datetimepicker-time')).toBeTruthy();
  });

  it('uses the selected start date as the inclusive minimum for end date picker', () => {
    mockUseCreateEventViewModel.mockReturnValue(
      buildViewModel({
        formData: {
          ...buildViewModel().formData,
          startDate: '04.04.2026',
        },
      }),
    );

    render(<CreateEventView />);

    fireEvent.click(screen.getByLabelText('Pick end date'));

    const datePicker = screen.getByTestId('datetimepicker-date');
    const minimumDate = new Date(datePicker.getAttribute('data-minimum-date') ?? '');
    const expected = new Date(2026, 3, 4);
    expected.setHours(0, 0, 0, 0);

    expect(minimumDate.getTime()).toBe(expected.getTime());
  });

  it('clears optional end date and time together from the screen action', () => {
    const updateField = jest.fn();
    mockUseCreateEventViewModel.mockReturnValue(
      buildViewModel({
        updateField,
        formData: {
          ...buildViewModel().formData,
          endDate: '05.04.2026',
          endTime: '10:00',
        },
      }),
    );

    render(<CreateEventView />);

    fireEvent.click(screen.getByLabelText('Clear end date and time'));

    expect(updateField).toHaveBeenNthCalledWith(1, 'endDate', '');
    expect(updateField).toHaveBeenNthCalledWith(2, 'endTime', '');
  });

  it('renders correct helper text for each privacy level', () => {
    // 1. PUBLIC (Default)
    const { rerender } = render(<CreateEventView />);
    expect(screen.getByText(/Visible to everyone. Anyone can join without approval./i)).toBeTruthy();

    // 2. PROTECTED
    mockUseCreateEventViewModel.mockReturnValue(
      buildViewModel({
        formData: {
          ...buildViewModel().formData,
          privacyLevel: 'PROTECTED',
        },
      }),
    );
    rerender(<CreateEventView />);
    expect(screen.getByText(/Visible to everyone, but people must send a join request and wait for your approval./i)).toBeTruthy();

    // 3. PRIVATE
    mockUseCreateEventViewModel.mockReturnValue(
      buildViewModel({
        formData: {
          ...buildViewModel().formData,
          privacyLevel: 'PRIVATE',
        },
      }),
    );
    rerender(<CreateEventView />);
    expect(screen.getByText(/Only visible to invited users. People can join only if you invite them./i)).toBeTruthy();
  });

  it('allows toggling audience attributes', () => {
    const updateField = jest.fn();
    mockUseCreateEventViewModel.mockReturnValue(
      buildViewModel({
        updateField,
        formData: {
          ...buildViewModel().formData,
          childFriendly: false,
          familyOriented: false,
        },
      }),
    );

    render(<CreateEventView />);

    const childFriendlyToggle = screen.getByLabelText('Child Friendly');
    const familyOrientedToggle = screen.getByLabelText('Family Oriented');

    fireEvent.click(childFriendlyToggle);
    expect(updateField).toHaveBeenCalledWith('childFriendly', true);

    fireEvent.click(familyOrientedToggle);
    expect(updateField).toHaveBeenCalledWith('familyOriented', true);
  });

  it('returns to the previous screen after creating an event successfully', async () => {
    const handleSubmit = jest
      .fn<CreateEventViewModel['handleSubmit']>()
      .mockResolvedValue(createdEventResponse as any);
    (router.canGoBack as jest.Mock).mockReturnValue(true);
    mockUseCreateEventViewModel.mockReturnValue(buildViewModel({ handleSubmit }));

    render(<CreateEventView />);

    fireEvent.click(screen.getByLabelText('Create event'));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledWith('token'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('falls back to home after creation when there is no previous screen', async () => {
    const handleSubmit = jest
      .fn<CreateEventViewModel['handleSubmit']>()
      .mockResolvedValue(createdEventResponse as any);
    (router.canGoBack as jest.Mock).mockReturnValue(false);
    mockUseCreateEventViewModel.mockReturnValue(buildViewModel({ handleSubmit }));

    render(<CreateEventView />);

    fireEvent.click(screen.getByLabelText('Create event'));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledWith('token'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)/home'));
    expect(router.back).not.toHaveBeenCalled();
  });
});
