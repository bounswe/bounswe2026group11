/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { router } from 'expo-router';
import EditProfileView from './EditProfileView';
import { useEditProfileViewModel } from '@/viewmodels/profile/useEditProfileViewModel';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
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
  };
});

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLocal = require('react');
  return function MockDateTimePicker() {
    return ReactLocal.createElement('div', { 'data-testid': 'datetimepicker' });
  };
});

jest.mock('@/viewmodels/profile/useEditProfileViewModel', () => ({
  GENDER_OPTIONS: [
    { label: 'Male', value: 'MALE' },
    { label: 'Female', value: 'FEMALE' },
  ],
  DISPLAY_NAME_MAX_LENGTH: 64,
  BIO_MAX_LENGTH: 512,
  useEditProfileViewModel: jest.fn(),
}));

const mockUseEditProfileViewModel = jest.mocked(useEditProfileViewModel);

function buildViewModel(overrides: Partial<ReturnType<typeof useEditProfileViewModel>> = {}) {
  return {
    formData: {
      displayName: 'John Doe',
      bio: 'Bio',
      phoneNumber: '+905551112233',
      gender: '',
      birthDate: '',
      defaultLocationAddress: 'Kadikoy, Istanbul, Turkiye',
      defaultLocationLat: 40.9909,
      defaultLocationLon: 29.0293,
    },
    errors: {},
    isLoading: false,
    isSaving: false,
    isUploadingAvatar: false,
    apiError: null,
    imageError: null,
    successMessage: null,
    canEditGender: true,
    canEditBirthDate: true,
    locationQuery: 'Kadikoy, Istanbul, Turkiye',
    locationSuggestions: [],
    isSearchingLocation: false,
    selectedImageUri: null,
    updateField: jest.fn(),
    pickAvatar: jest.fn(),
    removeAvatar: jest.fn(),
    updateLocationQuery: jest.fn(),
    selectLocationSuggestion: jest.fn(),
    clearLocation: jest.fn(),
    handleSave: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('EditProfileView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('replaces to the profile tab after a successful save', async () => {
    const handleSave = jest.fn().mockResolvedValue(true);
    mockUseEditProfileViewModel.mockReturnValue(
      buildViewModel({ handleSave }) as ReturnType<typeof useEditProfileViewModel>,
    );

    render(<EditProfileView />);

    fireEvent.click(screen.getByLabelText('Save profile'));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith('/(tabs)/profile');
    });
  });

  it('does not navigate away when save fails', async () => {
    const handleSave = jest.fn().mockResolvedValue(false);
    mockUseEditProfileViewModel.mockReturnValue(
      buildViewModel({ handleSave }) as ReturnType<typeof useEditProfileViewModel>,
    );

    render(<EditProfileView />);

    fireEvent.click(screen.getByLabelText('Save profile'));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    expect(router.replace).not.toHaveBeenCalled();
  });
});
