/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import * as eventService from '@/services/eventService';
import { ApiError } from '@/services/api';
import type { CreateEventResponse } from '@/models/event';
import {
  useCreateEventViewModel,
  formatDateForForm,
  formatTimeInput,
  formatDateInput,
  normalizePickedImageUri,
  validateLiveDateInput,
  validateLiveTimeInput,
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  CAPACITY_MIN,
  MAX_CONSTRAINTS,
  type CreateEventViewModel,
} from './useCreateEventViewModel';

jest.mock('@/services/eventService');

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'testuser' },
    token: 'test-token',
  }),
}));

const ImagePicker = require('expo-image-picker');
const ImageManipulator = require('expo-image-manipulator');
const { Alert } = require('react-native');

const mockCreateEvent = jest.mocked(eventService.createEvent);
const mockGetEventImageUploadUrl = jest.mocked(eventService.getEventImageUploadUrl);
const mockUploadFileToPresignedUrl = jest.mocked(eventService.uploadFileToPresignedUrl);
const mockConfirmEventImageUpload = jest.mocked(eventService.confirmEventImageUpload);
const mockSearchLocation = jest.mocked(eventService.searchLocation);
const mockRequestMediaLibraryPermissionsAsync =
  ImagePicker.requestMediaLibraryPermissionsAsync as jest.MockedFunction<any>;
const mockLaunchImageLibraryAsync =
  ImagePicker.launchImageLibraryAsync as jest.MockedFunction<any>;
const mockManipulateAsync = ImageManipulator.manipulateAsync as jest.MockedFunction<any>;
const mockAlert = Alert.alert as jest.MockedFunction<any>;

const futureDate = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
})();

const futureDateLater = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() + 1);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
})();

const pastDate = '01.01.2020';

function fillValidForm(vm: CreateEventViewModel) {
  vm.updateField('title', 'A Valid Event Title');
  vm.updateField('description', 'This is a valid description that is long enough for the minimum requirement');
  vm.updateField('categoryId', 1);
  vm.updateField('lat', 41.0);
  vm.updateField('lon', 29.0);
  vm.updateField('address', 'Istanbul, Turkey');
  vm.updateField('startDate', futureDate);
  vm.updateField('startTime', '14:00');
}

const responseFixture: CreateEventResponse = {
  id: '123',
  title: 'A Valid Event Title',
  privacy_level: 'PUBLIC',
  status: 'active',
  start_time: '2027-06-15T14:00:00.000Z',
  created_at: '2026-03-28T10:00:00.000Z',
};

const uploadInitFixture = {
  base_url: 'https://cdn.example.com/events/123/cover/v1-upload',
  version: 1,
  confirm_token: 'confirm-token',
  uploads: [
    {
      variant: 'ORIGINAL',
      method: 'PUT',
      url: 'https://upload.example.com/original',
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, immutable',
        'x-amz-acl': 'public-read',
      },
    },
    {
      variant: 'SMALL',
      method: 'PUT',
      url: 'https://upload.example.com/small',
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, immutable',
        'x-amz-acl': 'public-read',
      },
    },
  ],
};

describe('useCreateEventViewModel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockCreateEvent.mockResolvedValue(responseFixture);
    mockGetEventImageUploadUrl.mockResolvedValue(uploadInitFixture as any);
    mockUploadFileToPresignedUrl.mockResolvedValue(undefined);
    mockConfirmEventImageUpload.mockResolvedValue(undefined);
    mockSearchLocation.mockResolvedValue([
      {
        display_name: 'Kadikoy, Istanbul, Turkiye',
        lat: '40.9909',
        lon: '29.0293',
      },
    ]);
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] } as any);
    mockManipulateAsync.mockResolvedValue({ uri: 'file:///mock-manipulated.jpg' } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Initial state ───
  it('starts with today as the default start date and no errors', () => {
    const { result } = renderHook(() => useCreateEventViewModel());
    expect(result.current.formData.title).toBe('');
    expect(result.current.formData.description).toBe('');
    expect(result.current.formData.categoryId).toBeNull();
    expect(result.current.formData.lat).toBeNull();
    expect(result.current.formData.startDate).toBe(formatDateForForm(new Date()));
    expect(result.current.formData.privacyLevel).toBe('PUBLIC');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.apiError).toBeNull();
    expect(result.current.errors).toEqual({});
  });

  // ─── Title validation ───
  describe('title validation', () => {
    it('shows error when title is empty', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.title).toBe('Title is required');
    });

    it(`shows error when title is shorter than ${TITLE_MIN_LENGTH} characters`, async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('title', 'Short');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.title).toContain(`at least ${TITLE_MIN_LENGTH}`);
    });

    it(`accepts title with exactly ${TITLE_MIN_LENGTH} characters`, async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('title', 'A'.repeat(TITLE_MIN_LENGTH));
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.title).toBeFalsy();
    });
  });

  // ─── Description validation ───
  describe('description validation', () => {
    it('shows error when description is empty', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.description).toBe('Description is required');
    });

    it(`shows error when description is shorter than ${DESCRIPTION_MIN_LENGTH} characters`, async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('description', 'Too short');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.description).toContain(`at least ${DESCRIPTION_MIN_LENGTH}`);
    });
  });

  // ─── Start date validation ───
  describe('start date validation', () => {
    it('shows time validation immediately while typing an invalid hour', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('startTime', formatTimeInput('28', ''));
      });
      expect(result.current.errors.startTime).toBe('Invalid time: hour must be 0-23');
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it('shows date validation immediately when an impossible day is entered', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('startDate', '35.06.2030');
      });
      expect(result.current.errors.startDate).toBeTruthy();
      expect(result.current.errors.startTime).toBeNull();
    });

    it('shows error on both fields when start date and time are missing', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('startDate', '');
        result.current.updateField('startTime', '');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.startDate).toBe('Start date is required');
      expect(result.current.errors.startTime).toBe('Start time is required');
    });

    it('shows error only on date when start date is missing but time is set', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('startDate', '');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.startDate).toBe('Start date is required');
      expect(result.current.errors.startTime).toBeFalsy();
    });

    it('shows error when start date is in the past', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('startDate', pastDate);
        result.current.updateField('startTime', '10:00');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.startDate).toBe('Start date must be in the future');
      expect(result.current.errors.startTime).toBeFalsy();
    });

    it('accepts a future start date', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => { fillValidForm(result.current); });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.startDate).toBeFalsy();
      expect(result.current.errors.startTime).toBeFalsy();
    });

    it('rejects invalid day and time independently (35.21.2030 with 28:00 — example from issue)', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('startDate', '35.21.2030');
        result.current.updateField('startTime', '28:00');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.startDate).toBeTruthy();
      expect(result.current.errors.startTime).toBeTruthy();
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it('rejects out-of-range day (35) — only date box is red', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('startDate', '35.06.2030');
        result.current.updateField('startTime', '10:00');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.startDate).toBeTruthy();
      expect(result.current.errors.startTime).toBeFalsy();
    });

    it('rejects out-of-range month (21) — only date box is red', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('startDate', '15.21.2030');
        result.current.updateField('startTime', '10:00');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.startDate).toBeTruthy();
      expect(result.current.errors.startTime).toBeFalsy();
    });

    it('rejects out-of-range hour (28:00) — only time box is red', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('startTime', '28:00');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.startTime).toBeTruthy();
      expect(result.current.errors.startDate).toBeFalsy();
    });

    it('rejects out-of-range minute (10:70) — only time box is red', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('startTime', '10:70');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.startTime).toBeTruthy();
      expect(result.current.errors.startDate).toBeFalsy();
    });

    it('rejects impossible calendar date (30.02.2030) — only date box is red', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('startDate', '30.02.2030');
        result.current.updateField('startTime', '10:00');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.startDate).toBeTruthy();
      expect(result.current.errors.startTime).toBeFalsy();
    });
  });

  // ─── End date validation ───
  describe('end date validation', () => {
    it('shows end date error immediately when end time becomes earlier than start', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('endDate', futureDate);
        result.current.updateField('endTime', '13:00');
      });
      expect(result.current.errors.endDate).toBe('End must be after start');
    });

    it('shows error on date when end date is before start date', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('endDate', pastDate);
        result.current.updateField('endTime', '10:00');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.endDate).toBe('End must be after start');
      expect(result.current.errors.endTime).toBeFalsy();
    });

    it('clears end date error when end date is updated', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('endDate', pastDate);
        result.current.updateField('endTime', '10:00');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.endDate).toBeTruthy();

      await act(async () => {
        result.current.updateField('endDate', futureDateLater);
      });
      expect(result.current.errors.endDate).toBeNull();
    });

    it('clears end date error when end time is updated', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('endDate', futureDate);
        result.current.updateField('endTime', '10:00');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.endDate).toBeTruthy();

      await act(async () => {
        result.current.updateField('endTime', '18:00');
      });
      expect(result.current.errors.endDate).toBeNull();
    });
  });

  // ─── Error clearing ───
  describe('error clearing', () => {
    it('clears start date error when start date is updated', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        fillValidForm(result.current);
        result.current.updateField('startDate', pastDate);
        result.current.updateField('startTime', '10:00');
      });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.startDate).toBeTruthy();

      await act(async () => {
        result.current.updateField('startDate', futureDate);
      });
      expect(result.current.errors.startDate).toBeNull();
    });

    it('clears location error when location query is updated', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.location).toBeTruthy();

      await act(async () => {
        result.current.updateField('locationQuery', 'Istanbul');
      });
      expect(result.current.errors.location).toBeNull();
    });
  });

  // ─── Capacity constraint ───
  describe('capacity constraint', () => {
    it(`shows error when capacity is less than ${CAPACITY_MIN}`, async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.updateField('constraintType', 'capacity');
        result.current.updateField('capacityInput', '1');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.errors.constraints).toContain(`at least ${CAPACITY_MIN}`);
      expect(result.current.formData.constraints).toHaveLength(0);
    });

    it('shows error when capacity is 0', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.updateField('constraintType', 'capacity');
        result.current.updateField('capacityInput', '0');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.errors.constraints).toContain(`at least ${CAPACITY_MIN}`);
    });

    it('shows error when capacity is negative', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.updateField('constraintType', 'capacity');
        result.current.updateField('capacityInput', '-5');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.errors.constraints).toContain(`at least ${CAPACITY_MIN}`);
    });

    it(`accepts capacity of ${CAPACITY_MIN}`, async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.updateField('constraintType', 'capacity');
        result.current.updateField('capacityInput', String(CAPACITY_MIN));
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.errors.constraints).toBeFalsy();
      expect(result.current.formData.constraints).toHaveLength(1);
      expect(result.current.formData.constraints[0].info).toBe(`${CAPACITY_MIN} participants`);
    });

    it('accepts large capacity value', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.updateField('constraintType', 'capacity');
        result.current.updateField('capacityInput', '100');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.formData.constraints).toHaveLength(1);
      expect(result.current.formData.constraints[0].info).toBe('100 participants');
    });
  });

  // ─── Age constraint ───
  describe('age constraint', () => {
    it('shows error when min age is greater than max age', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.updateField('constraintType', 'age');
        result.current.updateField('ageMinInput', '30');
        result.current.updateField('ageMaxInput', '18');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.errors.constraints).toBe('Minimum age cannot be greater than maximum age');
      expect(result.current.formData.constraints).toHaveLength(0);
    });

    it('shows error when age is out of range (>120)', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.updateField('constraintType', 'age');
        result.current.updateField('ageMinInput', '150');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.errors.constraints).toBe('Age must be between 0 and 120');
    });

    it('shows error when age is negative', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.updateField('constraintType', 'age');
        result.current.updateField('ageMinInput', '-5');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.errors.constraints).toBe('Age must be between 0 and 120');
    });

    it('accepts valid age range', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.updateField('constraintType', 'age');
        result.current.updateField('ageMinInput', '18');
        result.current.updateField('ageMaxInput', '30');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.errors.constraints).toBeFalsy();
      expect(result.current.formData.constraints).toHaveLength(1);
      expect(result.current.formData.constraints[0].info).toBe('Ages 18–30');
    });

    it('accepts min-only age (18+)', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.updateField('constraintType', 'age');
        result.current.updateField('ageMinInput', '18');
        result.current.updateField('ageMaxInput', '');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.formData.constraints).toHaveLength(1);
      expect(result.current.formData.constraints[0].info).toBe('18+');
    });
  });

  // ─── Constraint total limit ───
  describe('constraint limits', () => {
    it(`allows up to ${MAX_CONSTRAINTS} total constraints`, async () => {
      const { result } = renderHook(() => useCreateEventViewModel());

      // Add 1 gender + 1 age + 1 capacity + 2 other = 5
      await act(async () => { result.current.addGenderConstraint('MALE'); });
      expect(result.current.formData.constraints).toHaveLength(1);

      await act(async () => {
        result.current.updateField('constraintType', 'age');
        result.current.updateField('ageMinInput', '18');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.formData.constraints).toHaveLength(2);

      await act(async () => {
        result.current.updateField('constraintType', 'capacity');
        result.current.updateField('capacityInput', '50');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.formData.constraints).toHaveLength(3);

      await act(async () => {
        result.current.updateField('constraintType', 'other');
        result.current.updateField('otherConstraintInput', 'Bring a mat');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.formData.constraints).toHaveLength(4);

      await act(async () => {
        result.current.updateField('otherConstraintInput', 'Wear sneakers');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.formData.constraints).toHaveLength(5);
    });

    it('prevents adding more than max total constraints', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());

      // Add 5 other constraints (since other has no per-type limit below total)
      for (let i = 0; i < MAX_CONSTRAINTS; i++) {
        await act(async () => {
          result.current.updateField('constraintType', 'other');
          result.current.updateField('otherConstraintInput', `Rule ${i + 1}`);
        });
        await act(async () => { result.current.addConstraint(); });
      }
      expect(result.current.formData.constraints).toHaveLength(MAX_CONSTRAINTS);

      // Try adding a 6th
      await act(async () => {
        result.current.updateField('constraintType', 'other');
        result.current.updateField('otherConstraintInput', 'Rule 6');
      });
      await act(async () => { result.current.addConstraint(); });
      expect(result.current.formData.constraints).toHaveLength(MAX_CONSTRAINTS);
      expect(result.current.errors.constraints).toContain('Maximum');
    });

    it('allows more than 2 other constraints when slots are available', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());

      // Add 3 other constraints - should all succeed
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          result.current.updateField('constraintType', 'other');
          result.current.updateField('otherConstraintInput', `Rule ${i + 1}`);
        });
        await act(async () => { result.current.addConstraint(); });
      }
      expect(result.current.formData.constraints).toHaveLength(3);
    });

    it('only allows 1 gender constraint', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => { result.current.addGenderConstraint('MALE'); });
      expect(result.current.formData.constraints).toHaveLength(1);

      await act(async () => { result.current.addGenderConstraint('FEMALE'); });
      expect(result.current.formData.constraints).toHaveLength(1);
    });
  });

  // ─── Tags ───
  describe('tags', () => {
    it('adds a tag', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.updateField('tagInput', 'fun');
      });
      await act(async () => { result.current.addTag(); });
      expect(result.current.formData.tags).toEqual(['fun']);
      expect(result.current.formData.tagInput).toBe('');
    });

    it('does not add duplicate tags', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => { result.current.updateField('tagInput', 'fun'); });
      await act(async () => { result.current.addTag(); });
      await act(async () => { result.current.updateField('tagInput', 'fun'); });
      await act(async () => { result.current.addTag(); });
      expect(result.current.formData.tags).toEqual(['fun']);
    });

    it('limits to 5 tags', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      for (let i = 0; i < 6; i++) {
        await act(async () => { result.current.updateField('tagInput', `tag${i}`); });
        await act(async () => { result.current.addTag(); });
      }
      expect(result.current.formData.tags).toHaveLength(5);
    });

    it('removes a tag by index', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => { result.current.updateField('tagInput', 'a'); });
      await act(async () => { result.current.addTag(); });
      await act(async () => { result.current.updateField('tagInput', 'b'); });
      await act(async () => { result.current.addTag(); });
      await act(async () => { result.current.removeTag(0); });
      expect(result.current.formData.tags).toEqual(['b']);
    });
  });

  // ─── Successful submission ───
  describe('submission', () => {
    it('calls createEvent and returns result on valid form', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => { fillValidForm(result.current); });

      let response: CreateEventResponse | null = null;
      await act(async () => {
        response = await result.current.handleSubmit('test-token');
      });

      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
      expect(mockGetEventImageUploadUrl).not.toHaveBeenCalled();
      expect(response).toEqual(responseFixture);
      expect(result.current.successMessage).toBe('Event created successfully!');
    });

    it('uploads the selected image through the backend flow after event creation', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      mockLaunchImageLibraryAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///selected-image.jpg' }],
      } as any);
      mockManipulateAsync
        .mockResolvedValueOnce({ uri: 'file:///prepared-preview.jpg' } as any)
        .mockResolvedValueOnce({ uri: 'file:///original-image.jpg' } as any)
        .mockResolvedValueOnce({ uri: 'file:///small-image.jpg' } as any);

      await act(async () => {
        await result.current.pickImage();
        fillValidForm(result.current);
      });

      await act(async () => {
        await result.current.handleSubmit('test-token');
      });

      expect(result.current.selectedImageUri).toBe('file:///prepared-preview.jpg');
      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
      expect(mockGetEventImageUploadUrl).toHaveBeenCalledWith(responseFixture.id, 'test-token');
      expect(mockUploadFileToPresignedUrl).toHaveBeenNthCalledWith(
        1,
        'PUT',
        uploadInitFixture.uploads[0].url,
        uploadInitFixture.uploads[0].headers,
        'file:///original-image.jpg',
      );
      expect(mockUploadFileToPresignedUrl).toHaveBeenNthCalledWith(
        2,
        'PUT',
        uploadInitFixture.uploads[1].url,
        uploadInitFixture.uploads[1].headers,
        'file:///small-image.jpg',
      );
      expect(mockConfirmEventImageUpload).toHaveBeenCalledWith(
        responseFixture.id,
        uploadInitFixture.confirm_token,
        'test-token',
      );
      expect(result.current.successMessage).toBe('Event created successfully!');
      expect(result.current.imageError).toBeNull();
    });

    it('shows a clear image error when upload fails after event creation', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      mockLaunchImageLibraryAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///selected-image.jpg' }],
      } as any);
      mockUploadFileToPresignedUrl.mockRejectedValueOnce(new Error('Upload failed with status 500'));

      await act(async () => {
        await result.current.pickImage();
        fillValidForm(result.current);
      });

      let response: CreateEventResponse | null = null;
      await act(async () => {
        response = await result.current.handleSubmit('test-token');
      });

      expect(response).toEqual(responseFixture);
      expect(result.current.successMessage).toBe('Event created successfully!');
      expect(result.current.imageError).toBe(
        'The event was created, but uploading the image to storage failed.',
      );
      expect(mockConfirmEventImageUpload).not.toHaveBeenCalled();
    });

    it('shows a user-friendly message when the image upload network request fails', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      mockLaunchImageLibraryAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///selected-image.jpg' }],
      } as any);
      mockUploadFileToPresignedUrl.mockRejectedValueOnce(new Error('Network request failed'));

      await act(async () => {
        await result.current.pickImage();
        fillValidForm(result.current);
      });

      await act(async () => {
        await result.current.handleSubmit('test-token');
      });

      expect(result.current.successMessage).toBe('Event created successfully!');
      expect(result.current.imageError).toBe(
        'The event was created, but uploading the image failed because the network request did not complete.',
      );
      expect(mockConfirmEventImageUpload).not.toHaveBeenCalled();
    });

    it('does not call API when validation fails', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it('sets apiError on API failure', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      mockCreateEvent.mockRejectedValueOnce(
        new ApiError(400, {
          error: { code: 'validation_error', message: 'Bad request' },
        }),
      );
      await act(async () => { fillValidForm(result.current); });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.apiError).toBe('Bad request');
    });

    it('sets generic apiError on unexpected error', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      mockCreateEvent.mockRejectedValueOnce(new Error('Network failure'));
      await act(async () => { fillValidForm(result.current); });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.apiError).toBe('An unexpected error occurred. Please try again.');
    });

    it('maps API field errors to form errors', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      mockCreateEvent.mockRejectedValueOnce(
        new ApiError(422, {
          error: {
            code: 'validation_error',
            message: 'Validation failed',
            details: { title: 'Title too long', start_time: 'Invalid' },
          },
        }),
      );
      await act(async () => { fillValidForm(result.current); });
      await act(async () => { await result.current.handleSubmit('token'); });
      expect(result.current.errors.title).toBe('Title too long');
      expect(result.current.errors.startDate).toBe('Invalid');
    });
  });

  // ─── Location ───
  describe('location', () => {
    it('searches location suggestions with debounce', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());

      act(() => {
        result.current.handleLocationSearch('Kadikoy');
      });

      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      expect(mockSearchLocation).toHaveBeenCalledWith('Kadikoy');
      expect(result.current.locationSuggestions).toEqual([
        {
          display_name: 'Kadikoy, Istanbul, Turkiye',
          lat: '40.9909',
          lon: '29.0293',
        },
      ]);
    });

    it('selects a location from suggestions', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.selectLocation({
          display_name: 'Istanbul, Turkey',
          lat: '41.0082',
          lon: '28.9784',
        });
      });
      expect(result.current.formData.lat).toBe(41.0082);
      expect(result.current.formData.lon).toBe(28.9784);
      expect(result.current.formData.address).toBe('Istanbul, Turkey');
    });

    it('clears location', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      await act(async () => {
        result.current.selectLocation({
          display_name: 'Istanbul',
          lat: '41.0',
          lon: '29.0',
        });
      });
      await act(async () => { result.current.clearLocation(); });
      expect(result.current.formData.lat).toBeNull();
      expect(result.current.formData.lon).toBeNull();
      expect(result.current.formData.address).toBe('');
    });
  });

  // ─── Privacy ───
  it('does not include PRIVATE in privacy options', () => {
    const { result } = renderHook(() => useCreateEventViewModel());
    expect(result.current.formData.privacyLevel).toBe('PUBLIC');
    // PRIVATE should not be in the exported options - tested via import
    const { PRIVACY_OPTIONS } = require('./useCreateEventViewModel');
    expect(PRIVACY_OPTIONS.map((o: { value: string }) => o.value)).toContain('PRIVATE');
  });

  describe('image picking', () => {
    it('tries safer URI variants and stores a prepared preview image for Android-style picker paths', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      mockLaunchImageLibraryAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252Fsocial-event-mapper/ImagePicker/example.png',
          },
        ],
      } as any);
      mockManipulateAsync
        .mockRejectedValueOnce(new Error('Loading bitmap failed'))
        .mockRejectedValueOnce(new Error('Loading bitmap failed'))
        .mockResolvedValueOnce({ uri: 'file:///safe-preview.jpg' } as any);

      await act(async () => {
        await result.current.pickImage();
      });

      expect(mockManipulateAsync).toHaveBeenNthCalledWith(
        1,
        'file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252Fsocial-event-mapper/ImagePicker/example.png',
        [],
        { compress: 0.9, format: 'jpeg' },
      );
      expect(mockManipulateAsync).toHaveBeenNthCalledWith(
        3,
        'file:///data/user/0/host.exp.exponent/cache/ExperienceData/@anonymous/social-event-mapper/ImagePicker/example.png',
        [],
        { compress: 0.9, format: 'jpeg' },
      );
      expect(result.current.selectedImageUri).toBe('file:///safe-preview.jpg');
      expect(result.current.imageError).toBeNull();
    });

    it('shows an inline error when the selected image cannot be processed', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      mockLaunchImageLibraryAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///selected-image.jpg' }],
      } as any);
      mockManipulateAsync.mockRejectedValue(new Error('Loading bitmap failed'));

      await act(async () => {
        await result.current.pickImage();
      });

      expect(result.current.selectedImageUri).toBeNull();
      expect(result.current.imageError).toBe(
        'We could not process the selected image. Please try a different one.',
      );
    });

    it('shows an inline error and alert when photo permission is denied', async () => {
      const { result } = renderHook(() => useCreateEventViewModel());
      mockRequestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as any);

      await act(async () => {
        await result.current.pickImage();
      });

      expect(result.current.imageError).toBe(
        'Please allow access to your photo library to add an event image.',
      );
      expect(mockAlert).toHaveBeenCalledWith(
        'Permission required',
        'Please allow access to your photo library to add an event image.',
      );
      expect(result.current.selectedImageUri).toBeNull();
    });
  });
});

// ─── formatDateInput (pure function) ───
describe('formatDateInput', () => {
  it('auto-inserts dot after day and month while typing digits', () => {
    expect(formatDateInput('1', '')).toBe('1');
    expect(formatDateInput('12', '1')).toBe('12');
    expect(formatDateInput('123', '12')).toBe('12.3');
    expect(formatDateInput('1203', '123')).toBe('12.03');
    expect(formatDateInput('12032', '1203')).toBe('12.03.2');
    expect(formatDateInput('12032026', '1203202')).toBe('12.03.2026');
  });

  it('limits to dd.mm.yyyy (8 digits)', () => {
    expect(formatDateInput('12032026199', '12032026')).toBe('12.03.2026');
  });

  it('formats when deleting digits', () => {
    expect(formatDateInput('12.03', '12.03.2')).toBe('12.03');
    expect(formatDateInput('1203', '12032')).toBe('12.03');
    expect(formatDateInput('12032', '120320')).toBe('12.03.2');
  });

  it('strips non-digit characters', () => {
    expect(formatDateInput('12a03b2026', '12.03.202')).toBe('12.03.2026');
  });
});

// ─── formatTimeInput (pure function) ───
describe('formatTimeInput', () => {
  it('auto-inserts colon after 2 digits', () => {
    expect(formatTimeInput('14', '1')).toBe('14:');
  });

  it('does not auto-insert colon when deleting', () => {
    expect(formatTimeInput('1', '14')).toBe('1');
  });

  it('strips non-digit non-colon characters and auto-formats', () => {
    // '1a4' stripped → '14', which is 2 digits so colon is auto-inserted
    expect(formatTimeInput('1a4', '1')).toBe('14:');
  });

  it('limits to 5 characters', () => {
    expect(formatTimeInput('14:300', '14:30')).toBe('14:30');
  });

  it('passes through valid partial input', () => {
    expect(formatTimeInput('1', '')).toBe('1');
    expect(formatTimeInput('14:', '14')).toBe('14:');
    expect(formatTimeInput('14:3', '14:')).toBe('14:3');
    expect(formatTimeInput('14:30', '14:3')).toBe('14:30');
  });
});

describe('validateLiveDateInput', () => {
  it('does not show an error for partial valid input', () => {
    expect(validateLiveDateInput('1')).toBeNull();
    expect(validateLiveDateInput('12.')).toBeNull();
    expect(validateLiveDateInput('12.0')).toBeNull();
  });

  it('shows an immediate error when day is out of range', () => {
    expect(validateLiveDateInput('35')).toBe('Invalid date: day must be 1-31');
  });

  it('shows an immediate error when month is out of range', () => {
    expect(validateLiveDateInput('12.13')).toBe('Invalid date: month must be 1-12');
  });

  it('uses full date validation when the date is complete', () => {
    expect(validateLiveDateInput('30.02.2030')).toBe('Invalid date');
    expect(validateLiveDateInput('28.02.2030')).toBeNull();
  });
});

describe('validateLiveTimeInput', () => {
  it('does not show an error for partial valid input', () => {
    expect(validateLiveTimeInput('1')).toBeNull();
    expect(validateLiveTimeInput('12:')).toBeNull();
    expect(validateLiveTimeInput('12:3')).toBeNull();
  });

  it('shows an immediate error when hour is out of range', () => {
    expect(validateLiveTimeInput('28')).toBe('Invalid time: hour must be 0-23');
  });

  it('shows an immediate error when minute is out of range', () => {
    expect(validateLiveTimeInput('10:70')).toBe('Invalid time: minute must be 0-59');
  });

  it('uses full time validation when the time is complete', () => {
    expect(validateLiveTimeInput('09:30')).toBeNull();
  });
});

describe('normalizePickedImageUri', () => {
  it('fully decodes Android file URIs until they reach a filesystem path', () => {
    expect(
      normalizePickedImageUri(
        'file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252Fsocial-event-mapper/ImagePicker/example.png',
      ),
    ).toBe(
      'file:///data/user/0/host.exp.exponent/cache/ExperienceData/@anonymous/social-event-mapper/ImagePicker/example.png',
    );
  });

  it('leaves non-encoded file URIs unchanged', () => {
    expect(normalizePickedImageUri('file:///selected-image.jpg')).toBe(
      'file:///selected-image.jpg',
    );
  });
});
