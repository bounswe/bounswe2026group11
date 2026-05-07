import * as FileSystem from 'expo-file-system/legacy';
import { listMyEvents, reverseGeocode, searchLocation, uploadFileToPresignedUrl } from './eventService';

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
                privacy_level: 'PUBLIC',
              },
              {
                id: 'host-canceled',
                title: 'Host Canceled',
                start_time: '2026-04-01T18:00:00+03:00',
                end_time: '2026-04-01T20:00:00+03:00',
                status: 'CANCELED',
                category: 'Music',
                image_url: 'https://example.com/host-canceled.jpg',
                privacy_level: 'PUBLIC',
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
                privacy_level: 'PUBLIC',
              },
              {
                id: 'attend-active',
                title: 'Attend Active',
                start_time: '2026-04-12T19:00:00+03:00',
                end_time: '2026-04-12T22:00:00+03:00',
                status: 'IN_PROGRESS',
                category: 'Outdoors',
                image_url: 'https://example.com/attend-active.jpg',
                privacy_level: 'PUBLIC',
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
                privacy_level: 'PUBLIC',
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
                privacy_level: 'PUBLIC',
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
          privacy_level: 'PUBLIC',
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
          privacy_level: 'PUBLIC',
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
          privacy_level: 'PUBLIC',
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
          privacy_level: 'PUBLIC',
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
          privacy_level: 'PUBLIC',
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

describe('searchLocation', () => {
  beforeEach(() => {
    global.fetch = mockFetch as any;
    mockFetch.mockReset();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('returns [] without calling fetch when query is shorter than 2 chars', async () => {
    const result = await searchLocation('a');
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns [] for whitespace-only queries', async () => {
    const result = await searchLocation('   ');
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('hits the Photon endpoint with the expected query params', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ features: [] }));

    await searchLocation('Istanbul');

    const calledUrl: string = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('https://photon.komoot.io/api?');
    expect(calledUrl).toContain('q=Istanbul');
    expect(calledUrl).toContain('limit=5');
    expect(calledUrl).toContain('lang=en');
  });

  it('does NOT hit the legacy Nominatim endpoint', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ features: [] }));

    await searchLocation('Kadikoy');

    const calledUrl: string = mockFetch.mock.calls[0][0];
    expect(calledUrl).not.toContain('nominatim');
  });

  it('maps Photon GeoJSON features to LocationSuggestion shape', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        features: [
          {
            geometry: { type: 'Point', coordinates: [28.9784, 41.0082] },
            properties: {
              name: 'Istanbul',
              city: 'Istanbul',
              state: 'Marmara',
              country: 'Turkey',
              type: 'city',
            },
          },
          {
            geometry: { type: 'Point', coordinates: [29.0376, 41.0014] },
            properties: {
              name: 'Kadikoy',
              city: 'Istanbul',
              country: 'Turkey',
            },
          },
        ],
      }),
    );

    const result = await searchLocation('Istanbul');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      display_name: 'Istanbul, Marmara, Turkey',
      lat: '41.0082',
      lon: '28.9784',
    });
    expect(result[1]).toEqual({
      display_name: 'Kadikoy, Istanbul, Turkey',
      lat: '41.0014',
      lon: '29.0376',
    });
  });

  it('combines street and house number into display_name when present', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        features: [
          {
            geometry: { coordinates: [29.0, 41.0] },
            properties: {
              street: 'Bagdat Caddesi',
              housenumber: '42',
              city: 'Istanbul',
              country: 'Turkey',
            },
          },
        ],
      }),
    );

    const result = await searchLocation('Bagdat');

    expect(result[0].display_name).toBe('Bagdat Caddesi 42, Istanbul, Turkey');
  });

  it('skips features with missing or invalid coordinates', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        features: [
          { geometry: { coordinates: [29.0, 41.0] }, properties: { name: 'Valid', country: 'Turkey' } },
          { geometry: undefined, properties: { name: 'Bad' } },
          { geometry: { coordinates: [] }, properties: { name: 'Empty coords' } },
          { geometry: { coordinates: ['x', 'y'] }, properties: { name: 'Non-numeric' } },
        ],
      }),
    );

    const result = await searchLocation('test');

    expect(result).toHaveLength(1);
    expect(result[0].display_name).toBe('Valid, Turkey');
  });

  it('skips features whose properties produce an empty display_name', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        features: [
          { geometry: { coordinates: [29.0, 41.0] }, properties: {} },
        ],
      }),
    );

    const result = await searchLocation('blank');
    expect(result).toEqual([]);
  });

  it('returns [] on non-2xx HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: jest.fn() });

    const result = await searchLocation('Istanbul');
    expect(result).toEqual([]);
  });

  it('returns [] when fetch rejects (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network down'));

    const result = await searchLocation('Istanbul');
    expect(result).toEqual([]);
  });

  it('returns [] when response body is not valid JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new SyntaxError('bad json')),
    });

    const result = await searchLocation('Istanbul');
    expect(result).toEqual([]);
  });

  it('returns [] when response shape is missing features array', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ unexpected: 'shape' }));

    const result = await searchLocation('Istanbul');
    expect(result).toEqual([]);
  });

  it('deduplicates repeated parts in display_name', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        features: [
          {
            geometry: { coordinates: [29.0, 41.0] },
            properties: { name: 'Istanbul', city: 'Istanbul', country: 'Turkey' },
          },
        ],
      }),
    );

    const result = await searchLocation('Istanbul');
    expect(result[0].display_name).toBe('Istanbul, Turkey');
  });
});

describe('reverseGeocode', () => {
  beforeEach(() => {
    global.fetch = mockFetch as any;
    mockFetch.mockReset();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('returns null without calling fetch when coords are not finite', async () => {
    const a = await reverseGeocode(NaN, 29.0);
    const b = await reverseGeocode(41.0, Infinity);
    expect(a).toBeNull();
    expect(b).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('hits the Photon /reverse endpoint with the expected query params', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ features: [] }));

    await reverseGeocode(41.0082, 28.9784);

    const calledUrl: string = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('https://photon.komoot.io/reverse?');
    expect(calledUrl).toContain('lat=41.0082');
    expect(calledUrl).toContain('lon=28.9784');
    expect(calledUrl).toContain('lang=en');
  });

  it('returns a LocationSuggestion with the user-tap coords (not the snapped Photon coords)', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        features: [
          {
            geometry: { coordinates: [29.05, 41.02] },
            properties: { name: 'Anıtkabir', city: 'Ankara', country: 'Turkey' },
          },
        ],
      }),
    );

    const result = await reverseGeocode(41.0, 29.0);

    expect(result).toEqual({
      display_name: 'Anıtkabir, Ankara, Turkey',
      lat: '41.02',
      lon: '29.05',
    });
  });

  it('returns null when Photon returns no features', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ features: [] }));
    expect(await reverseGeocode(41.0, 29.0)).toBeNull();
  });

  it('returns null on network error / non-2xx / invalid JSON', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network down'));
    expect(await reverseGeocode(41.0, 29.0)).toBeNull();

    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: jest.fn() });
    expect(await reverseGeocode(41.0, 29.0)).toBeNull();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new SyntaxError('bad json')),
    });
    expect(await reverseGeocode(41.0, 29.0)).toBeNull();
  });

  it('returns null when properties produce an empty display name', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ features: [{ geometry: { coordinates: [29.0, 41.0] }, properties: {} }] }),
    );
    expect(await reverseGeocode(41.0, 29.0)).toBeNull();
  });
});
