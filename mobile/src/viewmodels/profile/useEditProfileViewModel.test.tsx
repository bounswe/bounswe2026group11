/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import * as profileService from '@/services/profileService';
import * as eventService from '@/services/eventService';
import { ApiError } from '@/services/api';
import type { UserProfile } from '@/models/profile';
import { useEditProfileViewModel } from './useEditProfileViewModel';

jest.mock('@/services/profileService');
jest.mock('@/services/eventService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';

const mockGetMyProfile = jest.mocked(profileService.getMyProfile);
const mockUpdateMyProfile = jest.mocked(profileService.updateMyProfile);
const mockSearchLocation = jest.mocked(eventService.searchLocation);
const mockUseAuth = jest.mocked(useAuth);

const profileFixture: UserProfile = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  username: 'john_doe',
  email: 'john@example.com',
  phone_number: '+905551112233',
  gender: 'MALE',
  birth_date: '1998-05-14',
  email_verified: true,
  status: 'active',
  default_location_address: 'İstanbul, Turkey',
  default_location_lat: 41.0082,
  default_location_lon: 28.9784,
  display_name: 'John Doe',
  bio: 'Software developer based in Istanbul.',
  avatar_url: 'https://example.com/avatars/john.jpg',
  created_events: [],
  attended_events: [],
};

describe('useEditProfileViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: 'test-token',
      refreshToken: 'refresh',
      user: null,
      setSession: jest.fn(),
      clearAuth: jest.fn(),
    } as any);
    mockGetMyProfile.mockResolvedValue(profileFixture);
    mockUpdateMyProfile.mockResolvedValue(undefined);
    mockSearchLocation.mockResolvedValue([
      {
        display_name: 'Kadikoy, Istanbul, Turkiye',
        lat: '40.9909',
        lon: '29.0293',
      },
    ]);
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useEditProfileViewModel());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isSaving).toBe(false);
  });

  it('populates form fields from fetched profile', async () => {
    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.formData.displayName).toBe('John Doe');
    expect(result.current.formData.bio).toBe(
      'Software developer based in Istanbul.',
    );
    expect(result.current.formData.phoneNumber).toBe('+905551112233');
    expect(result.current.formData.gender).toBe('MALE');
    expect(result.current.formData.birthDate).toBe('14.05.1998');
    expect(result.current.formData.defaultLocationAddress).toBe('İstanbul, Turkey');
    expect(result.current.formData.defaultLocationLat).toBe(41.0082);
    expect(result.current.formData.defaultLocationLon).toBe(28.9784);
    expect(result.current.canEditGender).toBe(false);
    expect(result.current.canEditBirthDate).toBe(false);
  });

  it('populates empty strings when profile fields are null', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...profileFixture,
      display_name: null,
      bio: null,
      phone_number: null,
      gender: null,
      birth_date: null,
      default_location_address: null,
      default_location_lat: null,
      default_location_lon: null,
    });

    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.formData.displayName).toBe('');
    expect(result.current.formData.bio).toBe('');
    expect(result.current.formData.phoneNumber).toBe('');
    expect(result.current.formData.gender).toBe('');
    expect(result.current.formData.birthDate).toBe('');
    expect(result.current.formData.defaultLocationAddress).toBe('');
    expect(result.current.formData.defaultLocationLat).toBeNull();
    expect(result.current.formData.defaultLocationLon).toBeNull();
    expect(result.current.canEditGender).toBe(true);
    expect(result.current.canEditBirthDate).toBe(true);
  });

  it('updates default location from location search selection', async () => {
    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.openLocationModal();
    });

    await act(async () => {
      await result.current.updateLocationQuery('Kadikoy');
    });

    act(() => {
      result.current.selectLocationSuggestion({
        display_name: 'Kadikoy, Istanbul, Turkiye',
        lat: '40.9909',
        lon: '29.0293',
      });
    });

    act(() => {
      result.current.applySelectedLocation();
    });

    expect(result.current.formData.defaultLocationAddress).toBe(
      'Kadikoy, Istanbul, Turkiye',
    );
    expect(result.current.formData.defaultLocationLat).toBe(40.9909);
    expect(result.current.formData.defaultLocationLon).toBe(29.0293);
  });

  it('omits locked gender and birth date from the update payload', async () => {
    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = false;
    await act(async () => {
      success = await result.current.handleSave();
    });

    expect(success).toBe(true);
    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      {
        display_name: 'John Doe',
        bio: 'Software developer based in Istanbul.',
        phone_number: '+905551112233',
        default_location_address: 'İstanbul, Turkey',
        default_location_lat: 41.0082,
        default_location_lon: 28.9784,
      },
      'test-token',
    );
  });

  it('updates a field and clears its error', async () => {
    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateField('displayName', 'New Name');
    });

    expect(result.current.formData.displayName).toBe('New Name');
    expect(result.current.errors.displayName).toBeNull();
  });

  it('validates birth date format on save', async () => {
    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateField('birthDate', '01.01.20');
    });

    let success: boolean = true;
    await act(async () => {
      success = await result.current.handleSave();
    });

    expect(success).toBe(false);
    expect(result.current.errors.birthDate).toBe('Use dd.mm.yyyy format');
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });

  it('triggers immediate error for day > 31', async () => {
    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateField('birthDate', '32');
    });
    expect(result.current.errors.birthDate).toBe('Day must be between 01 and 31.');

    act(() => {
      result.current.updateField('birthDate', '31');
    });
    expect(result.current.errors.birthDate).toBeNull();
  });

  it('triggers immediate error for month > 12', async () => {
    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateField('birthDate', '01.13');
    });
    expect(result.current.errors.birthDate).toBe('Month must be between 01 and 12.');

    act(() => {
      result.current.updateField('birthDate', '01.12');
    });
    expect(result.current.errors.birthDate).toBeNull();
  });

  it('validates month limit (1–12)', async () => {
    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateField('birthDate', '01.13.2000');
    });

    let success: boolean = true;
    await act(async () => {
      success = await result.current.handleSave();
    });

    expect(success).toBe(false);
    expect(result.current.errors.birthDate).toBe('Month must be between 01 and 12.');
  });

  it('validates future date limit', async () => {
    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const nextYear = new Date().getFullYear() + 1;
    act(() => {
      result.current.updateField('birthDate', `01.01.${nextYear}`);
    });

    // Real-time validation should have triggered the error
    expect(result.current.errors.birthDate).toBe('Birth date cannot be in the future');

    let success: boolean = true;
    await act(async () => {
      success = await result.current.handleSave();
    });

    expect(success).toBe(false);
  });

  it('validates birth date in real-time when 10 characters are reached', async () => {
    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Partial typing - no error yet
    act(() => {
      result.current.updateField('birthDate', '30.02.');
    });
    expect(result.current.errors.birthDate).toBeNull();

    // Reached 10 chars - invalid day for February
    act(() => {
      result.current.updateField('birthDate', '30.02.2024');
    });
    expect(result.current.errors.birthDate).toBe('Please give a valid birth date');

    // Correct it - error should clear
    act(() => {
      result.current.updateField('birthDate', '29.02.2024');
    });
    expect(result.current.errors.birthDate).toBeNull();
  });

  it('auto-formats birth date typing into dd.mm.yyyy', async () => {
    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateField('birthDate', '1405');
    });
    expect(result.current.formData.birthDate).toBe('14.05');

    act(() => {
      result.current.updateField('birthDate', '14051998');
    });
    expect(result.current.formData.birthDate).toBe('14.05.1998');
  });

  it('calls updateMyProfile with correct data on valid save', async () => {
    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateField('displayName', 'Jane Doe');
      result.current.updateField('bio', 'Updated bio');
      result.current.updateField('phoneNumber', '+905551112233');
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.handleSave();
    });

    expect(success).toBe(true);
    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      {
        display_name: 'Jane Doe',
        bio: 'Updated bio',
        phone_number: '+905551112233',
        default_location_address: 'İstanbul, Turkey',
        default_location_lat: 41.0082,
        default_location_lon: 28.9784,
      },
      'test-token',
    );
    expect(result.current.successMessage).toBe('Profile updated successfully!');
  });

  it('sends empty strings for text fields and null for enums/dates', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...profileFixture,
      display_name: null,
      bio: null,
      phone_number: null,
      gender: null,
      birth_date: null,
      default_location_address: null,
      default_location_lat: null,
      default_location_lon: null,
    });

    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.handleSave();
    });

    expect(success).toBe(true);
    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      {
        display_name: '',
        bio: '',
        phone_number: '',
        gender: null,
        birth_date: null,
        default_location_address: null,
        default_location_lat: null,
        default_location_lon: null,
      },
      'test-token',
    );
  });

  it('sets apiError on save failure', async () => {
    mockUpdateMyProfile.mockRejectedValue(
      new ApiError(400, {
        error: {
          code: 'validation_error',
          message: 'One or more fields are invalid.',
          details: { display_name: 'too long' },
        },
      }),
    );

    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success: boolean = true;
    await act(async () => {
      success = await result.current.handleSave();
    });

    expect(success).toBe(false);
    expect(result.current.apiError).toBe('One or more fields are invalid.');
    expect(result.current.errors.displayName).toBe('too long');
  });

  it('sets error when token is null', async () => {
    mockUseAuth.mockReturnValue({
      token: null,
      refreshToken: null,
      user: null,
      setSession: jest.fn(),
      clearAuth: jest.fn(),
    } as any);

    const { result } = renderHook(() => useEditProfileViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.apiError).toBe(
      'You must be logged in to edit your profile.',
    );
  });
});
