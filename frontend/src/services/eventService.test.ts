import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEventReport,
  listEventApprovedParticipants,
  reconfirmEventParticipation,
  reverseGeocode,
  searchLocation,
  updateEvent,
} from './eventService';

vi.mock('@/config/api', () => ({
  API_BASE_URL: 'http://api.test',
}));

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('searchLocation', () => {
  it('returns [] without calling fetch when query is shorter than 2 chars', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await searchLocation('a');

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns [] for whitespace-only queries', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await searchLocation('   ');

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('hits the Photon endpoint with the expected query params', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ features: [] }));

    await searchLocation('Istanbul');

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('https://photon.komoot.io/api?');
    expect(calledUrl).toContain('q=Istanbul');
    expect(calledUrl).toContain('limit=5');
    expect(calledUrl).toContain('lang=en');
  });

  it('does NOT hit the legacy Nominatim endpoint', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ features: [] }));

    await searchLocation('Kadikoy');

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('nominatim');
  });

  it('maps Photon GeoJSON business-flows to LocationSuggestion shape', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
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
        ],
      }),
    );

    const result = await searchLocation('Istanbul');

    expect(result).toEqual([
      {
        display_name: 'Istanbul, Marmara, Turkey',
        lat: '41.0082',
        lon: '28.9784',
      },
    ]);
  });

  it('joins street + housenumber and dedupes repeated locality parts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        features: [
          {
            geometry: { coordinates: [29.0, 41.0] },
            properties: {
              name: 'Kafe',
              street: 'Bagdat Caddesi',
              housenumber: '12',
              district: 'Kadikoy',
              city: 'Kadikoy',
              country: 'Turkey',
            },
          },
        ],
      }),
    );

    const [suggestion] = await searchLocation('Kadikoy');

    expect(suggestion.display_name).toBe('Kafe Bagdat Caddesi 12, Kadikoy, Turkey');
  });

  it('skips business-flows missing coordinates or display name', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        features: [
          { properties: { city: 'Ankara' } }, // no geometry
          { geometry: { coordinates: [29.0, 41.0] }, properties: {} }, // no name parts
          {
            geometry: { coordinates: [32.85, 39.93] },
            properties: { name: 'Ankara', country: 'Turkey' },
          },
        ],
      }),
    );

    const result = await searchLocation('Ankara');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      display_name: 'Ankara, Turkey',
      lat: '39.93',
      lon: '32.85',
    });
  });

  it('returns [] when Photon responds with a non-OK status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('rate limited', { status: 429 }),
    );

    const result = await searchLocation('Istanbul');

    expect(result).toEqual([]);
  });

  it('returns [] when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    const result = await searchLocation('Istanbul');

    expect(result).toEqual([]);
  });

  it('returns [] when Photon body is malformed JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await searchLocation('Istanbul');

    expect(result).toEqual([]);
  });
});

describe('reverseGeocode', () => {
  it('returns null for non-finite coordinates', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    expect(await reverseGeocode(Number.NaN, 0)).toBeNull();
    expect(await reverseGeocode(0, Number.POSITIVE_INFINITY)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('hits the Photon reverse endpoint with lat/lon and lang=en', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        features: [
          {
            geometry: { coordinates: [28.9784, 41.0082] },
            properties: { name: 'Istanbul', country: 'Turkey' },
          },
        ],
      }),
    );

    await reverseGeocode(41.0082, 28.9784);

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('https://photon.komoot.io/reverse?');
    expect(calledUrl).toContain('lat=41.0082');
    expect(calledUrl).toContain('lon=28.9784');
    expect(calledUrl).toContain('lang=en');
  });

  it('maps the first Photon feature to a LocationSuggestion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        features: [
          {
            geometry: { coordinates: [28.9784, 41.0082] },
            properties: { name: 'Istanbul', country: 'Turkey' },
          },
        ],
      }),
    );

    const result = await reverseGeocode(41.0082, 28.9784);

    expect(result).toEqual({
      display_name: 'Istanbul, Turkey',
      lat: '41.0082',
      lon: '28.9784',
    });
  });

  it('falls back to original coordinates when the feature lacks geometry', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        features: [
          {
            properties: { name: 'Istanbul', country: 'Turkey' },
          },
        ],
      }),
    );

    const result = await reverseGeocode(41.5, 29.5);

    expect(result).toEqual({
      display_name: 'Istanbul, Turkey',
      lat: '41.5',
      lon: '29.5',
    });
  });

  it('returns null when Photon returns no business-flows', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ features: [] }));

    expect(await reverseGeocode(41, 29)).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    expect(await reverseGeocode(41, 29)).toBeNull();
  });

  it('returns null when Photon responds with a non-OK status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('error', { status: 500 }),
    );

    expect(await reverseGeocode(41, 29)).toBeNull();
  });
});

describe('eventService.createEventReport', () => {
  it('posts an authenticated event report request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'report-1',
          event_id: 'event-1',
          reporter_user_id: 'user-1',
          report_category: 'SPAM_OR_SCAM',
          message: 'This looks suspicious.',
          image_url: null,
          status: 'PENDING',
          created_at: '2026-05-09T10:00:00Z',
        }),
        { status: 201 },
      ),
    );

    await createEventReport(
      'event-1',
      {
        report_category: 'SPAM_OR_SCAM',
        message: 'This looks suspicious.',
      },
      'access-token',
    );

    expect(fetch).toHaveBeenCalledWith('http://api.test/events/event-1/reports', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        report_category: 'SPAM_OR_SCAM',
        message: 'This looks suspicious.',
      }),
    }));
  });
});

describe('eventService.updateEvent', () => {
  it('patches event updates through the versioned update endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        id: 'event-1',
        title: 'Updated event title',
        privacy_level: 'PROTECTED',
        status: 'ACTIVE',
        start_time: '2026-05-10T10:00:00Z',
        end_time: null,
        version_no: 4,
        reconfirmation_required: true,
        reconfirmation_triggered_fields: ['title'],
        participants_marked_pending: 2,
        updated_at: '2026-05-09T10:00:00Z',
      }),
    );

    const result = await updateEvent(
      'event-1',
      { title: 'Updated event title' },
      'access-token',
    );

    expect(fetch).toHaveBeenCalledWith('http://api.test/events/event-1', expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ title: 'Updated event title' }),
    }));
    expect(result.version_no).toBe(4);
    expect(result.reconfirmation_required).toBe(true);
  });
});

describe('eventService.listEventApprovedParticipants', () => {
  it('passes participant status filters to the backend', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        items: [],
        page_info: {
          next_cursor: null,
          has_next: false,
        },
      }),
    );

    await listEventApprovedParticipants('event-1', 'access-token', {
      limit: 25,
      cursor: 'next-page',
      status: 'PENDING',
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/events/event-1/participants?limit=25&cursor=next-page&status=PENDING',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
  });
});

describe('eventService.reconfirmEventParticipation', () => {
  it('posts to the reconfirm endpoint with bearer auth', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        participation_id: 'participation-1',
        event_id: 'event-1',
        status: 'APPROVED',
        reconfirmed_at: '2026-05-10T10:00:00Z',
        last_confirmed_event_version: 5,
        latest_event_version: 5,
      }),
    );

    const result = await reconfirmEventParticipation('event-1', 'access-token');

    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/events/event-1/participation/reconfirm',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({}),
      }),
    );
    expect(result.latest_event_version).toBe(5);
  });
});
