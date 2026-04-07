/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
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

const ImagePicker = require('expo-image-picker');
const ImageManipulator = require('expo-image-manipulator');
const { Alert } = require('react-native');

import { useAuth } from '@/contexts/AuthContext';

const mockGetMyProfile = jest.mocked(profileService.getMyProfile);
const mockGetProfileAvatarUploadUrl = jest.mocked(profileService.getProfileAvatarUploadUrl);
const mockConfirmProfileAvatarUpload = jest.mocked(profileService.confirmProfileAvatarUpload);
const mockUpdateMyProfile = jest.mocked(profileService.updateMyProfile);
const mockSearchLocation = jest.mocked(eventService.searchLocation);
const mockUploadFileToPresignedUrl = jest.mocked(eventService.uploadFileToPresignedUrl);
const mockUseAuth = jest.mocked(useAuth);
const mockRequestMediaLibraryPermissionsAsync =
  ImagePicker.requestMediaLibraryPermissionsAsync as jest.MockedFunction<any>;
const mockLaunchImageLibraryAsync =
  ImagePicker.launchImageLibraryAsync as jest.MockedFunction<any>;
const mockManipulateAsync = ImageManipulator.manipulateAsync as jest.MockedFunction<any>;
const mockAlert = Alert.alert as jest.MockedFunction<any>;

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function renderEditProfileViewModel() {
  const rendered = renderHook(() => useEditProfileViewModel());
  await act(async () => {
    await Promise.resolve();
  });
  return rendered;
}

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
    mockGetProfileAvatarUploadUrl.mockResolvedValue({
      base_url: 'https://cdn.example.com/profiles/u/avatar/v1',
      version: 1,
      confirm_token: 'avatar-confirm-token',
      uploads: [
        {
          variant: 'ORIGINAL',
          method: 'PUT',
          url: 'https://upload.example.com/original',
          headers: { 'Content-Type': 'image/jpeg' },
        },
        {
          variant: 'SMALL',
          method: 'PUT',
          url: 'https://upload.example.com/small',
          headers: { 'Content-Type': 'image/jpeg' },
        },
      ],
    } as any);
    mockConfirmProfileAvatarUpload.mockResolvedValue(undefined);
    mockUploadFileToPresignedUrl.mockResolvedValue(undefined);
    mockSearchLocation.mockResolvedValue([
      {
        display_name: 'Kadikoy, Istanbul, Turkiye',
        lat: '40.9909',
        lon: '29.0293',
      },
    ]);
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] } as any);
    mockManipulateAsync.mockResolvedValue({ uri: 'file:///prepared-image.jpg' } as any);
    mockAlert.mockImplementation(() => {});
  });

  it('starts in loading state', () => {
    const deferredProfile = createDeferred<UserProfile>();
    mockGetMyProfile.mockReturnValue(deferredProfile.promise);

    const { result } = renderHook(() => useEditProfileViewModel());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isSaving).toBe(false);
  });

  it('populates form fields from fetched profile', async () => {
    const { result } = await renderEditProfileViewModel();

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

    const { result } = await renderEditProfileViewModel();

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
    const { result } = await renderEditProfileViewModel();

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

    expect(result.current.formData.defaultLocationAddress).toBe(
      'Kadikoy, Istanbul, Turkiye',
    );
    expect(result.current.formData.defaultLocationLat).toBe(40.9909);
    expect(result.current.formData.defaultLocationLon).toBe(29.0293);
    expect(result.current.locationQuery).toBe('Kadikoy, Istanbul, Turkiye');
  });

  it('saves the raw display_name of a detailed location selection', async () => {
    const { result } = await renderEditProfileViewModel();

    act(() => {
      result.current.selectLocationSuggestion({
        display_name:
          'Boğaziçi Üniversitesi 4.Kuzey Yurdu, Hisar Üstü, Sarıyer, İstanbul, Türkiye',
        lat: '41.0845',
        lon: '29.0506',
      });
    });

    const rawAddress = 'Boğaziçi Üniversitesi 4.Kuzey Yurdu, Hisar Üstü, Sarıyer, İstanbul, Türkiye';

    expect(result.current.formData.defaultLocationAddress).toBe(rawAddress);
    expect(result.current.locationQuery).toBe(rawAddress);

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        default_location_address: rawAddress,
        default_location_lat: 41.0845,
        default_location_lon: 29.0506,
      }),
      'test-token',
    );
  });

  it('clears the selected default location', async () => {
    const { result } = await renderEditProfileViewModel();

    act(() => {
      result.current.clearLocation();
    });

    expect(result.current.formData.defaultLocationAddress).toBe('');
    expect(result.current.formData.defaultLocationLat).toBeNull();
    expect(result.current.formData.defaultLocationLon).toBeNull();
    expect(result.current.locationQuery).toBe('');
  });

  it('picks an avatar image from the photo library', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked-image.jpg' }],
    } as any);

    const { result } = await renderEditProfileViewModel();

    await act(async () => {
      await result.current.pickAvatar();
    });

    expect(result.current.selectedImageUri).toBe('file:///prepared-image.jpg');
    expect(result.current.imageError).toBeNull();
  });

  it('uploads avatar on save when a new local image is selected', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked-image.jpg' }],
    } as any);

    const { result } = await renderEditProfileViewModel();

    await act(async () => {
      await result.current.pickAvatar();
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockGetProfileAvatarUploadUrl).toHaveBeenCalledWith('test-token');
    expect(mockUploadFileToPresignedUrl).toHaveBeenCalledTimes(2);
    expect(mockConfirmProfileAvatarUpload).toHaveBeenCalledWith(
      'avatar-confirm-token',
      'test-token',
    );
  });

  it('omits locked gender and birth date from the update payload', async () => {
    const { result } = await renderEditProfileViewModel();

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
    const { result } = await renderEditProfileViewModel();

    act(() => {
      result.current.updateField('displayName', 'New Name');
    });

    expect(result.current.formData.displayName).toBe('New Name');
    expect(result.current.errors.displayName).toBeNull();
  });

  it('validates birth date format on save', async () => {
    const { result } = await renderEditProfileViewModel();

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
    const { result } = await renderEditProfileViewModel();

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
    const { result } = await renderEditProfileViewModel();

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
    const { result } = await renderEditProfileViewModel();

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
    const { result } = await renderEditProfileViewModel();

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
    const { result } = await renderEditProfileViewModel();

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
    const { result } = await renderEditProfileViewModel();

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
    const { result } = await renderEditProfileViewModel();

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

    const { result } = await renderEditProfileViewModel();

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

    const { result } = await renderEditProfileViewModel();

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

    const { result } = await renderEditProfileViewModel();

    expect(result.current.apiError).toBe(
      'You must be logged in to edit your profile.',
    );
  });
});
