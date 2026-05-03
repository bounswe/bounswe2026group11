/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CreateEventView from './CreateEventView';
import {
  formatDateForForm,
  type CreateEventViewModel,
} from '@/viewmodels/event/useCreateEventViewModel';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateEventViewModel } from '@/viewmodels/event/useCreateEventViewModel';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
  },
}));

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
    onChange?: unknown;
    onValueChange?: unknown;
    onDismiss?: unknown;
  }) {
    return ReactLocal.createElement('div', {
      'data-testid': `datetimepicker-${props.mode}`,
      'data-minimum-date': props.minimumDate?.toISOString() ?? '',
      'data-has-on-change': String(Boolean(props.onChange)),
      'data-has-on-value-change': String(Boolean(props.onValueChange)),
      'data-has-on-dismiss': String(Boolean(props.onDismiss)),
    });
  };
});

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/viewmodels/event/useCreateEventViewModel', () => {
  const actual = jest.requireActual('@/viewmodels/event/useCreateEventViewModel');
  return {
    ...actual,
    useCreateEventViewModel: jest.fn(),
  };
});

const mockUseAuth = jest.mocked(useAuth);
const mockUseCreateEventViewModel = jest.mocked(useCreateEventViewModel);

function buildViewModel(
  partial: Partial<CreateEventViewModel> = {},
): CreateEventViewModel {
  return {
    formData: {
      title: '',
      description: '',
      imageUrl: '',
      categoryId: null,
      locationQuery: '',
      address: '',
      lat: null,
      lon: null,
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
    toggleCategoriesExpanded: jest.fn(),
    addTag: jest.fn(),
    removeTag: jest.fn(),
    addGenderConstraint: jest.fn(),
    addConstraint: jest.fn(),
    removeConstraint: jest.fn(),
    pickImage: jest.fn(),
    removeImage: jest.fn(),
    invitedUsers: [],
    userSearchQuery: '',
    userSuggestions: [],
    isSearchingUsers: false,
    addInvitedUser: jest.fn(),
    removeInvitedUser: jest.fn(),
    handleUserSearch: jest.fn(),
    pickAndParseUserFile: jest.fn(),
    handleSubmit: jest.fn(),
    ...partial,
  };
}

describe('CreateEventView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('opens the start pickers and allows today as the minimum date', () => {
    mockUseCreateEventViewModel.mockReturnValue(buildViewModel());

    render(<CreateEventView />);

    fireEvent.click(screen.getByLabelText('Pick start date'));

    const datePicker = screen.getByTestId('datetimepicker-date');
    const minimumDate = new Date(datePicker.getAttribute('data-minimum-date') ?? '');
    const expected = new Date();
    expected.setHours(0, 0, 0, 0);

    expect(minimumDate.getTime()).toBe(expected.getTime());
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
});
