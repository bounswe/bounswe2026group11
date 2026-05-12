/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { EventDetail, UpdateEventResponse } from '@/models/event';
import * as eventService from '@/services/eventService';
import { useEditEventViewModel } from './useEditEventViewModel';

jest.mock('@/services/eventService');

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    user: { username: 'host_user' },
  }),
}));

const mockGetEventDetail = jest.mocked(eventService.getEventDetail);
const mockUpdateEvent = jest.mocked(eventService.updateEvent);
const mockGetEventImageUploadUrl = jest.mocked(eventService.getEventImageUploadUrl);
const mockUploadFileToPresignedUrl = jest.mocked(eventService.uploadFileToPresignedUrl);
const mockConfirmEventImageUpload = jest.mocked(eventService.confirmEventImageUpload);
const ImagePicker = require('expo-image-picker');
const ImageManipulator = require('expo-image-manipulator');
const mockLaunchImageLibraryAsync =
  ImagePicker.launchImageLibraryAsync as jest.MockedFunction<any>;
const mockManipulateAsync = ImageManipulator.manipulateAsync as jest.MockedFunction<any>;

function makeEvent(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: 'event-1',
    version_no: 3,
    title: 'Istanbul Trail Morning',
    description: 'A friendly morning trail run with coffee after the route.',
    image_url: null,
    privacy_level: 'PUBLIC',
    status: 'ACTIVE',
    start_time: '2035-06-01T08:00:00+03:00',
    end_time: '2035-06-01T10:00:00+03:00',
    capacity: 12,
    minimum_age: null,
    preferred_gender: null,
    approved_participant_count: 4,
    pending_participant_count: 1,
    favorite_count: 2,
    created_at: '2026-04-01T12:00:00+03:00',
    updated_at: '2026-04-02T12:00:00+03:00',
    category: { id: 7, name: 'Outdoors' },
    host: {
      id: 'host-1',
      username: 'host_user',
      display_name: 'Host User',
      avatar_url: null,
    },
    host_score: {
      final_score: 4.8,
      hosted_event_rating_count: 6,
    },
    location: {
      type: 'POINT',
      address: 'Belgrad Forest, Istanbul',
      point: { lat: 41.182, lon: 28.987 },
      route_points: [],
    },
    tags: [],
    constraints: [{ type: 'equipment', info: 'Bring water' }],
    rating_window: {
      opens_at: '2035-06-01T10:00:00+03:00',
      closes_at: '2035-06-08T10:00:00+03:00',
      is_active: false,
    },
    viewer_event_rating: null,
    viewer_context: {
      is_host: true,
      is_favorited: false,
      participation_status: 'NONE',
      latest_event_version: 3,
      needs_reconfirmation: false,
      event_diff: null,
    },
    host_context: null,
    ...overrides,
  };
}

const updateResponse: UpdateEventResponse = {
  id: 'event-1',
  title: 'Updated Istanbul Trail Morning',
  privacy_level: 'PUBLIC',
  status: 'ACTIVE',
  start_time: '2035-06-01T08:00:00+03:00',
  end_time: '2035-06-01T10:00:00+03:00',
  version_no: 4,
  reconfirmation_required: true,
  reconfirmation_triggered_fields: ['title'],
  participants_marked_pending: 3,
  updated_at: '2026-04-03T12:00:00+03:00',
};

const uploadInitFixture = {
  base_url: 'https://cdn.example.com/events/event-1/cover/v1-upload',
  version: 1,
  confirm_token: 'confirm-token',
  uploads: [
    {
      variant: 'ORIGINAL' as const,
      method: 'PUT',
      url: 'https://upload.example.com/original',
      headers: { 'Content-Type': 'image/jpeg' },
    },
    {
      variant: 'SMALL' as const,
      method: 'PUT',
      url: 'https://upload.example.com/small',
      headers: { 'Content-Type': 'image/jpeg' },
    },
  ],
};

describe('useEditEventViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEventDetail.mockResolvedValue(makeEvent());
    mockUpdateEvent.mockResolvedValue(updateResponse);
    mockGetEventImageUploadUrl.mockResolvedValue(uploadInitFixture);
    mockUploadFileToPresignedUrl.mockResolvedValue(undefined);
    mockConfirmEventImageUpload.mockResolvedValue(undefined);
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///selected-cover.jpg' }],
    });
    mockManipulateAsync.mockImplementation(async (uri: string) => ({ uri }));
  });

  it('prefills the edit form from the current event detail', async () => {
    const { result } = renderHook(() => useEditEventViewModel('event-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.canEdit).toBe(true);
    expect(result.current.formData.title).toBe('Istanbul Trail Morning');
    expect(result.current.formData.description).toBe(
      'A friendly morning trail run with coffee after the route.',
    );
    expect(result.current.formData.categoryId).toBe(7);
    expect(result.current.formData.locationType).toBe('POINT');
    expect(result.current.formData.locationQuery).toBe('Belgrad Forest, Istanbul');
    expect(result.current.formData.lat).toBe(41.182);
    expect(result.current.formData.capacityInput).toBe('12');
    expect(result.current.formData.constraints).toEqual([
      { type: 'equipment', info: 'Bring water' },
    ]);
  });

  it('builds a versioned update request and refreshes the event after saving', async () => {
    const refreshed = makeEvent({
      version_no: 4,
      title: 'Updated Istanbul Trail Morning',
      updated_at: '2026-04-03T12:00:00+03:00',
    });
    mockGetEventDetail
      .mockResolvedValueOnce(makeEvent())
      .mockResolvedValueOnce(refreshed);

    const { result } = renderHook(() => useEditEventViewModel('event-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.updateField('title', 'Updated Istanbul Trail Morning');
    });

    let preview: ReturnType<typeof result.current.previewChanges> = null;
    act(() => {
      preview = result.current.previewChanges();
    });
    expect(preview).toEqual({
      request: { title: 'Updated Istanbul Trail Morning' },
      changedFields: ['title'],
      criticalChangeLabels: ['Title'],
    });

    await act(async () => {
      await result.current.handleSubmit(preview?.request);
    });

    expect(mockUpdateEvent).toHaveBeenCalledWith(
      'event-1',
      { title: 'Updated Istanbul Trail Morning' },
      'mock-token',
    );
    expect(result.current.event?.version_no).toBe(4);
    expect(result.current.successMessage).toBe(
      'Event updated. 3 participants must reconfirm.',
    );
  });

  it('blocks capacity below approved plus pending participants before calling the API', async () => {
    const { result } = renderHook(() => useEditEventViewModel('event-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.updateField('capacityInput', '4');
    });

    let preview: ReturnType<typeof result.current.previewChanges> = null;
    act(() => {
      preview = result.current.previewChanges();
    });

    expect(preview).toBeNull();
    expect(result.current.errors.constraints).toBe(
      'Capacity cannot be below current approved plus pending participants',
    );
    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });

  it('uploads a selected image without patching event fields', async () => {
    const refreshed = makeEvent({
      image_url: 'https://cdn.example.com/events/event-1/cover/v2-small.jpg',
    });
    mockGetEventDetail
      .mockResolvedValueOnce(makeEvent())
      .mockResolvedValueOnce(refreshed);

    const { result } = renderHook(() => useEditEventViewModel('event-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.pickImage();
    });

    expect(result.current.selectedImageUri).toBe('file:///selected-cover.jpg');

    let preview: ReturnType<typeof result.current.previewChanges> = null;
    act(() => {
      preview = result.current.previewChanges();
    });

    expect(preview).toEqual({
      request: {},
      changedFields: ['image_url'],
      criticalChangeLabels: [],
    });

    await act(async () => {
      await result.current.handleSubmit(preview?.request);
    });

    expect(mockUpdateEvent).not.toHaveBeenCalled();
    expect(mockGetEventImageUploadUrl).toHaveBeenCalledWith('event-1', 'mock-token');
    expect(mockUploadFileToPresignedUrl).toHaveBeenCalledTimes(2);
    expect(mockConfirmEventImageUpload).toHaveBeenCalledWith(
      'event-1',
      'confirm-token',
      'mock-token',
    );
    expect(result.current.event?.image_url).toBe(
      'https://cdn.example.com/events/event-1/cover/v2-small.jpg',
    );
    expect(result.current.imageUploadSuccessMessage).toBe('Cover image updated successfully.');
  });
});
