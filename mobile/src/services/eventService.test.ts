import * as FileSystem from 'expo-file-system/legacy';
import { listMyEvents, uploadFileToPresignedUrl } from './eventService';

jest.mock('expo-file-system/legacy');

const originalFetch = global.fetch;
const mockFetch = jest.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as any;
}

describe('uploadFileToPresignedUrl', () => {
  const mockUploadAsync = jest.mocked(FileSystem.uploadAsync);

  beforeEach(() => {
    global.fetch = mockFetch as any;
    mockFetch.mockReset();
    mockUploadAsync.mockResolvedValue({
      status: 200,
      headers: {},
      body: '',
      mimeType: 'image/jpeg',
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('uploads the local file with the provided method and headers', async () => {
    await uploadFileToPresignedUrl(
      'put',
      'https://upload.example.com/object',
      { 'Content-Type': 'image/jpeg', 'x-amz-acl': 'public-read' },
      'file:///event-image.jpg',
    );

    expect(mockUploadAsync).toHaveBeenCalledWith('https://upload.example.com/object', 'file:///event-image.jpg', {
      httpMethod: 'PUT',
      headers: { 'Content-Type': 'image/jpeg', 'x-amz-acl': 'public-read' },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
  });

  it('throws a clear error when the upload request fails', async () => {
    mockUploadAsync.mockResolvedValueOnce({
      status: 403,
      headers: {},
      body: '',
      mimeType: 'image/jpeg',
    });

    await expect(
      uploadFileToPresignedUrl(
        'PUT',
        'https://upload.example.com/object',
        { 'Content-Type': 'image/jpeg' },
        'file:///event-image.jpg',
      ),
    ).rejects.toThrow('Upload failed with status 403');
  });

  it('throws a clear error for unsupported upload methods', async () => {
    await expect(
      uploadFileToPresignedUrl(
        'DELETE',
        'https://upload.example.com/object',
        { 'Content-Type': 'image/jpeg' },
        'file:///event-image.jpg',
      ),
    ).rejects.toThrow('Unsupported upload method: DELETE');

    expect(mockUploadAsync).not.toHaveBeenCalled();
  });

  it('builds my events from the four backend event-management endpoints', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer mock-token',
      });

      if (url.includes('/me/events/hosted')) {
        return Promise.resolve(
          jsonResponse({
            events: [
              {
                id: 'host-active',
                title: 'Host Active',
                start_time: '2026-04-10T09:00:00+03:00',
                end_time: '0001-01-01T00:00:00Z',
                status: 'ACTIVE',
                category: 'Sports',
                image_url: 'https://example.com/host-active.jpg',
              },
              {
                id: 'host-canceled',
                title: 'Host Canceled',
                start_time: '2026-04-01T18:00:00+03:00',
                end_time: '2026-04-01T20:00:00+03:00',
                status: 'CANCELED',
                category: 'Music',
                image_url: 'https://example.com/host-canceled.jpg',
              },
            ],
          }),
        );
      }

      if (url.includes('/me/events/upcoming')) {
        return Promise.resolve(
          jsonResponse({
            events: [
              {
                id: 'host-active',
                title: 'Host Active',
                start_time: '2026-04-10T09:00:00+03:00',
                end_time: '0001-01-01T00:00:00Z',
                status: 'ACTIVE',
                category: 'Sports',
                image_url: 'https://example.com/host-active.jpg',
              },
              {
                id: 'attend-active',
                title: 'Attend Active',
                start_time: '2026-04-12T19:00:00+03:00',
                end_time: '2026-04-12T22:00:00+03:00',
                status: 'IN_PROGRESS',
                category: 'Outdoors',
                image_url: 'https://example.com/attend-active.jpg',
              },
            ],
          }),
        );
      }

      if (url.includes('/me/events/completed')) {
        return Promise.resolve(
          jsonResponse({
            events: [
              {
                id: 'attend-completed',
                title: 'Attend Completed',
                start_time: '2026-03-18T19:00:00+03:00',
                end_time: '2026-03-18T21:00:00+03:00',
                status: 'COMPLETED',
                category: 'Culture',
                image_url: 'https://example.com/attend-completed.jpg',
              },
            ],
          }),
        );
      }

      if (url.includes('/me/events/canceled')) {
        return Promise.resolve(
          jsonResponse({
            events: [
              {
                id: 'attend-canceled',
                title: 'Attend Canceled',
                start_time: '2026-04-02T18:00:00+03:00',
                end_time: '2026-04-02T21:00:00+03:00',
                status: 'CANCELED',
                category: 'Food',
                image_url: 'https://example.com/attend-canceled.jpg',
              },
            ],
          }),
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const result = await listMyEvents('mock-token');

    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(result).toEqual({
      hosted_events: [
        {
          id: 'host-active',
          title: 'Host Active',
          image_url: 'https://example.com/host-active.jpg',
          start_time: '2026-04-10T09:00:00+03:00',
          end_time: null,
          location_address: null,
          approved_participant_count: null,
          status: 'ACTIVE',
          relation: 'HOSTING',
          badges: [{ type: 'HOST', label: 'Host' }],
        },
        {
          id: 'host-canceled',
          title: 'Host Canceled',
          image_url: 'https://example.com/host-canceled.jpg',
          start_time: '2026-04-01T18:00:00+03:00',
          end_time: '2026-04-01T20:00:00+03:00',
          location_address: null,
          approved_participant_count: null,
          status: 'CANCELED',
          relation: 'HOSTING',
          badges: [{ type: 'HOST', label: 'Host' }],
        },
      ],
      attended_events: [
        {
          id: 'attend-active',
          title: 'Attend Active',
          image_url: 'https://example.com/attend-active.jpg',
          start_time: '2026-04-12T19:00:00+03:00',
          end_time: '2026-04-12T22:00:00+03:00',
          location_address: null,
          approved_participant_count: null,
          status: 'IN_PROGRESS',
          relation: 'ATTENDING',
          badges: [],
        },
        {
          id: 'attend-completed',
          title: 'Attend Completed',
          image_url: 'https://example.com/attend-completed.jpg',
          start_time: '2026-03-18T19:00:00+03:00',
          end_time: '2026-03-18T21:00:00+03:00',
          location_address: null,
          approved_participant_count: null,
          status: 'COMPLETED',
          relation: 'ATTENDING',
          badges: [],
        },
        {
          id: 'attend-canceled',
          title: 'Attend Canceled',
          image_url: 'https://example.com/attend-canceled.jpg',
          start_time: '2026-04-02T18:00:00+03:00',
          end_time: '2026-04-02T21:00:00+03:00',
          location_address: null,
          approved_participant_count: null,
          status: 'CANCELED',
          relation: 'ATTENDING',
          badges: [],
        },
      ],
    });
  });

  it('falls back safely when event lists are empty or missing', async () => {
    const emptyEventsResponse = jsonResponse({ events: [] });
    mockFetch.mockResolvedValue(emptyEventsResponse);

    const result = await listMyEvents('mock-token');

    expect(result).toEqual({
      hosted_events: [],
      attended_events: [],
    });
  });
});
